import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import Photo, { IPhoto } from '@/models/Photo';
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt';

export async function GET(request: Request) {
    try {
        await dbConnect();

        const token = await getTokenFromCookie();
        if (!token) {
            return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
        }

        const decoded = verifyToken(token) as { id: string };
        if (!decoded || !decoded.id) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        const user = await User.findById(decoded.id) as IUser | null;
        if (!user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        // Find all photos uploaded by this user
        const photos = await Photo.find({ uploader: user._id })
            .sort({ createdAt: -1 }) // Sort by newest first
            .select('imageUrl cloudinaryPublicId createdAt');

        return NextResponse.json({ photos }, { status: 200 });
    } catch (error) {
        console.error('Error fetching user photos:', error);
        return NextResponse.json(
            { message: 'Error fetching photos' },
            { status: 500 }
        );
    }
} 