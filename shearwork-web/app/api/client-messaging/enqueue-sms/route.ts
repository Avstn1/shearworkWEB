import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import twilio from 'twilio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID


export async function POST(request: Request) {
  try {
    const { message, phone_normalized } = await request.json();

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

    const twilioMessage = await twilio_client.messages.create({
      body: `${message}\n\nReply STOP to unsubscribe.`,
      messagingServiceSid: messagingServiceSid,
      to: phone_normalized
    });

    return Response.json(
      { success: true, messageSid: twilioMessage.sid },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error sending message:', error);
    return Response.json(
      { 
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}