import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Photo from '@/models/Photo';
import User from '@/models/User';
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt';
import { IDetectedFace } from '@/models/Photo';

interface IMatchedUser {
  _id: string;
  name: string;
}

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

        // Find all photos with matched faces
        const photos = await Photo.find({
            'detectedFaces.matchedUser': { $exists: true, $ne: null }
        }).populate({
            path: 'detectedFaces.matchedUser',
            select: 'name',
            model: 'User'
        });

        console.log('Raw photos data:', JSON.stringify(photos, null, 2));

        // Format the matches
        const matches = photos.flatMap(photo => {
            // Get all faces that have a matched user
            const matchedFaces = photo.detectedFaces.filter((face: IDetectedFace & { matchedUser?: IMatchedUser }) => 
                face.matchedUser && face.matchConfidence && face.matchConfidence > 0
            );

            console.log(`Photo ${photo._id} has ${matchedFaces.length} matched faces`);

            return matchedFaces.map((face: IDetectedFace & { matchedUser: IMatchedUser }) => {
                // Ensure matchConfidence is a number and within valid range
                const confidence = typeof face.matchConfidence === 'number' && !isNaN(face.matchConfidence) 
                    ? Math.max(0, Math.min(1, face.matchConfidence)) 
                    : 0;
                
                console.log('Face data:', {
                    photoUrl: photo.imageUrl,
                    guestName: face.matchedUser.name,
                    rawConfidence: face.matchConfidence,
                    processedConfidence: confidence,
                    type: typeof face.matchConfidence
                });

                return {
                    photoUrl: photo.imageUrl,
                    guestName: face.matchedUser.name,
                    confidence
                };
            });
        });

        console.log('Formatted matches:', JSON.stringify(matches, null, 2));

        return NextResponse.json({ matches }, { status: 200 });
    } catch (error: any) {
        console.error('Error fetching matched photos:', error);
        return NextResponse.json({ 
            message: 'Error fetching matched photos',
            error: error.message 
        }, { status: 500 });
    }
} 