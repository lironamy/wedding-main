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

        // Find all photos with detailed information
        const photos = await Photo.find({})
            .select('imageUrl detectedFaces isProcessed')
            .populate({
                path: 'detectedFaces.matchedUser',
                select: 'name',
                model: 'User'
            })
            .lean();

        // Format the photos for response with detailed status
        const allPhotos = photos.map(photo => ({
            photoUrl: photo.imageUrl,
            isProcessed: photo.isProcessed,
            totalFacesDetected: photo.detectedFaces.length,
            matchedFaces: (photo.detectedFaces as IDetectedFace[]).filter((face: IDetectedFace) => face.matchedUser).length,
            unmatchedFaces: (photo.detectedFaces as IDetectedFace[]).filter((face: IDetectedFace) => !face.matchedUser).length,
            status: !photo.isProcessed ? 'Not Processed' :
                   photo.detectedFaces.length === 0 ? 'No Faces Detected' :
                   (photo.detectedFaces as IDetectedFace[]).some((face: IDetectedFace) => face.matchedUser) ? 'Has Matches' :
                   'All Faces Unmatched',
            guestNames: (photo.detectedFaces as IDetectedFace[])
                .filter((face: any) => face.matchedUser && face.matchedUser.name)
                .map((face: any) => face.matchedUser.name)
        }));

        return NextResponse.json({ photos: allPhotos }, { status: 200 });
    } catch (error) {
        console.error('Error fetching all photos:', error);
        return NextResponse.json({ 
            message: 'Error fetching photos',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
} 