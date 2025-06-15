import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import Photo, { IPhoto } from '@/models/Photo';
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt'; // For guest auth

export async function GET(request: Request) {
    try {
        await dbConnect();

        const token = await getTokenFromCookie();
        if (!token) {
            return NextResponse.json({ message: 'Authentication required. Please log in.' }, { status: 401 });
        }

        const decodedToken = verifyToken(token) as { id: string }; // Assuming token payload has 'id'
        if (!decodedToken || !decodedToken.id) {
            return NextResponse.json({ message: 'Invalid session token.' }, { status: 401 });
        }

        const guest = await User.findById(decodedToken.id) as IUser | null;
        if (!guest || guest.userType !== 'guest') {
            // This could also be a 403 Forbidden if the user type is wrong but token is valid
            return NextResponse.json({ message: 'Unauthorized. Only guests can access their photos this way.' }, { status: 403 });
        }

        // Find photos where the guest's ID is in the matchedUser field of any detectedFace
        const photos = await Photo.find({
            'detectedFaces': {
                $elemMatch: {
                    matchedUser: guest._id
                }
            }
        })
        .sort({ createdAt: -1 }) // Optional: sort by newest first
        .select('imageUrl cloudinaryPublicId createdAt detectedFaces'); // Select fields to return

        if (!photos || photos.length === 0) {
            return NextResponse.json({ message: "No photos found featuring you at the moment. Check back later!" }, { status: 200, headers: { 'X-No-Photos': 'true'} });
        }

        // Optional: Further filter detectedFaces to only return info relevant to the current guest if needed,
        // but usually returning all detected faces in those photos is fine.

        return NextResponse.json({ photos }, { status: 200 });

    } catch (error: any) {
        console.error('Error fetching my-photos:', error);
        if (error.name === 'JsonWebTokenError') {
            return NextResponse.json({ message: 'Invalid token.' }, { status: 401 });
        }
        return NextResponse.json({ message: 'Internal server error', error: error.message }, { status: 500 });
    }
}
