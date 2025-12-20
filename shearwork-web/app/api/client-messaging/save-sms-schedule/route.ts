/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { qstashClient } from '@/lib/qstashClient'

// Helper function to generate multiple cron expressions for days 29-31
function generateCronExpressions(
    frequency: 'weekly' | 'biweekly' | 'monthly',
    dayOfWeek?: string,
    dayOfMonth?: number,
    hour?: number,
    minute?: number
    ): string[] {
  const h = hour ?? 10;
  const m = minute ?? 0;

  if (frequency === 'monthly') {
    const day = dayOfMonth ?? 1;

    // For days 1-28, single cron works for all months
    if (day <= 28) {
      return [`${m} ${h} ${day} * *`];
    }

    // For day 29: runs on 29th in most months, 28th in Feb
    if (day === 29) {
      return [
        `${m} ${h} 29 1,3,4,5,6,7,8,9,10,11,12 *`, // 29th in 31-day and 30-day months
        `${m} ${h} 28 2 *`, // 28th in February
      ];
    }

    // For day 30: runs on 30th in 30/31-day months, 28th in Feb
    if (day === 30) {
      return [
        `${m} ${h} 30 1,3,4,5,6,7,8,9,10,11,12 *`, // 30th in 31-day and 30-day months
        `${m} ${h} 28 2 *`, // 28th in February
      ];
    }

    // For day 31: runs on 31st in 31-day months, 30th in 30-day months, 28th in Feb
    if (day === 31) {
      return [
        `${m} ${h} 31 1,3,5,7,8,10,12 *`, // 31st in 31-day months (Jan, Mar, May, Jul, Aug, Oct, Dec)
        `${m} ${h} 30 4,6,9,11 *`, // 30th in 30-day months (Apr, Jun, Sep, Nov)
        `${m} ${h} 28 2 *`, // 28th in February
      ];
    }
  } else if (frequency === 'weekly' || frequency === 'biweekly') {
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const cronDay = dayMap[dayOfWeek?.toLowerCase() ?? 'monday'];
    return [`${m} ${h} * * ${cronDay}`];
  }

  throw new Error('Invalid frequency or day of month');
}

function getCronText(
  frequency: 'weekly' | 'biweekly' | 'monthly',
  dayOfWeek?: string,
  dayOfMonth?: number,
  hour?: number,
  minute?: number
): string {
  const h = hour ?? 10;
  const m = minute ?? 0;

  // Convert 24hr to 12hr format
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const timeStr = `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;

  if (frequency === 'monthly') {
    const day = dayOfMonth ?? 1;
    const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
    const smartNote = day > 28 ? ' (or last day of month)' : '';
    return `Every month on the ${day}${suffix}${smartNote} at ${timeStr}`;
  } else if (frequency === 'biweekly') {
    const day = dayOfWeek ? dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1) : 'Monday';
    return `Every other ${day} at ${timeStr}`;
  } else {
    const day = dayOfWeek ? dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1) : 'Monday';
    return `Every ${day} at ${timeStr}`;
  }
}

async function createQStashSchedule(messageId: string, cron: string) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shearwork-web.vercel.app'
    
    const schedule = await qstashClient.schedules.create({
      destination: `${appUrl}/api/client-messaging/qstash-sms-send?messageId=${messageId}`,
      cron: `CRON_TZ=America/Toronto ${cron}`,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    return schedule.scheduleId
  } catch (error) {
    console.error('❌ Failed to create QStash schedule:', error)
    throw error
  }
}

async function deleteQStashSchedule(scheduleId: string) {
  if (!scheduleId) return

  try {
    await qstashClient.schedules.delete(scheduleId)
    console.log('✅ QStash schedule deleted:', scheduleId)
  } catch (error) {
    console.error('❌ Failed to delete QStash schedule:', error)
    throw error
  }
}

async function deleteMultipleQStashSchedules(scheduleIds: string[]) {
  if (!scheduleIds || scheduleIds.length === 0) return

  const deletePromises = scheduleIds.map(id => deleteQStashSchedule(id))
  await Promise.all(deletePromises)
  console.log(`✅ Deleted ${scheduleIds.length} QStash schedules`)
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const body = await request.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No messages provided' },
        { status: 400 }
      )
    }

    // Validate messages based on their status
    for (const msg of messages) {
      if (msg.validationStatus === 'ACCEPTED' && msg.previewCount) {
        // 1. Get current credits
        const { data: profile } = await supabase
          .from('profiles')
          .select('available_credits, reserved_credits')
          .eq('user_id', user.id)
          .single();

        if (!profile) {
          throw new Error('Profile not found');
        }

        // 2. Verify sufficient credits
        if (profile.available_credits < msg.previewCount) {
          throw new Error('Insufficient credits');
        }

        // 3. Update credits: reserve from available
        const { error: creditError } = await supabase
          .from('profiles')
          .update({
            available_credits: profile.available_credits - msg.previewCount,
            reserved_credits: (profile.reserved_credits || 0) + msg.previewCount,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (creditError) {
          throw new Error('Failed to reserve credits');
        }

        console.log(`✅ Reserved ${msg.previewCount} credits for message ${msg.id}`);
      }
    }

    // Process each message (upsert by id)
    const upsertPromises = messages.map(async (msg: any) => {
      try {
        let cronValue: string
        let cronText: string
        let qstashScheduleIds: string[] = []

        // Use the ISO timestamp directly from frontend
        if (msg.scheduledFor) {
          cronValue = msg.scheduledFor
          
          // Parse for human readable text
          const scheduleDateTime = new Date(msg.scheduledFor)
          const dateStr = scheduleDateTime.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          })
          const timeStr = `${msg.hour}:${msg.minute.toString().padStart(2, '0')} ${msg.period}`
          cronText = `One-time on ${dateStr} at ${timeStr}`

          console.log('📅 Saving one-time schedule:', {
            iso: cronValue,
            local: scheduleDateTime.toString()
          })

          // Create QStash schedule if ACCEPTED
          if (msg.validationStatus === 'ACCEPTED') {
            const now = new Date()
            const scheduleTime = new Date(msg.scheduledFor)
            const delaySeconds = Math.floor((scheduleTime.getTime() - now.getTime()) / 1000)
            
            if (delaySeconds > 0) {
              console.log(`⏰ Scheduling one-time message with ${delaySeconds}s delay`)
              
              const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://shearwork-web.vercel.app'
              
              try {
                const response = await qstashClient.publishJSON({
                  url: `${appUrl}/api/client-messaging/qstash-sms-send?messageId=${msg.id}`,
                  delay: delaySeconds,
                  headers: {
                    'Content-Type': 'application/json',
                  },
                })
                
                qstashScheduleIds = [response.messageId]
                console.log(`✅ Created one-time QStash message: ${response.messageId}`)
              } catch (error) {
                console.error('❌ Failed to create one-time QStash message:', error)
                throw error
              }
            }
          }
        } else {
          // This shouldn't happen for campaign messages, but keeping as fallback
          throw new Error('Missing scheduledFor timestamp')
        }

        // Check if message already exists in database by id
        const { data: existing } = await supabase
          .from('sms_scheduled_messages')
          .select('id, qstash_schedule_ids, status, cron')
          .eq('id', msg.id)
          .eq('user_id', user.id)
          .single()

        if (existing) {
          // Update existing message
          if (msg.validationStatus !== 'ACCEPTED') {
            // DRAFT - delete any existing schedules
            if (existing.qstash_schedule_ids && existing.qstash_schedule_ids.length > 0) {
              await deleteMultipleQStashSchedules(existing.qstash_schedule_ids)
            }
            qstashScheduleIds = []
          }

          const { data, error } = await supabase
            .from('sms_scheduled_messages')
            .update({
              title: msg.title || 'Untitled Message',
              message: msg.message,
              status: msg.validationStatus,
              cron: cronValue,
              cron_text: cronText,
              qstash_schedule_ids: qstashScheduleIds,
              visiting_type: msg.visitingType,
              message_limit: msg.clientLimit,
            })
            .eq('id', msg.id)
            .select()
            .single()

          if (error) throw error
          return { success: true, data }
        } else {
          // Insert new message
          const { data, error } = await supabase
            .from('sms_scheduled_messages')
            .insert({
              id: msg.id,
              user_id: user.id,
              title: msg.title || 'Untitled Message',
              message: msg.message,
              status: msg.validationStatus,
              cron: cronValue,
              cron_text: cronText,
              qstash_schedule_ids: qstashScheduleIds,
              visiting_type: msg.visitingType,
              purpose: msg.purpose,
              message_limit: msg.clientLimit,
            })
            .select()
            .single()

          if (error) throw error
          return { success: true, data }
        }
        
      } catch (error: any) {
        console.error('Failed to save message:', error)
        return { success: false, error: error.message }
      }
    })

    const results = await Promise.all(upsertPromises)

    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)

    return NextResponse.json({
      success: failed.length === 0,
      created: successful.length,
      failed: failed.length,
      results,
    })

  } catch (err: any) {
    console.error('❌ SMS schedule save error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve scheduled messages
export async function GET(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const purpose = searchParams.get('purpose')
    
    const { data: messages, error } = await supabase
      .from('sms_scheduled_messages')
      .select('*')
      .eq('user_id', user.id)
      .eq('purpose', purpose)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      messages: messages || [] 
    })

  } catch (err: any) {
    console.error('❌ Failed to fetch SMS schedules:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE endpoint
export async function DELETE(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const { id } = await request.json()

    // Get message to check for QStash schedules
    const { data: message } = await supabase
      .from('sms_scheduled_messages')
      .select('qstash_schedule_ids')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    // Delete QStash schedules if exist
    if (message?.qstash_schedule_ids && message.qstash_schedule_ids.length > 0) {
      await deleteMultipleQStashSchedules(message.qstash_schedule_ids)
    }

    // Delete from database
    const { error } = await supabase
      .from('sms_scheduled_messages')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('❌ Delete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}