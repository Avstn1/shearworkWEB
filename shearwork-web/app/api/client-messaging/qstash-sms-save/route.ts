/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { qstashClient } from '@/lib/qstashClient'

interface Payload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: { id?: string; [key: string]: any };
  old?: { id?: string; [key: string]: any };
}

// Create a Supabase client with service role key for server-side operations
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

// Subscribe to realtime changes on sms_scheduled_messages
const channel = supabase
  .channel('sms_scheduled_messages_changes')
  .on(
    'postgres_changes',
    {
      event: '*', // Listen to INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'sms_scheduled_messages'
    },
    async (payload: Payload) => {
      console.log('🔔 Database change detected:', payload.eventType)
      console.log('📋 Payload:', payload)

      const messageId = payload.new?.id || payload.old?.id

      if (!messageId) {
        console.error('❌ No message ID found in payload')
        return
      }

      if (payload.eventType === 'INSERT') {
        await handleInsert(payload.new)
      } else if (payload.eventType === 'UPDATE') {
        await handleUpdate(payload.new, payload.old)
      } else if (payload.eventType === 'DELETE') {
        await handleDelete(payload.old)
      }
    }
  )
  .subscribe((status) => {
    console.log('📡 Realtime subscription status:', status)
  })

async function handleInsert(message: any) {
  console.log('➕ INSERT detected for message:', message.id)

  // Only create schedule if status is ACCEPTED
  if (message.status !== 'ACCEPTED') {
    console.log('⏭️  Skipping schedule creation - status is not ACCEPTED')
    return
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shearwork-web.vercel.app'
    
    const schedule = await qstashClient.schedules.create({
      destination: `${appUrl}/api/client-messaging/qstash-sms-send?messageId=${message.id}`,
      cron: message.cron,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    console.log('✅ QStash schedule created:', schedule.scheduleId)

    // Update the database with the QStash schedule ID
    const { error } = await supabase
      .from('sms_scheduled_messages')
      .update({ qstash_schedule_id: schedule.scheduleId })
      .eq('id', message.id)

    if (error) {
      console.error('❌ Failed to update qstash_schedule_id:', error)
    } else {
      console.log('✅ Updated message with qstash_schedule_id')
    }
  } catch (error) {
    console.error('❌ Failed to create QStash schedule:', error)
  }
}

async function handleUpdate(newMessage: any, oldMessage: any) {
  console.log('🔄 UPDATE detected for message:', newMessage.id)

  // Check if status changed to ACCEPTED
  const statusChangedToAccepted = 
    oldMessage.status !== 'ACCEPTED' && newMessage.status === 'ACCEPTED'

  // Check if status changed from ACCEPTED to something else
  const statusChangedFromAccepted = 
    oldMessage.status === 'ACCEPTED' && newMessage.status !== 'ACCEPTED'

  // Check if cron expression changed
  const cronChanged = oldMessage.cron !== newMessage.cron

  // If changed to ACCEPTED, create new schedule
  if (statusChangedToAccepted) {
    console.log('🆕 Status changed to ACCEPTED - creating schedule')
    await handleInsert(newMessage)
    return
  }

  // If changed from ACCEPTED, delete old schedule
  if (statusChangedFromAccepted) {
    console.log('🗑️  Status changed from ACCEPTED - deleting schedule')
    await deleteQStashSchedule(newMessage.qstash_schedule_id)
    
    // Clear qstash_schedule_id
    await supabase
      .from('sms_scheduled_messages')
      .update({ qstash_schedule_id: null })
      .eq('id', newMessage.id)
    return
  }

  // If cron changed and status is ACCEPTED, recreate schedule
  if (cronChanged && newMessage.status === 'ACCEPTED') {
    console.log('🔄 Cron changed - recreating schedule')
    
    // Delete old schedule
    if (newMessage.qstash_schedule_id) {
      await deleteQStashSchedule(newMessage.qstash_schedule_id)
    }

    // Create new schedule
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shearwork-web.vercel.app'
      const schedule = await qstashClient.schedules.create({
        destination: `${appUrl}/api/client-messaging/qstash-sms-send?messageId=${newMessage.id}`,
        cron: newMessage.cron,
        headers: {
          'Content-Type': 'application/json',
        },
      })

      console.log('✅ QStash schedule recreated:', schedule.scheduleId)

      // Update the database with new QStash schedule ID
      await supabase
        .from('sms_scheduled_messages')
        .update({ qstash_schedule_id: schedule.scheduleId })
        .eq('id', newMessage.id)

      console.log('✅ Updated message with new qstash_schedule_id')
    } catch (error) {
      console.error('❌ Failed to recreate QStash schedule:', error)
    }
  }
}

async function handleDelete(message: any) {
  console.log('🗑️  DELETE detected for message:', message.id)

  if (message.qstash_schedule_id) {
    await deleteQStashSchedule(message.qstash_schedule_id)
  } else {
    console.log('⏭️  No QStash schedule to delete')
  }
}

async function deleteQStashSchedule(scheduleId: string) {
  if (!scheduleId) return

  try {
    await qstashClient.schedules.delete(scheduleId)
    console.log('✅ QStash schedule deleted:', scheduleId)
  } catch (error) {
    console.error('❌ Failed to delete QStash schedule:', error)
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'QStash SMS Save service is running',
    subscription: channel.state,
  })
}

// Manual trigger endpoint (for testing)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { messageId, action } = body

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Missing messageId' },
        { status: 400 }
      )
    }

    const { data: message, error } = await supabase
      .from('sms_scheduled_messages')
      .select('*')
      .eq('id', messageId)
      .single()

    if (error || !message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      )
    }

    if (action === 'create') {
      await handleInsert(message)
    } else if (action === 'delete') {
      await handleDelete(message)
    }

    return NextResponse.json({
      success: true,
      message: `Action ${action} completed for message ${messageId}`,
    })
  } catch (error: any) {
    console.error('❌ Manual trigger error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}