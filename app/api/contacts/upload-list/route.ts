import { NextResponse } from 'next/server';
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt';
import dbConnect from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import Contact, { IContact } from '@/models/Contact';
import { randomBytes } from 'crypto'; // For generating unique tokens

interface ContactInput {
    name: string;
    phoneNumber: string; // Expecting E.164 format ideally, or needs normalization
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
            return NextResponse.json({ message: 'Unauthorized. Only bride/groom can upload contacts.' }, { status: 403 });
        }

        const contactsInput: ContactInput[] = await request.json();

        if (!Array.isArray(contactsInput) || contactsInput.length === 0) {
            return NextResponse.json({ message: 'No contacts provided or invalid format.' }, { status: 400 });
        }

        const results = {
            added: 0,
            updated: 0,
            skipped: 0,
            failed: 0,
            details: [] as any[],
        };

        for (const contactInput of contactsInput) {
            if (!contactInput.name || !contactInput.phoneNumber) {
                results.failed++;
                results.details.push({ contact: contactInput, status: 'Failed', reason: 'Missing name or phoneNumber.' });
                continue;
            }

            // Basic phone number normalization/validation (can be expanded)
            // For now, assume phone numbers are relatively clean. E.164 is ideal.
            // Example: remove non-digits, but this is naive for international numbers
            // const normalizedPhoneNumber = contactInput.phoneNumber.replace(/\D/g, '');

            try {
                let existingContact = await Contact.findOne({ 
                    phoneNumber: contactInput.phoneNumber,
                    createdBy: user._id // Only find contacts created by this user
                });

                if (existingContact) {
                    if (!existingContact.invitationSent) {
                        // Update name if it's different, keep existing token
                        existingContact.name = contactInput.name;
                        await existingContact.save();
                        results.updated++;
                        results.details.push({ contact: contactInput, status: 'Updated existing non-invited contact.' });
                    } else {
                        results.skipped++;
                        results.details.push({ contact: contactInput, status: 'Skipped, invitation already sent.' });
                    }
                } else {
                    const invitationToken = randomBytes(16).toString('hex');
                    const newContact = new Contact({
                        name: contactInput.name,
                        phoneNumber: contactInput.phoneNumber,
                        invitationToken: invitationToken,
                        invitationSent: false,
                        notifyNewPhotos: false,
                        createdBy: user._id // Link the contact to the user who created it
                    });
                    await newContact.save();
                    results.added++;
                    results.details.push({ contact: contactInput, status: 'Added new contact.', tokenId: newContact._id });
                }
            } catch (error: any) {
                results.failed++;
                results.details.push({ contact: contactInput, status: 'Failed', reason: error.message });
                console.error(`Error processing contact ${contactInput.phoneNumber}:`, error);
            }
        }

        return NextResponse.json({
            message: `Contacts processed: ${results.added} added, ${results.updated} updated, ${results.skipped} skipped, ${results.failed} failed.`,
            results
        }, { status: 200 });

    } catch (error: any) {
        console.error('Contact list upload error:', error);
        if (error.name === 'JsonWebTokenError') {
            return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
        }
        return NextResponse.json({ message: 'Internal server error', error: error.message }, { status: 500 });
    }
}
