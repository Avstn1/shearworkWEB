import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import twilio from 'twilio'

type SmsCounter = 'success' | 'fail'

async function incrementSmsCounter(
  supabase: any,
  messageId: string,
  field: SmsCounter
) {
  // 1. Fetch current value
  const { data, error: fetchError } = await supabase
    .from('sms_scheduled_messages')
    .select(field)
    .eq('id', messageId)
    .single()

  if (fetchError) throw fetchError

  const currentValue = data?.[field] ?? 0

  // 2. Increment
  const newValue = currentValue + 1

  // 3. Update
  const { error: updateError } = await supabase
    .from('sms_scheduled_messages')
    .update({ [field]: newValue })
    .eq('id', messageId)

  if (updateError) throw updateError
}

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

async function handler(request: Request) {
  const { messageId, message, phone_normalized } = await request.json();
  
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

    const twilioMessage = await twilio_client.messages.create({
      body: `${message}\n\nReply STOP to unsubscribe.`,
      messagingServiceSid: messagingServiceSid,
      to: phone_normalized
    });

    console.log('✅ SMS sent:', twilioMessage.sid, 'to', phone_normalized)

    await incrementSmsCounter(
      supabase,
      messageId,
      'success'
    )

    return Response.json(
      { success: true, messageSid: twilioMessage.sid },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Error sending SMS:', error)
    
    await incrementSmsCounter(
      supabase,
      messageId,
      'fail'
    )

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