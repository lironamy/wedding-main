import { NextResponse } from 'next/server';
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt';
import dbConnect from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import Photo from '@/models/Photo';
import { uploadToCloudinary } from '@/lib/cloudinary'; // Assuming this function handles buffer uploads
import { NextApiRequest } from 'next'; // For formidable or other parsers if needed

// Helper to parse FormData - Next.js 13+ Edge runtime doesn't fully support formidable directly
// For Node.js runtime, you might use formidable or similar.
// For Edge, direct FormData handling is preferred.
async function parseFormData(request: Request): Promise<{ files: File[], fields: Record<string, string> }> {
    const formData = await request.formData();
    const files: File[] = [];
    const fields: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
            files.push(value);
        } else {
            fields[key] = value as string;
        }
    }
    return { files, fields };
}


export async function POST(request: Request) {
    try {
        await dbConnect();

        const token = await getTokenFromCookie();
        if (!token) {
            return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
        }

        const decoded = verifyToken(token) as { id: string; email: string; userType?: string }; // Add userType to token payload if available
        if (!decoded || !decoded.id) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        const user = await User.findById(decoded.id) as IUser | null;
        if (!user || user.userType !== 'bride/groom') {
            return NextResponse.json({ message: 'Unauthorized. Only bride/groom can upload wedding photos.' }, { status: 403 });
        }

        const { files } = await parseFormData(request);

        if (!files || files.length === 0) {
            return NextResponse.json({ message: 'No files uploaded' }, { status: 400 });
        }

        const uploadedPhotosInfo = [];

        for (const file of files) {
            // Convert File to Buffer for Cloudinary upload
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // It's good to specify a folder for organization, e.g., 'wedding_photos'
            const cloudinaryResponse = await uploadToCloudinary(buffer, 'wedding_photos');

            if (!cloudinaryResponse || !cloudinaryResponse.secure_url || !cloudinaryResponse.public_id) {
                console.error('Cloudinary upload failed for a file:', file.name);
                // Decide if you want to stop or continue with other files
                continue;
            }

            const newPhoto = new Photo({
                uploader: user._id,
                imageUrl: cloudinaryResponse.secure_url,
                cloudinaryPublicId: cloudinaryResponse.public_id,
                detectedFaces: [], // Face detection will be a separate step
            });
            await newPhoto.save();
            uploadedPhotosInfo.push({
                imageUrl: newPhoto.imageUrl,
                cloudinaryPublicId: newPhoto.cloudinaryPublicId,
                id: newPhoto._id,
            });
        }

        if (uploadedPhotosInfo.length === 0) {
            return NextResponse.json({ message: 'No files were successfully uploaded to Cloudinary.' }, { status: 500 });
        }

        return NextResponse.json({
            message: `${uploadedPhotosInfo.length} photo(s) uploaded successfully.`,
            photos: uploadedPhotosInfo
        }, { status: 201 });

    } catch (error) {
        console.error('Wedding photo upload error:', error);
        if (error.name === 'JsonWebTokenError') {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }
        // Add more specific error handling if needed (e.g., for file parsing, Cloudinary errors)
        return NextResponse.json({ message: 'Internal server error', error: error.message }, { status: 500 });
    }
}
