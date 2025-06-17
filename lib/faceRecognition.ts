import * as faceapi from 'face-api.js';
import * as canvas from 'canvas';
import path from 'path';
import { Canvas, createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';
import fetch from 'node-fetch';

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
    // Load both detectors for better accuracy
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_URL),
      faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_URL)
    ]);

    modelsLoaded = true;
    console.log('FaceAPI models loaded successfully.');
  } catch (error: any) {
    console.error('Error loading FaceAPI models:', error);
    throw new Error(`Failed to load FaceAPI models: ${error.message}`);
  }
}

const MAX_DIMENSION = 1200;

// Function to convert image buffer to a Canvas Image element for face-api.js
export async function bufferToImage(buffer: Buffer): Promise<canvas.Image> {
    const image = new canvas.Image();
    return new Promise((resolve, reject) => {
        image.onload = () => {
            // Create a canvas with appropriate dimensions
            const maxDimension = 1600; // Increased from 1200
            let width = image.width;
            let height = image.height;
            
            // Calculate new dimensions while maintaining aspect ratio
            if (width > height && width > maxDimension) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
            } else if (height > maxDimension) {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
            }

            // Create canvas and context
            const cvs = canvas.createCanvas(width, height);
            const ctx = cvs.getContext('2d');

            // Apply image processing for better face detection
            ctx.imageSmoothingEnabled = true;

            // Draw image with proper dimensions
            ctx.drawImage(image, 0, 0, width, height);

            // Convert back to image
            const processedImage = new canvas.Image();
            processedImage.src = cvs.toDataURL();
            
            resolve(processedImage);
        };
        image.onerror = (err) => reject(err);
        image.src = buffer;
    });
}

// Example of how to get a face descriptor (will be used in other parts)
export function getFaceDetectorOptions(detector: 'ssd' | 'tiny' = 'ssd') {
    if (detector === 'tiny') {
        return new faceapi.TinyFaceDetectorOptions({
            inputSize: 800,
            scoreThreshold: 0.2
        });
    }
    return new faceapi.SsdMobilenetv1Options({
        minConfidence: 0.2,
        maxResults: 20
    });
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
