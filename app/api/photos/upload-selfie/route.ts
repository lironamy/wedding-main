import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import Contact, { IContact } from '@/models/Contact';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { loadModels, bufferToImage, getFaceDetectorOptions } from '@/lib/faceRecognition'; // Import face recognition utilities
import * as faceapi from 'face-api.js';
import fetch from 'node-fetch'; // To fetch image from Cloudinary URL for processing
import Photo from '@/models/Photo';
import { updateProgress, clearProgress } from '../processing-progress/route';


// Helper to parse FormData (same as in wedding photo upload)
async function parseFormData(request: Request): Promise<{ files: File[], fields: Record<string, string> }> {
    const formData = await request.formData();
    const files: File[] = [];
    const fields: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
            files.push(value);
        } else {
            fields[key] = value as string;
        }
    }
    return { files, fields };
}

export async function POST(request: Request) {
    try {
        await dbConnect();

        const { files, fields } = await parseFormData(request);
        const token = fields.token; // Expecting the invitationToken to be sent in FormData

        if (!token) {
            return NextResponse.json({ message: 'Invitation token is required.' }, { status: 400 });
        }

        if (!files || files.length === 0) {
            return NextResponse.json({ message: 'No selfie file uploaded.' }, { status: 400 });
        }
        if (files.length > 1) {
            return NextResponse.json({ message: 'Only a single selfie can be uploaded.' }, { status: 400 });
        }

        const selfieFile = files[0];

        // Find the contact by invitation token
        const contact = await Contact.findOne({ invitationToken: token }) as IContact | null;
        if (!contact) {
            return NextResponse.json({ message: 'Invalid or expired invitation token.' }, { status: 404 });
        }

        // Upload selfie to Cloudinary
        const selfieBytes = await selfieFile.arrayBuffer();
        const selfieBuffer = Buffer.from(selfieBytes);
        const cloudinaryResponse = await uploadToCloudinary(selfieBuffer, 'guest_selfies');

        if (!cloudinaryResponse || !cloudinaryResponse.secure_url || !cloudinaryResponse.public_id) {
            return NextResponse.json({ message: 'Failed to upload selfie to Cloudinary.' }, { status: 500 });
        }

        // --- Face Processing Logic ---
        await loadModels(); // Ensure models are loaded
        let faceDescriptor: number[] | undefined = undefined;
        let processingMessage: string | undefined = undefined;

        try {
            // Fetch the uploaded image from Cloudinary to process it
            const imageResponse = await fetch(cloudinaryResponse.secure_url);
            if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image from Cloudinary: ${imageResponse.statusText}`);
            }
            const imageBuffer = await imageResponse.buffer();
            const image = await bufferToImage(imageBuffer); // Convert buffer to canvas.Image

            const detectionOptions = await getFaceDetectorOptions();
            const detection = await faceapi.detectSingleFace(image as unknown as HTMLImageElement, detectionOptions)
                                          .withFaceLandmarks()
                                          .withFaceDescriptor();

            if (detection) {
                // Additional validation for face quality
                const faceBox = detection.detection.box;
                const imageWidth = image.width;
                const imageHeight = image.height;
                
                // Check if face is too small (less than 20% of image width)
                const faceWidthRatio = faceBox.width / imageWidth;
                const faceHeightRatio = faceBox.height / imageHeight;
                
                if (faceWidthRatio < 0.2 || faceHeightRatio < 0.2) {
                    processingMessage = "הפנים בתמונה קטנות מדי. אנא צלמו תמונה קרובה יותר.";
                    return NextResponse.json({ 
                        message: processingMessage,
                        faceDetected: false 
                    }, { status: 200 });
                }

                // Check if face is too close to edges
                const edgeBuffer = 0.1; // 10% buffer from edges
                if (faceBox.x < imageWidth * edgeBuffer || 
                    faceBox.y < imageHeight * edgeBuffer ||
                    (faceBox.x + faceBox.width) > imageWidth * (1 - edgeBuffer) ||
                    (faceBox.y + faceBox.height) > imageHeight * (1 - edgeBuffer)) {
                    processingMessage = "הפנים קרובות מדי לקצה התמונה. אנא מרכזו את הפנים בתמונה.";
                    return NextResponse.json({ 
                        message: processingMessage,
                        faceDetected: false 
                    }, { status: 200 });
                }

                faceDescriptor = Array.from(detection.descriptor);
                processingMessage = "סלפי עובד בהצלחה וקידוד הפנים נשמר.";
            } else {
                processingMessage = "הסלפי הועלה, אך לא הצלחנו לזהות פנים בתמונה. אנא נסו להעלות תמונה ברורה יותר של הפנים שלכם.";
            }
        } catch (processingError) {
            console.error("Error processing selfie with face-api.js:", processingError);
            processingMessage = "הסלפי הועלה, אך אירעה שגיאה בעיבוד הפנים.";
        }
        // --- End Face Processing Logic ---

        let guestUser = contact.guestUser ? await User.findById(contact.guestUser) as IUser | null : null;

        if (!guestUser) {
            // Create a new user for this contact, regardless of phone number
            guestUser = new User({
                userType: 'guest',
                name: contact.name,
                email: `${contact.phoneNumber}_${contact._id}@example.com`, // Make email unique by including contact ID
                phoneNumber: contact.phoneNumber,
                selfiePath: cloudinaryResponse.secure_url,
                faceEncoding: faceDescriptor,
                isVerified: !!faceDescriptor,
            });
        } else {
            // Update existing user
            guestUser.selfiePath = cloudinaryResponse.secure_url;
            guestUser.faceEncoding = faceDescriptor;
            if (contact.name && !guestUser.name) guestUser.name = contact.name;
            if (faceDescriptor && !guestUser.isVerified) guestUser.isVerified = true;
        }

        if (!guestUser) {
            return NextResponse.json({ 
                message: 'שגיאה ביצירת משתמש אורח',
                faceDetected: false 
            }, { status: 500 });
        }

        await guestUser.save();

        // Always update the contact with the new guest user ID
        contact.guestUser = guestUser._id;
        await contact.save();

        // Process wedding photos with the new face encoding
        if (faceDescriptor) {
            const guestId = (guestUser._id as unknown as string).toString();
            try {
                // Find all photos, both processed and unprocessed
                const allPhotos = await Photo.find({});
                const totalPhotos = allPhotos.length;
                
                if (totalPhotos > 0) {
                    // Initialize progress
                    updateProgress(guestId, 0, totalPhotos);

                    // Create face matcher with just this guest's face
                    const labeledFaceDescriptor = new faceapi.LabeledFaceDescriptors(
                        guestId,
                        [new Float32Array(faceDescriptor)]
                    );
                    const faceMatcher = new faceapi.FaceMatcher([labeledFaceDescriptor], 0.3);

                    let processedCount = 0;
                    for (const photo of allPhotos) {
                        try {
                            const imageResponse = await fetch(photo.imageUrl);
                            if (!imageResponse.ok) {
                                processedCount++;
                                updateProgress(guestId, processedCount, totalPhotos);
                                continue;
                            }

                            const imageBuffer = await imageResponse.buffer();
                            const image = await bufferToImage(imageBuffer);

                            const detectionOptions = await getFaceDetectorOptions();
                            const detections = await faceapi.detectAllFaces(image as unknown as HTMLImageElement, detectionOptions)
                                                          .withFaceLandmarks()
                                                          .withFaceDescriptors();

                            let foundMatch = false;
                            if (detections.length > 0) {
                                for (const detection of detections) {
                                    const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
                                    
                                    if (bestMatch && bestMatch.label !== 'unknown' && bestMatch.distance < 0.7) {
                                        // Add this face to the photo's detected faces
                                        photo.detectedFaces.push({
                                            faceDescriptorInPhoto: Array.from(detection.descriptor),
                                            matchedUser: guestUser._id,
                                            matchConfidence: 1 - bestMatch.distance,
                                            boundingBox: detection.detection.box
                                        });
                                        foundMatch = true;
                                    }
                                }
                            }
                            
                            // Save the photo if we found a match or if it's unprocessed
                            if (foundMatch || !photo.isProcessed) {
                                photo.isProcessed = true;
                                await photo.save();
                            }

                            processedCount++;
                            updateProgress(guestId, processedCount, totalPhotos);
                        } catch (error) {
                            console.error(`Error processing photo ${photo._id}:`, error);
                            processedCount++;
                            updateProgress(guestId, processedCount, totalPhotos);
                        }
                    }
                }

                // Clear progress after completion
                clearProgress(guestId);
            } catch (processingError) {
                console.error('Error processing wedding photos:', processingError);
                // Clear progress on error
                clearProgress(guestId);
            }
        }

        return NextResponse.json({
            message: processingMessage || (faceDescriptor ? 'סלפי הועלה ועובד בהצלחה.' : 'הסלפי הועלה, אך יש בעיה בעיבוד.'),
            selfieUrl: cloudinaryResponse.secure_url,
            guestId: guestUser._id,
            faceDetected: !!faceDescriptor
        }, { status: 200 });

    } catch (error: any) {
        console.error('Selfie upload & processing error:', error);
        if (error.name === 'MongoServerError' && error.code === 11000 && error.keyValue && error.keyValue.email) {
            return NextResponse.json({ message: `שגיאה ביצירת משתמש אורח: ייתכן שמשתמש עם אימייל דומה כבר קיים. פרטים: ${error.message}` }, { status: 409 });
        }
        return NextResponse.json({ message: 'שגיאת שרת פנימית', error: error.message }, { status: 500 });
    }
}
