import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import Photo, { IPhoto } from '@/models/Photo';
import { loadModels, bufferToImage, getFaceDetectorOptions } from '@/lib/faceRecognition';
import * as faceapi from 'face-api.js';
import fetch from 'node-fetch'; // To fetch images from Cloudinary
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt'; // For auth if needed, or remove if it's a system process
import mongoose from 'mongoose';

const FACE_MATCH_THRESHOLD = 0.6; // Lowered from 0.4 to be even more lenient
const FACE_MATCH_DISTANCE_THRESHOLD = 0.7; // Increased from 0.6 to be more lenient

export async function POST(request: Request) { // Or GET, if triggered by a cron or manually without payload
    try {
        await dbConnect();
        await loadModels();

        // Optional: Add authentication if this is a user-triggered process
        const token = await getTokenFromCookie();
        if (!token) {
            return NextResponse.json({ message: 'Authentication required for this process' }, { status: 401 });
        }
        const decodedToken = verifyToken(token) as { id: string };
        if (!decodedToken || !decodedToken.id) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }
        const mainUser = await User.findById(decodedToken.id);
        if (!mainUser || mainUser.userType !== 'bride/groom') {
            return NextResponse.json({ message: 'Unauthorized: Only main users can trigger processing.' }, { status: 403 });
        }
        // End Optional Auth

        // Get all photos, not just unprocessed ones
        const photosToProcess = await Photo.find({});
        if (photosToProcess.length === 0) {
            return NextResponse.json({ message: 'No wedding photos found to process.' }, { status: 200 });
        }

        console.log(`Found ${photosToProcess.length} photos to process`);

        // Fetch all guest users with face encodings
        const guestUsersWithEncodings = await User.find({
            userType: 'guest',
            faceEncoding: { $exists: true, $ne: [] },
            isVerified: true // Only use verified guest selfies
        }) as IUser[];

        if (guestUsersWithEncodings.length === 0) {
            return NextResponse.json({ message: 'No verified guest selfies found. Process selfies first.' }, { status: 400 });
        }

        console.log(`Found ${guestUsersWithEncodings.length} guests with face encodings:`, 
            guestUsersWithEncodings.map(g => g.name));

        // Create FaceMatcher for guests
        const labeledFaceDescriptors = guestUsersWithEncodings.map((user: IUser) => {
            const descriptor = new Float32Array(user.faceEncoding!);
            console.log(`\nCreating face descriptor for ${user.name}:`);
            console.log(`- Descriptor length: ${descriptor.length}`);
            console.log(`- First 5 values: ${descriptor.slice(0, 5)}`);
            console.log(`- User ID: ${user._id}`);
            return new faceapi.LabeledFaceDescriptors((user._id as unknown as string).toString(), [descriptor]);
        });
        console.log(`\nCreated ${labeledFaceDescriptors.length} face descriptors`);
        console.log('Face descriptors details:', labeledFaceDescriptors.map(d => ({
            label: d.label,
            descriptorLength: d.descriptors[0].length
        })));
        const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, FACE_MATCH_THRESHOLD);
        console.log(`\nCreated face matcher with threshold: ${FACE_MATCH_THRESHOLD}`);

        // Log model file paths (assuming loadModels logs this, but add explicit log)
        console.log('FaceAPI model paths:', process.env.FACEAPI_MODELS_PATH || 'default ./public/models');

        // Print full descriptor for the first guest
        if (guestUsersWithEncodings.length > 0) {
            const firstGuest = guestUsersWithEncodings[0];
            const descriptor = new Float32Array(firstGuest.faceEncoding!);
            console.log('\nFULL DESCRIPTOR for first guest:', firstGuest.name);
            console.log(descriptor);
        }

        let photosProcessedCount = 0;
        let facesMatchedCount = 0;
        let totalFacesDetected = 0;
        let matchDetails: Array<{ photoId: string; guestName: string; confidence: number; distance: number }> = [];
        let printedFirstFace = false;

        for (const photo of photosToProcess) {
            try {
                console.log(`\nProcessing photo ${photo._id}`);
                const imageResponse = await fetch(photo.imageUrl);
                if (!imageResponse.ok) {
                    console.error(`Failed to fetch wedding photo: ${photo.imageUrl}`);
                    continue;
                }
                const imageBuffer = await imageResponse.buffer();
                const image = await bufferToImage(imageBuffer);
                // Log image type and shape
                if (image) {
                    console.log('Image type:', typeof image);
                    if (image.width && image.height) {
                        console.log('Image shape:', image.width, 'x', image.height);
                    }
                }

                const detectionOptions = await getFaceDetectorOptions();
                const detections = await faceapi.detectAllFaces(image as unknown as HTMLImageElement, detectionOptions)
                                              .withFaceLandmarks()
                                              .withFaceDescriptors();

                totalFacesDetected += detections.length;
                console.log(`Found ${detections.length} faces in photo ${photo._id}`);

                // Print full descriptor for the first detected face in the first photo
                if (!printedFirstFace && detections.length > 0) {
                    printedFirstFace = true;
                    console.log('\nFULL DESCRIPTOR for first detected face in first photo:');
                    console.log(new Float32Array(detections[0].descriptor));
                }

                // Clear existing detected faces to avoid duplicates
                photo.detectedFaces = [];

                if (detections.length > 0) {
                    for (const detection of detections) {
                        console.log(`\nProcessing face in photo ${photo._id}:`);
                        console.log(`- Face descriptor length: ${detection.descriptor.length}`);
                        console.log(`- First 5 values: ${detection.descriptor.slice(0, 5)}`);

                        // Log distance to every guest
                        let minDistance = Infinity;
                        let closestGuestName = '';
                        let closestGuestId = '';
                        guestUsersWithEncodings.forEach(guest => {
                            const guestDescriptor = new Float32Array(guest.faceEncoding!);
                            // Euclidean distance
                            const dist = faceapi.euclideanDistance(detection.descriptor, guestDescriptor);
                            console.log(`Distance to guest ${guest.name} (${guest._id}): ${dist}`);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestGuestName = guest.name;
                                closestGuestId = (guest._id as unknown as string).toString();
                            }
                        });
                        console.log(`Closest guest: ${closestGuestName} (${closestGuestId}), distance: ${minDistance}`);

                        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
                        let matchedUserId: string | undefined;
                        let matchConfidence = 0;

                        // Log all potential matches for debugging
                        console.log(`\nFace match details for photo ${photo._id}:`);
                        console.log(`Best match: ${bestMatch.label} (distance: ${bestMatch.distance})`);
                        console.log(`All matches:`, bestMatch.toString());
                        console.log(`Match threshold: ${FACE_MATCH_THRESHOLD}`);
                        console.log(`Distance threshold: ${FACE_MATCH_DISTANCE_THRESHOLD}`);

                        // Check if the best match is not "unknown" and meets our distance threshold
                        if (bestMatch && bestMatch.label !== 'unknown' && bestMatch.distance < FACE_MATCH_DISTANCE_THRESHOLD) {
                            matchedUserId = bestMatch.label;
                            // Calculate confidence as 1 - distance, ensuring it's between 0 and 1
                            matchConfidence = Math.max(0, Math.min(1, 1 - bestMatch.distance));
                            facesMatchedCount++;

                            // Find guest name for logging
                            const matchedGuest = guestUsersWithEncodings.find(g => (g._id as unknown as string).toString() === matchedUserId);
                            console.log(`\nMATCH FOUND:`);
                            console.log(`- Guest: ${matchedGuest?.name}`);
                            console.log(`- Raw distance: ${bestMatch.distance}`);
                            console.log(`- Calculated confidence: ${matchConfidence}`);
                            
                            matchDetails.push({
                                photoId: photo._id.toString(),
                                guestName: matchedGuest?.name || 'Unknown',
                                confidence: matchConfidence,
                                distance: bestMatch.distance
                            });

                            // Save the face with confidence value and proper ObjectId
                            photo.detectedFaces.push({
                                faceDescriptorInPhoto: Array.from(detection.descriptor),
                                matchedUser: new mongoose.Types.ObjectId(matchedUserId), // Convert to ObjectId
                                matchConfidence: matchConfidence,
                                boundingBox: detection.detection.box
                            });
                        } else {
                            // If no match found, still store the face but without a match
                            photo.detectedFaces.push({
                                faceDescriptorInPhoto: Array.from(detection.descriptor),
                                matchedUser: undefined,
                                matchConfidence: 0,
                                boundingBox: detection.detection.box
                            });
                            console.log(`\nNO MATCH FOUND:`);
                            console.log(`- Distance: ${bestMatch.distance}`);
                            console.log(`- Threshold: ${FACE_MATCH_DISTANCE_THRESHOLD}`);
                            console.log(`- Label: ${bestMatch.label}`);
                        }
                    }
                }
                photo.isProcessed = true;
                await photo.save();
                photosProcessedCount++;
            } catch (error) {
                console.error(`Error processing photo ${photo._id} (${photo.imageUrl}):`, error);
            }
        }

        console.log('\nProcessing Summary:');
        console.log(`Total photos processed: ${photosProcessedCount}`);
        console.log(`Total faces detected: ${totalFacesDetected}`);
        console.log(`Total faces matched: ${facesMatchedCount}`);
        console.log('\nMatch Details:');
        matchDetails.forEach(match => {
            console.log(`Photo ${match.photoId}: Matched ${match.guestName} with confidence ${Math.round(match.confidence * 100)}% (distance: ${match.distance})`);
        });

        return NextResponse.json({
            message: `Processing complete. ${photosProcessedCount} wedding photos processed. ${facesMatchedCount} faces matched out of ${totalFacesDetected} detected faces.`,
            details: matchDetails
        }, { status: 200 });

    } catch (error) {
        console.error('Error in process wedding photos endpoint:', error);
        return NextResponse.json({ 
            message: 'Internal server error during photo processing.', 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}
