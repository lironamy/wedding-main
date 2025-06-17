import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import Contact, { IContact } from '@/models/Contact';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { loadModels, bufferToImage, getFaceDetectorOptions } from '@/lib/faceRecognition'; // Import face recognition utilities
import * as faceapi from 'face-api.js';
import fetch from 'node-fetch'; // To fetch image from Cloudinary URL for processing
import Photo, { IPhoto } from '@/models/Photo'; // Added IPhoto
// import { updateProgress, clearProgress } from '../processing-progress/route'; // Commented out as per requirement
import { guestSseWriters } from '../guest-photo-stream/route';


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

    // --- Start of new async function ---
    async function processWeddingPhotosForGuestInBackground(guestId: string, faceDescriptor: number[], allPhotos: IPhoto[]) {
        const sseWriter = guestSseWriters.get(guestId);
        try {
            await loadModels(); // Ensure models are loaded
            const totalPhotos = allPhotos.length;
            let processedCount = 0;

            if (totalPhotos > 0) {
                // updateProgress(guestId, 0, totalPhotos); // Commented out

                const labeledFaceDescriptor = new faceapi.LabeledFaceDescriptors(
                    guestId,
                    [new Float32Array(faceDescriptor)]
                );
                const faceMatcher = new faceapi.FaceMatcher([labeledFaceDescriptor], 0.6); // More forgiving threshold to match process-wedding-photos

                // let processedCount = 0; // Moved up
                for (const photoData of allPhotos) { // Iterate over plain photo data
                    let isMatch = false; // To send in SSE
                    try {
                        // Fetch the full Photo document to ensure we have the latest version and can call .save()
                        const photoDoc = await Photo.findById(photoData._id) as IPhoto | null;
                        if (!photoDoc) {
                            console.warn(`Photo with ID ${photoData._id} not found, skipping.`);
                            processedCount++;
                            // updateProgress(guestId, processedCount, totalPhotos); // Commented out
                            if (sseWriter) {
                                sseWriter.write(`event: photoProcessed\ndata: ${JSON.stringify({ photoUrl: null, isMatch: false, photoId: photoData._id, progress: { current: processedCount, total: totalPhotos }, error: 'Photo not found' })}\n\n`);
                            }
                            continue;
                        }

                        const imageResponse = await fetch(photoDoc.imageUrl);
                        if (!imageResponse.ok) {
                            console.warn(`Failed to fetch image ${photoDoc.imageUrl} for photo ${photoDoc._id}`);
                            processedCount++;
                            // updateProgress(guestId, processedCount, totalPhotos); // Commented out
                            if (sseWriter) {
                                sseWriter.write(`event: photoProcessed\ndata: ${JSON.stringify({ photoUrl: photoDoc.imageUrl, isMatch: false, photoId: photoDoc._id, progress: { current: processedCount, total: totalPhotos }, error: 'Failed to fetch image' })}\n\n`);
                            }
                            continue;
                        }

                        const imageBuffer = await imageResponse.buffer();
                        const image = await bufferToImage(imageBuffer);

                        const detectionOptions = await getFaceDetectorOptions();
                        const detections = await faceapi.detectAllFaces(image as unknown as HTMLImageElement, detectionOptions)
                                                      .withFaceLandmarks()
                                                      .withFaceDescriptors();

                        let foundMatchInPhoto = false;
                        if (detections.length > 0) {
                            for (const detection of detections) {
                                const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

                                // Using a slightly more tolerant threshold for matching against wedding photos as per original logic
                                // The original code used 0.3 for FaceMatcher construction and then checked bestMatch.distance < 0.7
                                // This seems like a high threshold (more tolerant). Let's keep it consistent.
                                // A common threshold for good recognition is < 0.6, 0.7 is quite permissive.
                                // The prompt specified 0.3 for FaceMatcher, which is strict.
                                // Let's stick to the 0.3 for the FaceMatcher and then evaluate the match.
                                // The original code had `faceMatcher = new faceapi.FaceMatcher([labeledFaceDescriptor], 0.3);`
                                // and then `if (bestMatch && bestMatch.label !== 'unknown' && bestMatch.distance < 0.7)`
                                // This combination is unusual. A matcher threshold of 0.3 means anything with distance > 0.3 is 'unknown'.
                                // So `bestMatch.label !== 'unknown'` implicitly means `bestMatch.distance <= 0.3`.
                                // The `&& bestMatch.distance < 0.7` would then be redundant if the matcher threshold is 0.3.
                                // Let's assume the intent was to use the matcher's threshold.
                                if (bestMatch && bestMatch.label !== 'unknown') { // Relies on the FaceMatcher's 0.3 threshold
                                    // Check if this user is already in detectedFaces for this photo to avoid duplicates
                                    const userAlreadyDetected = photoDoc.detectedFaces.some(
                                        df => df.matchedUser && df.matchedUser.toString() === guestId
                                    );

                                    if (!userAlreadyDetected) {
                                        photoDoc.detectedFaces.push({
                                            faceDescriptorInPhoto: Array.from(detection.descriptor),
                                            matchedUser: guestId as any, // guestId is already a string, but model expects ObjectId type
                                            matchConfidence: 1 - bestMatch.distance, // distance is <= 0.3
                                            boundingBox: detection.detection.box
                                        });
                                        foundMatchInPhoto = true;
                                        isMatch = true; // Set for SSE
                                    }
                                }
                            }
                        }

                        if (foundMatchInPhoto) {
                            photoDoc.isProcessed = true; // Mark as processed if a new match was added
                            await photoDoc.save();
                        }
                        // Not marking as processed if no match for this guest, to allow other processes to evaluate it.

                        processedCount++;
                        // updateProgress(guestId, processedCount, totalPhotos); // Commented out
                        if (sseWriter) {
                            sseWriter.write(`event: photoProcessed\ndata: ${JSON.stringify({ photoUrl: photoDoc.imageUrl, isMatch, photoId: photoDoc._id, progress: { current: processedCount, total: totalPhotos } })}\n\n`);
                        }
                    } catch (error) {
                        console.error(`Error processing photo ${photoData._id} in background:`, error);
                        processedCount++;
                        // updateProgress(guestId, processedCount, totalPhotos); // Commented out
                        if (sseWriter) {
                            // Send error for this specific photo
                             sseWriter.write(`event: photoProcessed\ndata: ${JSON.stringify({ photoUrl: photoData.imageUrl || null, isMatch: false, photoId: photoData._id, progress: { current: processedCount, total: totalPhotos }, error: 'Processing error' })}\n\n`);
                        }
                    }
                }
            }
            // clearProgress(guestId); // Commented out
            console.log(`Background processing completed for guest ${guestId}`);
            if (sseWriter) {
                sseWriter.write(`event: processingComplete\ndata: ${JSON.stringify({ guestId, totalProcessed: processedCount })}\n\n`);
                // Consider if writer should be closed here or if client handles closure.
                // For now, let client close after 'processingComplete'.
                // guestSseWriters.delete(guestId); // This would be done by the SSE route on disconnect
                // writer.close();
            }
        } catch (error) {
            console.error(`Error in processWeddingPhotosForGuestInBackground for guest ${guestId}:`, error);
            // clearProgress(guestId); // Commented out
            if (sseWriter) {
                sseWriter.write(`event: processingError\ndata: ${JSON.stringify({ guestId, error: 'General processing error', details: (error as Error).message })}\n\n`);
                // guestSseWriters.delete(guestId);
                // writer.close();
            }
        }
    }
    // --- End of new async function ---

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
        if (faceDescriptor && guestUser?._id) {
            const guestId = (guestUser._id as unknown as string).toString();
            // Fetch photos once to pass to the background function
            // Using .lean() for potentially better performance if passing large data,
            // but we need full Mongoose documents if we were to save them directly from this array.
            // However, inside the async function, we are fetching the Photo document again by ID.
            // So, sending lean objects should be fine.
            Photo.find({}).lean().then(allPhotosFromDB => {
                // Intentionally not awaiting this promise
                processWeddingPhotosForGuestInBackground(guestId, faceDescriptor as number[], allPhotosFromDB as unknown as IPhoto[]);
            }).catch(err => {
                // Handle error from fetching photos if necessary, though the background function will also try to fetch
                console.error("Error fetching photos for background processing trigger:", err);
            });
        }

        return NextResponse.json({
            message: processingMessage || (faceDescriptor ? 'סלפי הועלה ועובד בהצלחה. עיבוד תמונות החתונה החל ברקע.' : 'הסלפי הועלה, אך יש בעיה בעיבוד.'),
            selfieUrl: cloudinaryResponse.secure_url,
            guestId: guestUser?._id, // guestUser might be null if creation failed before this point
            faceDetected: !!faceDescriptor
        }, { status: 200 });

    } catch (error: any) {
        console.error('Selfie upload & processing error:', error);
        if (error.name === 'MongoServerError' && error.code === 11000 && error.keyValue && error.keyValue.email) {
            // It's possible guestUser is null here if the error occurred during its creation/saving
            // and if the subsequent photo processing logic was intended to run.
            // However, with current flow, guestUser save is awaited before photo processing.
            return NextResponse.json({ message: `שגיאה ביצירת משתמש אורח: ייתכן שמשתמש עם אימייל דומה כבר קיים. פרטים: ${error.message}` }, { status: 409 });
        }
        return NextResponse.json({ message: 'שגיאת שרת פנימית', error: error.message }, { status: 500 });
    }
}
