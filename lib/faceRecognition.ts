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
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_URL);
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

// Function to convert image buffer to a Canvas Image element for face-api.js
export async function bufferToImage(buffer: Buffer): Promise<canvas.Image> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = async (_error: unknown) => {
            try {
                // Convert the image to PNG using sharp
                const pngBuffer = await sharp(buffer)
                    .png()
                    .toBuffer();
                
                // Create a temporary canvas
                const canvas = createCanvas(0, 0);
                const ctx = canvas.getContext('2d');
                
                // Load the converted PNG
                const tempImg = new Image();
                tempImg.onload = () => {
                    canvas.width = tempImg.width;
                    canvas.height = tempImg.height;
                    ctx.drawImage(tempImg, 0, 0);
                    img.src = canvas.toBuffer('image/png');
                };
                tempImg.onerror = (err) => reject(err);
                tempImg.src = pngBuffer;
            } catch (convertErr) {
                reject(convertErr);
            }
        };
        img.src = buffer;
    });
}

// Example of how to get a face descriptor (will be used in other parts)
export async function getFaceDetectorOptions() {
    // Using SSD MobileNet v1 for face detection as it's generally good and fast
    return new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
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
