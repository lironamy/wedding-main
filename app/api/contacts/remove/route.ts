import { NextResponse } from 'next/server';
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt';
import dbConnect from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import Contact, { IContact } from '@/models/Contact';

interface RemoveContactRequest {
    phoneNumber: string;
}

export async function POST(request: Request) {
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
        if (!user || user.userType !== 'bride/groom') {
            return NextResponse.json({ message: 'Unauthorized. Only bride/groom can remove contacts.' }, { status: 403 });
        }

        const { phoneNumber } = await request.json() as RemoveContactRequest;
        if (!phoneNumber) {
            return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
        }

        const result = await Contact.deleteOne({ phoneNumber });
        if (result.deletedCount === 0) {
            return NextResponse.json({ message: 'Contact not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Contact removed successfully' });
    } catch (error) {
        console.error('Error removing contact:', error);
        return NextResponse.json({ message: 'Error removing contact' }, { status: 500 });
    }
} 