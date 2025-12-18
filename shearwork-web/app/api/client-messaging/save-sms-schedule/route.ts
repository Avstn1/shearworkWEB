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
      // All messages need content
      if (!msg.message || msg.message.trim().length < 100) {
        return NextResponse.json(
          { success: false, error: 'Message must be at least 100 characters' },
          { status: 400 }
        )
      }

      // Only ACCEPTED messages need validation approval
      if (msg.validationStatus === 'ACCEPTED') {
        if (!msg.isValidated || msg.validationStatus !== 'ACCEPTED') {
          return NextResponse.json(
            { success: false, error: 'Approved messages must be validated' },
            { status: 400 }
          )
        }
      }
    }

    // Process each message (upsert by id)
    const upsertPromises = messages.map(async (msg: any) => {
      try {
        const utcHour = msg.utcHour;
        const utcMinute = msg.utcMinute;

        // Generate multiple cron expressions (for days 29-31)
        const cronExpressions = generateCronExpressions(
          msg.frequency,
          msg.dayOfWeek,
          msg.dayOfMonth,
          msg.hour, // utcHour  
          msg.minute // utcMinute
        )
        
        // Use the first cron for display purposes (represents the primary schedule)
        const primaryCron = cronExpressions[0]
        
        const cronText = getCronText(
          msg.frequency,
          msg.dayOfWeek,
          msg.dayOfMonth,
          msg.hour,  
          msg.minute
        )

        console.log('🕐 Time conversion:', {
          localTime: `${msg.hour}:${msg.minute}`,
          utcTime: `${utcHour}:${utcMinute}`,
          cronExpressions,
          numberOfSchedules: cronExpressions.length
        })

        // Check if message already exists in database by id
        const { data: existing } = await supabase
          .from('sms_scheduled_messages')
          .select('id, qstash_schedule_ids, status, cron')
          .eq('id', msg.id)
          .eq('user_id', user.id)
          .single()

        let qstashScheduleIds: string[] = []
        
        if (existing) {
          // Always recreate schedules for existing ACCEPTED messages
          if (msg.validationStatus === 'ACCEPTED') {
            console.log('🔄 Recreating QStash schedules for ACCEPTED message')
            // Delete old schedules if exist
            if (existing.qstash_schedule_ids && existing.qstash_schedule_ids.length > 0) {
              await deleteMultipleQStashSchedules(existing.qstash_schedule_ids)
            }
            
            // Create new schedules for each cron expression
            const schedulePromises = cronExpressions.map(cron => 
              createQStashSchedule(msg.id, cron)
            )
            qstashScheduleIds = await Promise.all(schedulePromises)
            console.log(`✅ Created ${qstashScheduleIds.length} QStash schedules:`, qstashScheduleIds)
          } else {
            // Status is DRAFT - delete schedules if exist
            console.log('🗑️  Message is DRAFT - removing QStash schedules')
            if (existing.qstash_schedule_ids && existing.qstash_schedule_ids.length > 0) {
              await deleteMultipleQStashSchedules(existing.qstash_schedule_ids)
            }
            qstashScheduleIds = []
          }

          // Update existing message
          const { data, error } = await supabase
            .from('sms_scheduled_messages')
            .update({
              title: msg.title || 'Untitled Message',
              message: msg.message,
              status: msg.validationStatus,
              cron: primaryCron,
              cron_text: cronText,
              qstash_schedule_ids: qstashScheduleIds,
              visiting_type: msg.visitingType,
            })
            .eq('id', msg.id)
            .select()
            .single()

          if (error) throw error
          return { success: true, data }
        } else {
          // New message - create QStash schedules if ACCEPTED
          if (msg.validationStatus === 'ACCEPTED') {
            console.log('➕ New ACCEPTED message - creating QStash schedules')
            const schedulePromises = cronExpressions.map(cron => 
              createQStashSchedule(msg.id, cron)
            )
            qstashScheduleIds = await Promise.all(schedulePromises)
            console.log(`✅ Created ${qstashScheduleIds.length} QStash schedules:`, qstashScheduleIds)
          }

          // Insert new message with the frontend-generated id
          const { data, error } = await supabase
            .from('sms_scheduled_messages')
            .insert({
              id: msg.id,
              user_id: user.id,
              title: msg.title || 'Untitled Message',
              message: msg.message,
              status: msg.validationStatus,
              cron: primaryCron,
              cron_text: cronText,
              qstash_schedule_ids: qstashScheduleIds,
              visiting_type: msg.visitingType
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

    const { data: messages, error } = await supabase
      .from('sms_scheduled_messages')
      .select('*')
      .eq('user_id', user.id)
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