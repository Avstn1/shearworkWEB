/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

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
    const targetStatus = isTest ? 'DRAFT' : 'ACCEPTED'

    console.log(`🔔 QStash SMS send triggered for message: ${messageId}`)
    console.log(`📋 Mode: ${isTest ? 'TEST (DRAFT)' : 'PRODUCTION (ACCEPTED)'}`)

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

    // Fetch recipients based on test mode
    let recipients: any[] = []

    if (isTest) {
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
      
      console.log('🧪 Test mode: Sending to message creator only')
    } else {
      // Production mode: Send to all recipients
      const { data: messageRecipients, error: recipientsError } = await supabase
        .from('sms_message_recipients')
        .select('client_id, phone_number, clients(full_name)')
        .eq('message_id', messageId)

      if (recipientsError || !messageRecipients || messageRecipients.length === 0) {
        console.error('❌ Failed to fetch recipients:', recipientsError)
        return NextResponse.json(
          { success: false, error: 'No recipients found for this message' },
          { status: 404 }
        )
      }

      recipients = messageRecipients
    }

    console.log('📱 SMS Send Job Details:')
    console.log('├─ Message ID:', messageId)
    console.log('├─ User ID:', scheduledMessage.user_id)
    console.log('├─ Title:', scheduledMessage.title)
    console.log('├─ Message:', scheduledMessage.message)
    console.log('├─ Schedule:', scheduledMessage.cron_text)
    console.log('├─ Cron:', scheduledMessage.cron)
    console.log('├─ Status:', targetStatus)
    console.log('├─ Test Mode:', isTest)
    console.log('├─ Recipients:', recipients.length)
    console.log('└─ Triggered at:', new Date().toISOString())

    // Initialize Twilio client
    const client = twilio(accountSid, authToken)

    // Send SMS to each recipient
    const results = []
    let successCount = 0
    let failureCount = 0

    for (const recipient of recipients) {
      try {
        const message = await client.messages.create({
          body: scheduledMessage.message,
          messagingServiceSid: messagingServiceSid,
          to: recipient.phone_number
        })

        console.log(`✅ Sent to ${recipient.phone_number} (${recipient.clients?.full_name || 'Unknown'}) - SID: ${message.sid}`)
        
        results.push({
          phone: recipient.phone_number,
          name: recipient.clients?.full_name || 'Unknown',
          status: 'sent',
          sid: message.sid
        })
        
        successCount++
      } catch (smsError: any) {
        console.error(`❌ Failed to send to ${recipient.phone_number}:`, smsError.message)
        
        results.push({
          phone: recipient.phone_number,
          name: recipient.clients?.full_name || 'Unknown',
          status: 'failed',
          error: smsError.message
        })
        
        failureCount++
      }
    }

    console.log('📊 SMS Send Summary:')
    console.log('├─ Total Recipients:', recipients.length)
    console.log('├─ Successfully Sent:', successCount)
    console.log('├─ Failed:', failureCount)
    console.log(`└─ Success Rate: ${((successCount / recipients.length) * 100).toFixed(1)}%`)

    return NextResponse.json({
      success: true,
      message: 'SMS send job completed',
      messageId,
      userId: scheduledMessage.user_id,
      schedule: scheduledMessage.cron_text,
      status: targetStatus,
      testMode: isTest,
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
    console.error('❌ QStash SMS send error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// Wrap the handler with QStash signature verification
export const POST = verifySignatureAppRouter(handler)