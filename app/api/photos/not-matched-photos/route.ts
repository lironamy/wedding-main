import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Photo, { IDetectedFace } from '@/models/Photo';
import User from '@/models/User';
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt';

export async function GET(request: Request) {
    try {
        await dbConnect();

        // Verify main user authentication
        const token = await getTokenFromCookie();
        if (!token) {
            return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
        }
        const decodedToken = verifyToken(token) as { id: string };
        if (!decodedToken || !decodedToken.id) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }
        const mainUser = await User.findById(decodedToken.id);
        if (!mainUser || mainUser.userType !== 'bride/groom') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 403 });
        }

        // Find all photos that have been processed but have faces that weren't matched
        // Only select the fields we need
        const photos = await Photo.find({
            isProcessed: true,
            'detectedFaces': {
                $elemMatch: {
                    matchedUser: { $exists: false }
                }
            }
        })
        .select('imageUrl detectedFaces') // Only select the fields we need
        .lean(); // Use lean() for better performance

        // Format the photos for response
        const notMatchedPhotos = photos.map(photo => ({
            photoUrl: photo.imageUrl,
            detectedFaces: photo.detectedFaces.filter((face: IDetectedFace) => !face.matchedUser).length,
            guestName: 'לא זוהה',
            confidence: 0
        }));

        return NextResponse.json({ photos: notMatchedPhotos }, { status: 200 });
    } catch (error) {
        console.error('Error fetching not matched photos:', error);
        return NextResponse.json({ 
            message: 'Error fetching not matched photos',
            error: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
} 