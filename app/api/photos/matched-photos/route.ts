import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Photo from '@/models/Photo';
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

        // Find all photos with matched faces
        const photos = await Photo.find({
            'detectedFaces.matchedUser': { $exists: true, $ne: null }
        }).populate('detectedFaces.matchedUser', 'name');

        // Format the matches
        const matches = [];
        for (const photo of photos) {
            for (const face of photo.detectedFaces) {
                if (face.matchedUser) {
                    const guest = face.matchedUser as any; // Type assertion since we populated the field
                    matches.push({
                        photoUrl: photo.imageUrl,
                        guestName: guest.name,
                        confidence: face.matchConfidence || 0
                    });
                }
            }
        }

        return NextResponse.json({ matches }, { status: 200 });
    } catch (error: any) {
        console.error('Error fetching matched photos:', error);
        return NextResponse.json({ 
            message: 'Error fetching matched photos',
            error: error.message 
        }, { status: 500 });
    }
} 