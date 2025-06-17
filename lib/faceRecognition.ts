import * as faceapi from 'face-api.js';
import * as canvas from 'canvas';
import path from 'path';
import { Canvas, createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';

// Destructure canvas elements and patch them into faceapi.env
const { Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas: Canvas as any, Image: Image as any, ImageData: ImageData as any });

// Path to the models directory in the public folder
// __dirname in ES modules can be tricky, using process.cwd() for project root.
// Ensure models are in /public/models relative to your project root.
const MODELS_URL = path.join(process.cwd(), 'public', 'models');

let modelsLoaded = false;

export async function loadModels() {
  if (modelsLoaded) {
    console.log('FaceAPI models already loaded.');
    return;
  }
  try {
    console.log('Loading FaceAPI models from:', MODELS_URL);
    // Ensure these model files exist in your /public/models directory
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_URL); // Keep SsdMobilenetv1 for now, or remove if exclusively using Tiny
    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_URL); // Add TinyFaceDetector model
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_URL);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_URL);
    // Optional: await faceapi.nets.ageGenderNet.loadFromDisk(MODELS_URL);
    // Optional: await faceapi.nets.faceExpressionNet.loadFromDisk(MODELS_URL);

    modelsLoaded = true;
    console.log('FaceAPI models loaded successfully.');
  } catch (error: any) {
    console.error('Error loading FaceAPI models:', error);
    // Depending on your application, you might want to throw this error
    // or handle it in a way that allows the app to run with limited functionality.
    throw new Error(`Failed to load FaceAPI models: ${error.message}`);
  }
}

const MAX_DIMENSION = 1280;

// Function to convert image buffer to a Canvas Image element for face-api.js
export async function bufferToImage(inputBuffer: Buffer): Promise<canvas.Image> {
    let processedBuffer = inputBuffer;
    let originalWidth: number | undefined;
    let originalHeight: number | undefined;

    try {
        const metadata = await sharp(inputBuffer).metadata();
        originalWidth = metadata.width;
        originalHeight = metadata.height;

        if (originalWidth && originalHeight && (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION)) {
            console.log(`[bufferToImage] Original image dimensions ${originalWidth}x${originalHeight} exceed max dimension ${MAX_DIMENSION}px. Resizing.`);
            processedBuffer = await sharp(inputBuffer)
                .resize({
                    width: MAX_DIMENSION,
                    height: MAX_DIMENSION,
                    fit: 'inside', // 'cover' would crop, 'contain' might add padding, 'fill' would distort, 'inside' resizes down to fit
                    withoutEnlargement: true, // Do not enlarge if image is smaller than MAX_DIMENSION
                })
                .toBuffer();

            const newMetadata = await sharp(processedBuffer).metadata();
            console.log(`[bufferToImage] Image resized from ${originalWidth}x${originalHeight} to ${newMetadata.width}x${newMetadata.height}`);
        }
    } catch (sharpError) {
        console.warn(`[bufferToImage] Sharp processing (metadata/resize) failed. Using original buffer. Error:`, sharpError);
        processedBuffer = inputBuffer; // Ensure we fall back to original buffer
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = async (_error: unknown) => {
            console.warn(`[bufferToImage] Direct loading of image buffer failed (was_resized: ${processedBuffer !== inputBuffer}). Attempting PNG conversion.`);
            try {
                // Convert the image to PNG using sharp, using the (potentially resized) processedBuffer
                const pngBuffer = await sharp(processedBuffer)
                    .png() // Convert to PNG format
                    .toBuffer();
                
                // Create a temporary canvas to draw the image and then get its buffer
                // This is a workaround for some image types that might not load directly into canvas.Image
                // but can be handled by sharp and then drawn to a canvas.
                const tempCanvas = createCanvas(1, 1); // Initial small size
                const tempCtx = tempCanvas.getContext('2d');
                
                const tempImg = new Image();
                tempImg.onload = () => {
                    tempCanvas.width = tempImg.width; // Resize canvas to actual image dimensions
                    tempCanvas.height = tempImg.height;
                    tempCtx.drawImage(tempImg, 0, 0);
                    // Now use the buffer from our canvas, which should be a compatible PNG format
                    img.src = tempCanvas.toBuffer('image/png');
                    // This re-triggers img.onload, which should then resolve the main promise.
                };
                tempImg.onerror = (pngConvertErr) => {
                    console.error('[bufferToImage] Error loading image after PNG conversion:', pngConvertErr);
                    reject(pngConvertErr); // Reject the main promise if PNG conversion also fails
                };
                tempImg.src = pngBuffer; // Load the PNG buffer into tempImg
            } catch (convertErr) {
                console.error('[bufferToImage] Error during PNG conversion fallback:', convertErr);
                reject(convertErr); // Reject the main promise if sharp PNG conversion fails
            }
        };
        img.src = processedBuffer; // Assign the (possibly resized) buffer to img.src
    });
}

// Example of how to get a face descriptor (will be used in other parts)
export async function getFaceDetectorOptions() {
    // Using TinyFaceDetector for faster processing, potentially lower accuracy
    // Common inputSizes: 128, 160, 224, 320, 416, 512, 608. Larger is more accurate but slower.
    // scoreThreshold: minimum confidence score to consider a detection a face.
    return new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.5 });
}

// Initialize models on server startup (e.g., in your main server file or a global setup)
// For Next.js, this could be called in an API route when it's first hit,
// or you might need a more sophisticated way to ensure it runs once.
// For now, API routes will call loadModels() and it will run once due to the modelsLoaded flag.

// Make sure to call loadModels() before any face-api.js operations.
// For example, in an API route:
// import { loadModels, ... } from '@/lib/faceRecognition';
// await loadModels(); // Ensures models are loaded before proceeding
// const detections = await faceapi.detectAllFaces(...);

// Note: The actual model files (e.g., ssd_mobilenetv1_model-weights_manifest.json, etc.)
// must be manually downloaded and placed in the /public/models directory.
// These files are part of the face-api.js library distribution or can be downloaded from its repository.
