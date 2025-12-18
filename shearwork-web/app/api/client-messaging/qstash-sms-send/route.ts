/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { getAuthenticatedUser } from '@/utils/api-auth'
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

    // Only test mode (single user) requires authentication
    if (isTest) {
      try {
        const { user } = await getAuthenticatedUser(request)
        if (!user || !user.id) {
          return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
          )
        }
        console.log('🧪 Test mode: Authenticated user:', user.id)
      } catch (authError) {
        console.error('❌ Authentication failed:', authError)
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

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

    // Fetch recipients based on mode
    let recipients: any[] = []

    if (isMassTest) {
      // Mass test mode: Use recipients from request body
      const clientsList = [{"first_name":"Carlo","last_name":"Toledo","phone_normalized":"+13653781438"},
                           {"first_name":"Austin","last_name":"Bartolome","phone_normalized":"+16474566099"}];

      if (!Array.isArray(clientsList) || clientsList.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No clients provided in request body' },
          { status: 400 }
        )
      }

      // Filter out clients without phone numbers and format for sending
      recipients = clientsList
        .filter((client: any) => client.phone_normalized)
        .map((client: any) => ({
          phone_number: client.phone_normalized,
          clients: { 
            full_name: `${client.first_name} ${client.last_name}`.trim() 
          }
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
        phone_number: profile.phone,
        clients: { full_name: profile.full_name || 'Test User' }
      }]
      
    } else { 
      const response = await fetch('/api/client-messaging/preview-recipients?limit=25');

      if (!response.ok) {
        throw new Error('Failed to load preview');
      }

      const data = await response.json();

      recipients = data.phoneNumbers 
    }

    // Initialize Twilio client
    const client = twilio(accountSid, authToken)

    // Send SMS to each recipient
    const results = []
    let successCount = 0
    let failureCount = 0

    for (const recipient of recipients) {
      try {
        const message = await client.messages.create({
          body: `${scheduledMessage.message}\n\nReply STOP to unsubscribe.`,
          messagingServiceSid: messagingServiceSid,
          to: recipient.phone_number
        })

        results.push({
          phone: recipient.phone_number,
          name: recipient.clients?.full_name || 'Unknown',
          status: 'sent',
          sid: message.sid
        })
        
        successCount++
      } catch (smsError: any) {
        results.push({
          phone: recipient.phone_number,
          name: recipient.clients?.full_name || 'Unknown',
          status: 'failed',
          error: smsError.message
        })
        
        failureCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: 'SMS send job completed',
      messageId,
      userId: scheduledMessage.user_id,
      schedule: scheduledMessage.cron_text,
      status: targetStatus,
      testMode: isTest || isMassTest,
      massTest: isMassTest,
      stats: {
        total: recipients.length,
        sent: successCount,
        failed: failureCount,
        successRate: `${((successCount / recipients.length) * 100).toFixed(1)}%`
      },
      results,
      timestamp: new Date().toISOString(),
    })

  } catch (err: any) {
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
  
  if (action === 'test') {
    return handler(request)
  }
  
  return verifySignatureAppRouter(handler)(request)
}