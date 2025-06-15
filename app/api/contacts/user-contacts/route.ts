import { NextResponse } from 'next/server';
import { verifyToken } from '@/app/utils/jwt';
import dbConnect from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import Contact, { IContact } from '@/models/Contact';

export async function GET(request: Request) {
    try {
        await dbConnect();

        // Get token from Authorization header
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.split(' ')[1];
        
        if (!token) {
            return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
        }

        const decoded = verifyToken(token) as { id: string };
        if (!decoded || !decoded.id) {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }

        const user = await User.findById(decoded.id) as IUser | null;
        if (!user || user.userType !== 'bride/groom') {
            return NextResponse.json({ message: 'Unauthorized. Only bride/groom can view contacts.' }, { status: 403 });
        }

        // Find all contacts for this user (both old contacts without createdBy and new contacts with createdBy)
        const contacts = await Contact.find({
            $or: [
                { createdBy: user._id }, // New contacts with createdBy field
                { createdBy: { $exists: false } } // Old contacts without createdBy field
            ]
        })
        .sort({ createdAt: -1 }) // Sort by newest first
        .select('name phoneNumber invitationSent invitationToken guestUser notifyNewPhotos createdAt');

        // Update old contacts to include createdBy field
        const updatePromises = contacts
            .filter(contact => !contact.createdBy)
            .map(contact => 
                Contact.findByIdAndUpdate(
                    contact._id,
                    { createdBy: user._id },
                    { new: true }
                )
            );

        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
        }

        return NextResponse.json({ contacts }, { status: 200 });
    } catch (error) {
        console.error('Error fetching user contacts:', error);
        return NextResponse.json(
            { message: 'Error fetching contacts' },
            { status: 500 }
        );
    }
} 