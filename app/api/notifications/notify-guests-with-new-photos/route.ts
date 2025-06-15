import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User, { IUser } from '@/models/User';
import Photo, { IPhoto } from '@/models/Photo';
import { sendWhatsAppMessage } from '@/lib/twilio';
import { getTokenFromCookie, verifyToken } from '@/app/utils/jwt'; // For main user auth

// Make sure NEXT_PUBLIC_BASE_URL is set in your .env file
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function POST(request: Request) { // POST request to trigger notifications
    try {
        await dbConnect();

        // Authenticate the main user (bride/groom) initiating this action
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
            return NextResponse.json({ message: 'Unauthorized: Only main users can trigger notifications.' }, { status: 403 });
        }

        const guests = await User.find({ userType: 'guest', isVerified: true, phoneNumber: { $exists: true } }) as IUser[];

        let notificationsSentCount = 0;
        let errorsCount = 0;
        const notificationDetails = [];

        for (const guest of guests) {
            // Find photos where this guest is matched AND they haven't been notified about it yet.
            const photosWithNewMatchesForGuest = await Photo.find({
                'detectedFaces.matchedUser': guest._id, // Guest is matched in the photo
                isProcessed: true, // Photo has been processed
                notifiedGuests: { $ne: guest._id } // Guest ID is NOT in the notifiedGuests array
            }).select('_id imageUrl'); // Only select IDs and URLs for the message, if needed.

            if (photosWithNewMatchesForGuest.length > 0) {
                const myPhotosUrl = `${BASE_URL}/my-photos`; // Link to the generic "my photos" page
                const messageBody = `Hi ${guest.name},\nGood news! We've found ${photosWithNewMatchesForGuest.length} new photo(s) from the wedding that feature you. ✨\n\nView your photos here: ${myPhotosUrl}\n\nBest,\n${mainUser.name || 'The Happy Couple'}`;

                // Ensure phone number is valid and in E.164 format for Twilio
                if (guest.phoneNumber) {
                    const whatsappResponse = await sendWhatsAppMessage(guest.phoneNumber, messageBody);
                    if (whatsappResponse.success) {
                        notificationsSentCount++;
                        notificationDetails.push({ guestName: guest.name, status: 'Notified', photosFound: photosWithNewMatchesForGuest.length });

                        // Update these photos to mark this guest as notified
                        const photoIdsToUpdate = photosWithNewMatchesForGuest.map(p => p._id);
                        await Photo.updateMany(
                            { _id: { $in: photoIdsToUpdate } },
                            { $addToSet: { notifiedGuests: guest._id } } // Add guest to notifiedGuests array
                        );
                    } else {
                        errorsCount++;
                        notificationDetails.push({ guestName: guest.name, status: 'Failed to notify', reason: whatsappResponse.error });
                        console.error(`Failed to send WhatsApp to ${guest.name} (${guest.phoneNumber}): ${whatsappResponse.error}`);
                    }
                } else {
                    errorsCount++;
                    notificationDetails.push({ guestName: guest.name, status: 'Skipped', reason: 'Missing phone number.' });
                }
            } else {
                 notificationDetails.push({ guestName: guest.name, status: 'No new photos to notify about.' });
            }
        }

        if (notificationsSentCount === 0 && errorsCount === 0 && guests.length > 0) {
             return NextResponse.json({ message: 'No new photo notifications to send out at this time for any guest.', details: notificationDetails }, { status: 200 });
        }

        return NextResponse.json({
            message: `Notification process complete. Sent ${notificationsSentCount} new notifications. Encountered ${errorsCount} errors.`,
            details: notificationDetails
        }, { status: 200 });

    } catch (error) {
        console.error('Error in notify guests endpoint:', error);
        if (error instanceof Error && error.name === 'JsonWebTokenError') {
            return NextResponse.json({ message: 'Invalid token for main user' }, { status: 401 });
        }
        return NextResponse.json({ 
            message: 'Internal server error during notification process.', 
            error: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}
