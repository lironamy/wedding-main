import { NextResponse } from 'next/server';
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt';
import dbConnect from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import Contact, { IContact } from '@/models/Contact';
import { sendWhatsAppMessage } from '@/lib/twilio'; // Your Twilio utility

// Make sure NEXT_PUBLIC_BASE_URL is set in your .env file (e.g., http://localhost:3000 or your production domain)
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function POST(request: Request) { // Changed to POST as it triggers an action
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
            return NextResponse.json({ message: 'Unauthorized. Only bride/groom can send invitations.' }, { status: 403 });
        }

        // Find contacts for whom notifyNewPhotos is false
        const unsentContacts = await Contact.find({ notifyNewPhotos: false });

        if (unsentContacts.length === 0) {
            return NextResponse.json({ message: 'No pending invitations to send.' }, { status: 200 });
        }

        const results = {
            sent: 0,
            failed: 0,
            details: [] as any[],
        };

        for (const contact of unsentContacts) {
            if (!contact.invitationToken || !contact.phoneNumber) {
                results.failed++;
                results.details.push({
                    contactName: contact.name,
                    status: 'Failed',
                    reason: 'Missing invitation token or phone number.'
                });
                continue;
            }

            const selfieUploadUrl = `${BASE_URL}/guest-photos/${contact.invitationToken}`;

            // Customize your WhatsApp message here
            const messageBody = `היי ${contact.name},

אנחנו מזמינים אותך לחתונה של ${user.name} בתאריך ${user.weddingDate} בשעה ${user.weddingTime} ב${user.weddingVenue}.

לחץ על הקישור הבא כדי לאשר את נוכחותך ולשתף תמונה:
${selfieUploadUrl}

נשמח לראותך שם!
${user.name}`;

            // Ensure contact.phoneNumber is in E.164 format (e.g., +1234567890)
            // The sendWhatsAppMessage function in lib/twilio.ts should handle the 'whatsapp:' prefix
            const whatsappResponse = await sendWhatsAppMessage(contact.phoneNumber, messageBody);

            if (whatsappResponse.success) {
                contact.notifyNewPhotos = true;
                await contact.save();
                results.sent++;
                results.details.push({
                    contactName: contact.name,
                    status: 'Sent',
                    sid: whatsappResponse.sid
                });
            } else {
                results.failed++;
                results.details.push({
                    contactName: contact.name,
                    status: 'Failed',
                    reason: whatsappResponse.error || 'Twilio API error'
                });
                console.error(`Failed to send WhatsApp to ${contact.name} (${contact.phoneNumber}): ${whatsappResponse.error}`);
            }
        }

        return NextResponse.json({
            message: `Invitations processed: ${results.sent} sent, ${results.failed} failed.`,
            results
        }, { status: 200 });

    } catch (error: any) {
        console.error('Send invitations error:', error);
        if (error.name === 'JsonWebTokenError') {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }
        return NextResponse.json({ message: 'Internal server error', error: error.message }, { status: 500 });
    }
}
