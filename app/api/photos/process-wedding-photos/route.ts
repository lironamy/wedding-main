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

        // Function to process a single photo
        async function processPhoto(photo: IPhoto, guestUsersWithEncodings: IUser[], faceMatcher: faceapi.FaceMatcher) {
            let photoFacesDetected = 0;
            let photoFacesMatched = 0;
            let photoMatchDetails: Array<{ photoId: string; guestName: string; confidence: number; distance: number }> = [];

            try {
                console.log(`[Photo ${photo._id}] Starting processing for image URL: ${photo.imageUrl}`);
                const imageResponse = await fetch(photo.imageUrl);
                if (!imageResponse.ok) {
                    console.error(`[Photo ${photo._id}] Failed to fetch wedding photo: ${photo.imageUrl}. Status: ${imageResponse.statusText}`);
                    return { success: false, photoId: photo._id, error: `Failed to fetch image: ${imageResponse.statusText}`, details: { photoFacesDetected, photoFacesMatched, photoMatchDetails } };
                }
                const imageBuffer = await imageResponse.buffer();
                const image = await bufferToImage(imageBuffer);

                if (image) {
                    console.log(`[Photo ${photo._id}] Image loaded. Type: ${typeof image}, Shape: ${image.width}x${image.height}`);
                } else {
                    console.warn(`[Photo ${photo._id}] bufferToImage returned null or undefined.`);
                     return { success: false, photoId: photo._id, error: `Failed to load image content`, details: { photoFacesDetected, photoFacesMatched, photoMatchDetails } };
                }

                const detectionOptions = await getFaceDetectorOptions();
                const detections = await faceapi.detectAllFaces(image as unknown as HTMLImageElement, detectionOptions)
                                              .withFaceLandmarks()
                                              .withFaceDescriptors();

                photoFacesDetected = detections.length;
                console.log(`[Photo ${photo._id}] Found ${detections.length} faces.`);

                photo.detectedFaces = []; // Clear existing detected faces

                if (detections.length > 0) {
                    for (const detection of detections) {
                        console.log(`[Photo ${photo._id}] Processing detected face. Descriptor length: ${detection.descriptor.length}, First 5 values: ${detection.descriptor.slice(0, 5)}`);

                        let minDistance = Infinity;
                        let closestGuestName = '';
                        let closestGuestId = '';
                        guestUsersWithEncodings.forEach(guest => {
                            const guestDescriptor = new Float32Array(guest.faceEncoding!);
                            const dist = faceapi.euclideanDistance(detection.descriptor, guestDescriptor);
                            // console.log(`[Photo ${photo._id}] Distance to guest ${guest.name} (${guest._id}): ${dist}`); // Potentially too verbose
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestGuestName = guest.name;
                                closestGuestId = (guest._id as unknown as string).toString();
                            }
                        });
                        console.log(`[Photo ${photo._id}] Closest guest: ${closestGuestName} (${closestGuestId}), distance: ${minDistance}`);

                        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
                        let matchedUserId: string | undefined;
                        let matchConfidence = 0;

                        console.log(`[Photo ${photo._id}] Face match details: Best match: ${bestMatch.label} (distance: ${bestMatch.distance}). All matches: ${bestMatch.toString()}. Match threshold: ${FACE_MATCH_THRESHOLD}, Distance threshold: ${FACE_MATCH_DISTANCE_THRESHOLD}`);

                        if (bestMatch && bestMatch.label !== 'unknown' && bestMatch.distance < FACE_MATCH_DISTANCE_THRESHOLD) {
                            matchedUserId = bestMatch.label;
                            matchConfidence = Math.max(0, Math.min(1, 1 - bestMatch.distance));
                            photoFacesMatched++;

                            const matchedGuest = guestUsersWithEncodings.find(g => (g._id as unknown as string).toString() === matchedUserId);
                            console.log(`[Photo ${photo._id}] MATCH FOUND: Guest: ${matchedGuest?.name}, Raw distance: ${bestMatch.distance}, Calculated confidence: ${matchConfidence}`);
                            
                            photoMatchDetails.push({
                                photoId: (photo._id as mongoose.Types.ObjectId).toString(),
                                guestName: matchedGuest?.name || 'Unknown',
                                confidence: matchConfidence,
                                distance: bestMatch.distance
                            });

                            photo.detectedFaces.push({
                                faceDescriptorInPhoto: Array.from(detection.descriptor),
                                matchedUser: new mongoose.Types.ObjectId(matchedUserId),
                                matchConfidence: matchConfidence,
                                boundingBox: detection.detection.box
                            });
                        } else {
                            photo.detectedFaces.push({
                                faceDescriptorInPhoto: Array.from(detection.descriptor),
                                matchedUser: undefined,
                                matchConfidence: 0,
                                boundingBox: detection.detection.box
                            });
                            console.log(`[Photo ${photo._id}] NO MATCH FOUND: Distance: ${bestMatch.distance}, Threshold: ${FACE_MATCH_DISTANCE_THRESHOLD}, Label: ${bestMatch.label}`);
                        }
                    }
                }
                photo.isProcessed = true;
                await photo.save();
                console.log(`[Photo ${photo._id}] Processing successful. Saved to DB.`);
                return { success: true, photoId: photo._id, details: { photoFacesDetected, photoFacesMatched, photoMatchDetails } };
            } catch (error: any) {
                console.error(`[Photo ${photo._id}] Error during processing (image URL: ${photo.imageUrl}):`, error);
                return { success: false, photoId: photo._id, error: error.message || 'Unknown error', details: { photoFacesDetected, photoFacesMatched, photoMatchDetails } };
            }
        }

        const BATCH_SIZE = 10; // Define the batch size
        const processingPromises = photosToProcess.map(photo => processPhoto(photo, guestUsersWithEncodings, faceMatcher));
        const results = await Promise.allSettled(processingPromises);

        let photosProcessedCount = 0;
        let facesMatchedCount = 0;
        let totalFacesDetected = 0;
        let matchDetails: Array<{ photoId: string; guestName: string; confidence: number; distance: number }> = [];

        const totalPhotos = photosToProcess.length;
        const numBatches = Math.ceil(totalPhotos / BATCH_SIZE);

        console.log(`Starting processing in ${numBatches} batches of up to ${BATCH_SIZE} photos each.`);

        for (let i = 0; i < numBatches; i++) {
            const batchStart = i * BATCH_SIZE;
            const batchEnd = Math.min((i + 1) * BATCH_SIZE, totalPhotos);
            const currentBatchPhotos = photosToProcess.slice(batchStart, batchEnd);

            console.log(`\n--- Starting Batch ${i + 1}/${numBatches} --- (${currentBatchPhotos.length} photos)`);

            const processingPromises = currentBatchPhotos.map(photo => processPhoto(photo, guestUsersWithEncodings, faceMatcher));
            const results = await Promise.allSettled(processingPromises);

            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    const data = result.value;
                    if (data.success) {
                        photosProcessedCount++;
                        totalFacesDetected += data.details.photoFacesDetected;
                        facesMatchedCount += data.details.photoFacesMatched;
                        matchDetails.push(...data.details.photoMatchDetails);
                    } else {
                        console.warn(`[Photo ${data.photoId}] Processing reported failure during batch ${i+1}: ${data.error}`);
                    }
                } else {
                    const photoId = result.reason && typeof result.reason === 'object' && 'photoId' in result.reason ? result.reason.photoId : 'Unknown Photo ID in Batch ' + (i+1);
                    console.error(`[Photo ${photoId}] Unhandled promise rejection during batch ${i+1}:`, result.reason);
                }
            });
            console.log(`--- Completed Batch ${i + 1}/${numBatches} ---`);
        }

        console.log('\nOverall Processing Summary:');
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                const data = result.value;
                if (data.success) {
                    photosProcessedCount++;
                    totalFacesDetected += data.details.photoFacesDetected;
                    facesMatchedCount += data.details.photoFacesMatched;
                    matchDetails.push(...data.details.photoMatchDetails);
                } else {
                    // Log error for this specific photo if processing function indicated failure (handled error)
                    console.warn(`[Photo ${data.photoId}] Processing reported failure: ${data.error}`);
                }
            } else {
                // Log error if the promise itself was rejected (unhandled exception in processPhoto or other issue)
                // Attempt to get photoId if the error object might have it (as returned by processPhoto on error)
                const photoId = result.reason && typeof result.reason === 'object' && 'photoId' in result.reason ? result.reason.photoId : 'Unknown Photo ID';
                console.error(`[Photo ${photoId}] Unhandled promise rejection during processing:`, result.reason);
            }
        });

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