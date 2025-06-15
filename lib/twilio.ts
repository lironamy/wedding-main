import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER; // This should be your Twilio WhatsApp-enabled number

if (!accountSid || !authToken || !fromPhoneNumber) {
  console.error('Twilio environment variables are not fully configured.');
  // Optionally throw an error to prevent the app from starting/using Twilio if critical
  // throw new Error('Twilio environment variables must be set.');
}

const client = twilio(accountSid, authToken);

interface SendWhatsAppMessageResponse {
  success: boolean;
  sid?: string;
  error?: string;
}

// Helper function to format phone number to E.164
function formatPhoneNumber(phone: string): string {
  // Remove any non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If the number starts with 0, replace it with +972
  if (digits.startsWith('0')) {
    return `+972${digits.slice(1)}`;
  }
  
  // If the number doesn't start with +, add it
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }
  
  return phone;
}

export async function sendWhatsAppMessage(to: string, body: string): Promise<SendWhatsAppMessageResponse> {
  if (!accountSid || !authToken || !fromPhoneNumber) {
    return { success: false, error: 'Twilio service is not configured.' };
  }

  try {
    // Format both the 'from' and 'to' numbers to E.164 format
    const formattedFrom = formatPhoneNumber(fromPhoneNumber);
    const formattedTo = formatPhoneNumber(to);

    const message = await client.messages.create({
      from: `whatsapp:${formattedFrom}`,
      to: `whatsapp:${formattedTo}`,
      body: body,
    });
    console.log('WhatsApp message sent successfully. SID:', message.sid);
    return { success: true, sid: message.sid };
  } catch (error: any) {
    console.error('Failed to send WhatsApp message:', error);
    const errorMessage = error?.message || 'Unknown error';
    return { success: false, error: errorMessage };
  }
}
