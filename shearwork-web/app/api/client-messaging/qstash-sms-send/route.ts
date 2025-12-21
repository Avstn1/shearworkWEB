/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { qstashClient } from '@/lib/qstashClient'
import pMap from "p-map"

export type Recipients = {
  phone_normalized: string;
  full_name: string;
};

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
  try {
    // Get parameters from query
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    const action = searchParams.get('action')

    if (!messageId) {
      console.error('❌ Missing messageId parameter')
      return NextResponse.json(
        { success: false, error: 'Missing messageId parameter' },
        { status: 400 }
      )
    }

    // Validate Twilio credentials
    if (!accountSid || !authToken || !messagingServiceSid) {
      console.error('❌ Missing Twilio credentials')
      return NextResponse.json(
        { success: false, error: 'SMS service not configured' },
        { status: 500 }
      )
    }

    // Determine status based on action parameter
    const isTest = action === 'test'
    const isMassTest = action === 'mass_test'
    const targetStatus = isTest ? 'DRAFT' : 'ACCEPTED'

    // Fetch the scheduled message from database
    const { data: scheduledMessage, error } = await supabase
      .from('sms_scheduled_messages')
      .select('*')
      .eq('id', messageId)
      .eq('status', targetStatus)
      .single()

    if (error || !scheduledMessage) {
      console.error('❌ Failed to fetch scheduled message:', error)
      return NextResponse.json(
        { success: false, error: `Message not found with status ${targetStatus}` },
        { status: 404 }
      )
    }

    console.log('📨 Processing message:', {
      messageId,
      purpose: scheduledMessage.purpose,
      visitingType: scheduledMessage.visiting_type,
      messageLimit: scheduledMessage.message_limit
    })

    // Fetch recipients based on mode
    let recipients: Recipients[] = []

    if (isMassTest) {
      // Mass test mode: Use recipients from request body
      const clientsList = [
        {"first_name":"Carlo","last_name":"Toledo","phone_normalized":"+13653781438"},
      ];

      if (!Array.isArray(clientsList) || clientsList.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No clients provided in request body' },
          { status: 400 }
        )
      }

      recipients = clientsList
        .filter((client: any) => client.phone_normalized)
        .map((client: any) => ({
          phone_normalized: client.phone_normalized,
          full_name: `${client.first_name} ${client.last_name}`.trim(),
        }))

      if (recipients.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No valid phone numbers found in clients list' },
          { status: 400 }
        )
      }

      console.log('🧪 Mass test mode: Sending to', recipients.length, 'clients')
      
    } else if (isTest) {
      // Test mode: Send only to the message creator
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('user_id', scheduledMessage.user_id)
        .single()

      if (profileError || !profile || !profile.phone) {
        console.error('❌ Failed to fetch user profile or phone not set:', profileError)
        return NextResponse.json(
          { success: false, error: 'User phone number not found. Please set your phone number in profile settings.' },
          { status: 404 }
        )
      }

      recipients = [{
        phone_normalized: profile.phone,
        full_name: profile.full_name || 'User'
      }]
      
    } else { 
      // Production mode: Determine algorithm based on message purpose
      const algorithm = scheduledMessage.purpose === 'mass' 
        ? 'mass' 
        : scheduledMessage.purpose === 'campaign' 
          ? 'campaign' 
          : 'overdue';
      const limit = scheduledMessage.message_limit || 100;

      console.log(`📊 Fetching recipients with ${algorithm} algorithm, limit: ${limit}`);

      const apiUrl = scheduledMessage.visiting_type 
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/client-messaging/preview-recipients?limit=${limit}&userId=${scheduledMessage.user_id}&visitingType=${scheduledMessage.visiting_type}&algorithm=${algorithm}`
        : `${process.env.NEXT_PUBLIC_SITE_URL}/api/client-messaging/preview-recipients?limit=${limit}&userId=${scheduledMessage.user_id}&algorithm=${algorithm}`;
        
      console.log('🔗 API URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch recipients:', errorText);
        throw new Error('Failed to load recipients');
      }

      const data = await response.json();
      console.log('✅ Recipients fetched:', {
        count: data.phoneNumbers?.length || 0,
        algorithm,
        limit
      });

      recipients = data.phoneNumbers || [];

      if (recipients.length === 0) {
        console.warn('⚠️ No recipients found for this message');
        return NextResponse.json({
          success: true,
          message: 'No recipients found',
          messageId,
          recipientCount: 0,
          timestamp: new Date().toISOString(),
        })
      }

      console.log('📱 Sending to', recipients.length, 'recipients');
    }
    
    // Enqueue SMS messages
    const queue = qstashClient.queue({
      queueName: `sms-queue-${scheduledMessage.user_id}`,
    })    

    console.log('📤 Enqueueing', recipients.length, 'SMS messages');

    await pMap(
      recipients,
      recipient =>
        queue.enqueueJSON({
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/client-messaging/enqueue-sms`,
          body: {
            messageId: scheduledMessage.id,
            message: scheduledMessage.message,
            phone_normalized: recipient.phone_normalized
          }
        }),
      { concurrency: 15 }
    )

    console.log('✅ SMS send job completed successfully');

    return NextResponse.json({
      success: true,
      message: 'SMS send job completed',
      messageId,
      recipientCount: recipients.length,
      timestamp: new Date().toISOString(),
    })

  } catch (err: any) {
    console.error('❌ SMS send error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// Export POST with conditional signature verification
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  if (action === 'test' || action === 'mass_test') {
    return handler(request)
  }
  
  return verifySignatureAppRouter(handler)(request)
}