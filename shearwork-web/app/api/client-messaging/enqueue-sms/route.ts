import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

async function handler(request: Request) {
  const { messageId, user_id, purpose, message, phone_normalized } = await request.json();
  
  try {
    // Validate required fields
    if (!message || !phone_normalized) {
      return Response.json(
        { error: 'Missing required fields: message and phone_normalized' },
        { status: 400 }
      );
    }

    // Validate Twilio credentials
    if (!accountSid || !authToken || !messagingServiceSid) {
      console.error('❌ Missing Twilio credentials')
      return NextResponse.json(
        { success: false, error: 'SMS service not configured' },
        { status: 500 }
      )
    }
    
    const twilio_client = twilio(accountSid, authToken)

    const statusCallbackUrl = new URL(`${process.env.NEXT_PUBLIC_SITE_URL}/api/client-messaging/sms-status`);
    statusCallbackUrl.searchParams.set('messageId', messageId);
    statusCallbackUrl.searchParams.set('user_id', user_id);
    statusCallbackUrl.searchParams.set('purpose', purpose);

    const twilioMessage = await twilio_client.messages.create({
      body: `${message}\n\nReply STOP to unsubscribe.`,
      messagingServiceSid: messagingServiceSid,
      to: phone_normalized,
      statusCallback: statusCallbackUrl.toString()
    });

    console.log('✅ SMS sent:', twilioMessage.sid, 'to', phone_normalized)

    return Response.json(
      { success: true, messageSid: twilioMessage.sid },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error sending SMS:', error)
    return Response.json(
      { 
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Wrap with QStash signature verification
export const POST = verifySignatureAppRouter(handler)