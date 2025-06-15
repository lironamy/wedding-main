import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Contact from '@/models/Contact';
import { signToken } from '@/app/utils/jwt';

export async function POST(request: Request) {
    try {
        await dbConnect();

        const { token } = await request.json();
        if (!token) {
            return NextResponse.json({ message: 'Invitation token is required' }, { status: 400 });
        }

        // Find the contact with this invitation token
        const contact = await Contact.findOne({ invitationToken: token });
        if (!contact) {
            return NextResponse.json({ message: 'Invalid invitation token' }, { status: 401 });
        }

        // Find or create the guest user
        let guestUser = contact.guestUser ? await User.findById(contact.guestUser) : null;
        if (!guestUser) {
            guestUser = await User.findOne({ phoneNumber: contact.phoneNumber, userType: 'guest' });
        }

        if (!guestUser) {
            return NextResponse.json({ message: 'Guest user not found' }, { status: 401 });
        }

        // Create a session token for the guest
        const sessionToken = signToken({ id: guestUser._id });

        // Set the token in a cookie
        const response = NextResponse.json({ success: true }, { status: 200 });
        response.cookies.set('token', sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 // 30 days
        });

        return response;
    } catch (error) {
        console.error('Guest login error:', error);
        return NextResponse.json({ message: 'Authentication failed' }, { status: 500 });
    }
} 