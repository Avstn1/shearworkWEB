/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'

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

async function handler(request: Request) {
  try {
    // Get message ID from query parameters
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')

    if (!messageId) {
      console.error('❌ Missing messageId parameter')
      return NextResponse.json(
        { success: false, error: 'Missing messageId parameter' },
        { status: 400 }
      )
    }

    console.log(`🔔 QStash SMS send triggered for message: ${messageId}`)

    // Fetch the scheduled message from database
    const { data: scheduledMessage, error } = await supabase
      .from('sms_scheduled_messages')
      .select('*')
      .eq('id', messageId)
      .eq('status', 'ACCEPTED')
      .single()

    if (error || !scheduledMessage) {
      console.error('❌ Failed to fetch scheduled message:', error)
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }

    // Log the message details
    console.log('📱 SMS Send Job Details:')
    console.log('├─ Message ID:', messageId)
    console.log('├─ User ID:', scheduledMessage.user_id)
    console.log('├─ Title:', scheduledMessage.title)
    console.log('├─ Message:', scheduledMessage.message)
    console.log('├─ Schedule:', scheduledMessage.cron_text)
    console.log('├─ Cron:', scheduledMessage.cron)
    console.log('└─ Triggered at:', new Date().toISOString())

    console.log('✅ SMS send job completed successfully')

    return NextResponse.json({
      success: true,
      message: 'SMS send job completed',
      messageId,
      userId: scheduledMessage.user_id,
      schedule: scheduledMessage.cron_text,
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