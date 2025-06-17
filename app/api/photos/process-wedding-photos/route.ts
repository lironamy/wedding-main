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

        // Get all photos, regardless of processing status
        const photosToProcess = await Photo.find({});
        if (photosToProcess.length === 0) {
            return NextResponse.json({ message: 'No wedding photos found to process.' }, { status: 200 });
        }

        console.log(`Found ${photosToProcess.length} photos to process`);
        console.log('Photo IDs:', photosToProcess.map(p => p._id));

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
                console.log(`\n[Photo ${photo._id}] Starting processing for image URL: ${photo.imageUrl}`);
                const imageResponse = await fetch(photo.imageUrl);
                if (!imageResponse.ok) {
                    console.error(`[Photo ${photo._id}] Failed to fetch wedding photo: ${photo.imageUrl}. Status: ${imageResponse.statusText}`);
                    return { success: false, photoId: photo._id, error: `Failed to fetch image: ${imageResponse.statusText}`, details: { photoFacesDetected, photoFacesMatched, photoMatchDetails } };
                }
                const imageBuffer = await imageResponse.buffer();
                const image = await bufferToImage(imageBuffer);

                if (image) {
                    console.log(`[Photo ${photo._id}] Image loaded successfully. Dimensions: ${image.width}x${image.height}`);
                } else {
                    console.warn(`[Photo ${photo._id}] bufferToImage returned null or undefined.`);
                    return { success: false, photoId: photo._id, error: `Failed to load image content`, details: { photoFacesDetected, photoFacesMatched, photoMatchDetails } };
                }

                // Try SSD MobileNet first
                console.log(`[Photo ${photo._id}] Attempting face detection with SSD MobileNet...`);
                let detections = await faceapi.detectAllFaces(image as unknown as HTMLImageElement, new faceapi.SsdMobilenetv1Options({ 
                    minConfidence: 0.2, // Lowered from 0.3
                    maxResults: 20 // Increased from 10
                }))
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                console.log(`[Photo ${photo._id}] SSD MobileNet found ${detections.length} faces with confidence threshold 0.2`);

                // If no faces found with SSD MobileNet, try with even lower confidence
                if (detections.length === 0) {
                    console.log(`[Photo ${photo._id}] Retrying SSD MobileNet with lower confidence...`);
                    detections = await faceapi.detectAllFaces(image as unknown as HTMLImageElement, new faceapi.SsdMobilenetv1Options({ 
                        minConfidence: 0.1,
                        maxResults: 20
                    }))
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                    
                    console.log(`[Photo ${photo._id}] SSD MobileNet found ${detections.length} faces with confidence threshold 0.1`);
                }

                // If still no faces found, try TinyFaceDetector
                if (detections.length === 0) {
                    console.log(`[Photo ${photo._id}] No faces found with SSD MobileNet, trying TinyFaceDetector...`);
                    detections = await faceapi.detectAllFaces(image as unknown as HTMLImageElement, new faceapi.TinyFaceDetectorOptions({ 
                        inputSize: 800, // Increased from 608
                        scoreThreshold: 0.2 // Lowered from 0.3
                    }))
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                    
                    console.log(`[Photo ${photo._id}] TinyFaceDetector found ${detections.length} faces`);
                }

                // If still no faces, try one last time with TinyFaceDetector and even lower threshold
                if (detections.length === 0) {
                    console.log(`[Photo ${photo._id}] Retrying TinyFaceDetector with lower threshold...`);
                    detections = await faceapi.detectAllFaces(image as unknown as HTMLImageElement, new faceapi.TinyFaceDetectorOptions({ 
                        inputSize: 800,
                        scoreThreshold: 0.1
                    }))
                        .withFaceLandmarks()
                        .withFaceDescriptors();
                    
                    console.log(`[Photo ${photo._id}] TinyFaceDetector found ${detections.length} faces with lower threshold`);
                }

                photoFacesDetected = detections.length;
                console.log(`[Photo ${photo._id}] Face detection complete. Found ${detections.length} faces. Image dimensions: ${image.width}x${image.height}`);

                if (detections.length === 0) {
                    console.log(`[Photo ${photo._id}] No faces detected with any detector. This is unexpected for an image that should contain faces.`);
                }

                photo.detectedFaces = []; // Clear existing detected faces

                if (detections.length > 0) {
                    console.log(`[Photo ${photo._id}] Processing ${detections.length} detected faces...`);
                    for (const detection of detections) {
                        console.log(`[Photo ${photo._id}] Processing face ${photoFacesDetected - detections.length + 1}/${detections.length}`);
                        console.log(`[Photo ${photo._id}] Face bounding box:`, detection.detection.box);

                        let minDistance = Infinity;
                        let closestGuestName = '';
                        let closestGuestId = '';
                        guestUsersWithEncodings.forEach(guest => {
                            const guestDescriptor = new Float32Array(guest.faceEncoding!);
                            const dist = faceapi.euclideanDistance(detection.descriptor, guestDescriptor);
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
                } else {
                    console.log(`[Photo ${photo._id}] No faces detected in the image.`);
                }

                photo.isProcessed = true;
                await photo.save();
                console.log(`[Photo ${photo._id}] Processing complete. Status: ${photoFacesDetected} faces detected, ${photoFacesMatched} faces matched.`);
                return { success: true, photoId: photo._id, details: { photoFacesDetected, photoFacesMatched, photoMatchDetails } };
            } catch (error: any) {
                console.error(`[Photo ${photo._id}] Error during processing (image URL: ${photo.imageUrl}):`, error);
                return { success: false, photoId: photo._id, error: error.message || 'Unknown error', details: { photoFacesDetected, photoFacesMatched, photoMatchDetails } };
            }
        }

        const BATCH_SIZE = 10; // Define the batch size
        // Removed initial processing of all photos at once

        let photosProcessedCount = 0;
        let facesMatchedCount = 0;
        let totalFacesDetected = 0;
        let allMatchDetails: Array<{ photoId: string; guestName: string; confidence: number; distance: number }> = []; // Renamed from matchDetails

        const totalPhotos = photosToProcess.length;
        // The check for totalPhotos === 0 is already correctly placed before this block if photosToProcess was filtered.
        // If not, it should be here:
        // if (totalPhotos === 0) {
        //     return NextResponse.json({ message: 'No unprocessed wedding photos found to process.' }, { status: 200 });
        // }
        const numBatches = Math.ceil(totalPhotos / BATCH_SIZE);

        console.log(`Found ${totalPhotos} unprocessed photos to process in ${numBatches} batches of up to ${BATCH_SIZE} photos each.`); // Modified log message slightly for clarity

        for (let i = 0; i < numBatches; i++) {
            const batchStart = i * BATCH_SIZE;
            const batchEnd = Math.min((i + 1) * BATCH_SIZE, totalPhotos);
            const currentBatchPhotos = photosToProcess.slice(batchStart, batchEnd);

            console.log(`\n--- Starting Batch ${i + 1}/${numBatches} --- (${currentBatchPhotos.length} photos)`);

            // Create promises ONLY for the current batch
            const batchProcessingPromises = currentBatchPhotos.map(photo =>
                processPhoto(photo, guestUsersWithEncodings, faceMatcher)
            );
            const batchResults = await Promise.allSettled(batchProcessingPromises);

            batchResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    const data = result.value;
                    if (data.success) {
                        photosProcessedCount++;
                        totalFacesDetected += data.details.photoFacesDetected;
                        facesMatchedCount += data.details.photoFacesMatched;
                        allMatchDetails.push(...data.details.photoMatchDetails); // Use renamed variable
                    } else {
                        console.warn(`[Photo ${data.photoId}] Processing reported failure during batch ${i+1}: ${data.error}`);
                    }
                } else {
                    // Try to get photoId from the reason if possible
                    let photoId = 'Unknown Photo ID';
                    if (result.reason && typeof result.reason === 'object' && 'photoId' in result.reason) {
                        photoId = String(result.reason.photoId); // Ensure it's a string
                    }
                    console.error(`[Photo ${photoId}] Unhandled promise rejection during batch ${i+1}:`, result.reason);
                }
            });
            console.log(`--- Completed Batch ${i + 1}/${numBatches} ---`);
        }

        // The redundant results.forEach loop that was outside and after the batch loop has been removed.
        // The logic for summarizing results is now correctly inside the batch loop and accumulated.

        console.log('\nOverall Processing Summary:'); // Kept this title for the section
        console.log(`Total photos processed successfully: ${photosProcessedCount}`); // Clarified "successfully"
        console.log(`Total faces detected in processed photos: ${totalFacesDetected}`);
        console.log(`Total faces matched in processed photos: ${facesMatchedCount}`);
        console.log('\nMatch Details (from successfully processed photos):');
        allMatchDetails.forEach(match => { // Use renamed variable
            console.log(`Photo ${match.photoId}: Matched ${match.guestName} with confidence ${Math.round(match.confidence * 100)}% (distance: ${match.distance})`);
        });

        return NextResponse.json({
            message: `Processing complete. ${photosProcessedCount} wedding photos processed successfully. ${facesMatchedCount} faces matched out of ${totalFacesDetected} detected faces.`,
            details: allMatchDetails // Use renamed variable
        }, { status: 200 });

    } catch (error) {
        console.error('Error in process wedding photos endpoint:', error);
        return NextResponse.json({ 
            message: 'Internal server error during photo processing.', 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}