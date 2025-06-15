import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Photo from '@/models/Photo';

// Store processing progress in memory (will reset on server restart)
const processingProgress = new Map<string, { current: number; total: number }>();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const guestId = searchParams.get('guestId');

        if (!guestId) {
            return NextResponse.json({ message: 'Guest ID is required' }, { status: 400 });
        }

        const progress = processingProgress.get(guestId);
        
        if (!progress) {
            // If no progress is found, check if there are any unprocessed photos
            await dbConnect();
            const totalUnprocessed = await Photo.countDocuments({ isProcessed: false });
            
            if (totalUnprocessed === 0) {
                return NextResponse.json({ 
                    processing: false,
                    message: 'No photos to process'
                });
            }

            // Initialize progress
            processingProgress.set(guestId, { current: 0, total: totalUnprocessed });
            return NextResponse.json({ 
                processing: true,
                current: 0,
                total: totalUnprocessed
            });
        }

        return NextResponse.json({
            processing: progress.current < progress.total,
            current: progress.current,
            total: progress.total
        });

    } catch (error) {
        console.error('Error checking processing progress:', error);
        return NextResponse.json({ 
            message: 'Error checking processing progress',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// Function to update progress (called from upload-selfie endpoint)
export function updateProgress(guestId: string, current: number, total: number) {
    processingProgress.set(guestId, { current, total });
}

// Function to clear progress (called when processing is complete)
export function clearProgress(guestId: string) {
    processingProgress.delete(guestId);
} 