// /app/(api)/api/client-messaging/save-sms-schedule/route.ts

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { qstashClient } from '@/lib/qstashClient'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { adjustCredits, InsufficientCreditsError } from '@/lib/credits'

const MAX_CAMPAIGN_RECIPIENTS = 10000

/** A client-supplied reservation amount must be a positive integer within the client limit. */
function parseReservationAmount(previewCount: unknown, clientLimit: unknown): number | null {
  const amount = Number(previewCount)
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_CAMPAIGN_RECIPIENTS) return null
  const limit = Number(clientLimit)
  if (Number.isFinite(limit) && limit > 0 && amount > limit) return null
  return amount
}

/**
 * Returns credits held by an unfinished campaign to the barber's available balance.
 * Claims the reservation first (credits_reserved -> 0) so concurrent calls release once.
 * Legacy rows (reserved before credits_reserved existed) release message_limit, capped
 * by the barber's current reserved balance.
 */
async function releaseReservation(messageId: string, userId: string, reason: string) {
  const admin = createSupabaseAdminClient()
  const { data: row } = await admin
    .from('sms_scheduled_messages')
    .select('*')
    .eq('id', messageId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!row || row.is_finished || row.purpose === 'auto-nudge') return 0

  let amount = Number(row.credits_reserved ?? 0)
  if (amount > 0) {
    const { data: claimed } = await admin
      .from('sms_scheduled_messages')
      .update({ credits_reserved: 0 })
      .eq('id', messageId)
      .eq('credits_reserved', amount)
      .select('id')
    if (!claimed || claimed.length === 0) return 0
  } else {
    // Activated before credits_reserved was tracked
    if (row.status !== 'ACCEPTED') return 0
    const { data: profile } = await admin
      .from('profiles')
      .select('reserved_credits')
      .eq('user_id', userId)
      .single()
    amount = Math.min(Number(row.message_limit ?? 0), Number(profile?.reserved_credits ?? 0))
    if (amount <= 0) return 0
  }

  await adjustCredits({
    userId,
    availableDelta: amount,
    reservedDelta: -amount,
    action: `${reason} - ${row.title || 'Untitled'}`,
    referenceId: messageId,
  }, admin)
  return amount
}

/** Records how many credits this campaign holds (no-op before the migration). */
async function setReservation(messageId: string, amount: number) {
  const admin = createSupabaseAdminClient()
  const { error } = await admin
    .from('sms_scheduled_messages')
    .update({ credits_reserved: amount })
    .eq('id', messageId)
  if (error && error.code !== '42703' && error.code !== 'PGRST204') {
    console.error('Failed to record credits_reserved:', error)
  }
}


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
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shearwork-web.vercel.app'
    
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

async function deleteQStashMessage(messageId: string) {
  if (!messageId) return

  try {
    await qstashClient.messages.delete(messageId)
    console.log('✅ QStash message deleted:', messageId)
  } catch (error) {
    console.error('❌ Failed to delete QStash message:', error)
    throw error
  }
}

async function deleteMultipleQStashSchedules(scheduleIds: string[]) {
  if (!scheduleIds || scheduleIds.length === 0) return

  const deletePromises = scheduleIds.map(id => deleteQStashSchedule(id))
  await Promise.all(deletePromises)
  console.log(`✅ Deleted ${scheduleIds.length} QStash schedules`)
}

async function deleteMultipleQStashMessages(messageIds: string[]) {
  if (!messageIds || messageIds.length === 0) return

  const deletePromises = messageIds.map(id => deleteQStashMessage(id))
  await Promise.all(deletePromises)
  console.log(`✅ Deleted ${messageIds.length} QStash messages`)
}

// Updated DELETE endpoint
export async function DELETE(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const { id, softDelete } = await request.json()

    // Get message to check for QStash schedules and if it's finished
    const { data: message } = await supabase
      .from('sms_scheduled_messages')
      .select('qstash_schedule_ids, is_finished, cron')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    // Delete QStash schedules/messages if exist
    if (message.qstash_schedule_ids && message.qstash_schedule_ids.length > 0) {
      // Determine if these are recurring schedules or one-time messages
      // One-time messages have ISO date format in cron field (e.g., "2025-01-15T10:00:00Z")
      const isOneTime = message.cron && /^\d{4}-\d{2}-\d{2}T/.test(message.cron)
      
      try {
        if (isOneTime) {
          console.log('🗑️ Deleting one-time messages:', message.qstash_schedule_ids)
          await deleteMultipleQStashMessages(message.qstash_schedule_ids)
        } else {
          console.log('🗑️ Deleting recurring schedules:', message.qstash_schedule_ids)
          await deleteMultipleQStashSchedules(message.qstash_schedule_ids)
        }
      } catch (error) {
        console.error('❌ Failed to delete QStash schedules/messages:', error)
        // Proceed with deletion in database even if QStash deletion fails
      }

    }

    // Return any credits this unfinished campaign was holding
    await releaseReservation(id, user.id, 'Campaign deleted')

    // Determine whether to soft delete or hard delete
    const shouldSoftDelete = softDelete || message.is_finished;

    if (shouldSoftDelete) {
      // Soft delete - mark as deleted but keep in database
      const { error } = await supabase
        .from('sms_scheduled_messages')
        .update({ 
          is_deleted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      console.log(`✅ Soft deleted message: ${id}`)
      return NextResponse.json({ success: true, softDeleted: true })
    } else {
      // Hard delete - actually remove from database
      const { error } = await supabase
        .from('sms_scheduled_messages')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      console.log(`✅ Hard deleted message: ${id}`)
      return NextResponse.json({ success: true, softDeleted: false })
    }
  } catch (err: any) {
    console.error('❌ Delete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
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

    console.log("User id: " + user.id)

    // Validate reservation amounts up front; credits are reserved per message below
    for (const msg of messages) {
      if (msg.validationStatus === 'ACCEPTED' && msg.previewCount !== undefined && msg.previewCount !== null) {
        if (parseReservationAmount(msg.previewCount, msg.clientLimit) === null) {
          return NextResponse.json(
            { success: false, error: 'Invalid recipient count' },
            { status: 400 }
          )
        }
      }
    }

    // Process each message (upsert by id)
    const upsertPromises = messages.map(async (msg: any) => {
      let reservedAmount = 0
      try {
        // Any credits this message already holds go back first (re-activation or draft)
        await releaseReservation(msg.id, user.id, 'Campaign reservation released')

        const amount = msg.validationStatus === 'ACCEPTED'
          ? parseReservationAmount(msg.previewCount, msg.clientLimit)
          : null
        if (amount) {
          await adjustCredits({
            userId: user.id,
            availableDelta: -amount,
            reservedDelta: amount,
            action: `Campaign activated - ${msg.title || 'Untitled Message'}`,
            referenceId: msg.id,
          })
          reservedAmount = amount
          console.log(`✅ Reserved ${amount} credits for message ${msg.id}`)
        }

        let cronValue: string
        let cronText: string
        let qstashScheduleIds: string[] = []

        // DETERMINE IF THIS IS ONE-TIME (campaign) OR RECURRING (auto-nudge)
        const isOneTime = msg.scheduledFor !== undefined
        const isRecurring = !isOneTime && msg.frequency && (msg.dayOfMonth || msg.dayOfWeek)

        if (isOneTime) {
          // ===== ONE-TIME CAMPAIGN MESSAGE =====
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
              
              const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://shearwork-web.vercel.app'
              
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

        } else if (isRecurring) {
          // ===== RECURRING AUTO-NUDGE MESSAGE =====
          
          // Convert 12hr to 24hr for cron
          let hour24 = msg.hour ?? 10;

          // Only convert if we have a period (AM/PM) and hour is in 12hr format (1-12)
          if (msg.period && msg.hour >= 1 && msg.hour <= 12) {
            if (msg.period === 'PM' && msg.hour !== 12) {
              hour24 = msg.hour + 12;
            } else if (msg.period === 'AM' && msg.hour === 12) {
              hour24 = 0;
            } else {
              hour24 = msg.hour;
            }
          } else if (msg.hour >= 0 && msg.hour <= 23) {
            // Already in 24hr format, use as-is
            hour24 = msg.hour;
          }

          console.log('🔍 Time conversion:', {
            input: `${msg.hour}:${msg.minute} ${msg.period}`,
            hour24: hour24,
            minute: msg.minute
          });

          // Generate cron expression(s)
          const cronExpressions = generateCronExpressions(
            msg.frequency,
            msg.dayOfWeek,
            msg.dayOfMonth,
            hour24,
            msg.minute
          )

          // Store first cron as the primary value
          cronValue = cronExpressions[0]
          
          // Generate human-readable text
          cronText = getCronText(
            msg.frequency,
            msg.dayOfWeek,
            msg.dayOfMonth,
            hour24,
            msg.minute
          )

          console.log('🔄 Saving recurring schedule:', {
            frequency: msg.frequency,
            cron: cronValue,
            text: cronText
          })

          // Create QStash schedules if ACCEPTED
          if (msg.validationStatus === 'ACCEPTED') {
            const schedulePromises = cronExpressions.map(cron => 
              createQStashSchedule(msg.id, cron)
            )
            qstashScheduleIds = await Promise.all(schedulePromises)
            console.log(`✅ Created ${qstashScheduleIds.length} QStash schedule(s)`)
          }

        } else {
          throw new Error('Invalid message format: missing schedule information')
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
            // DRAFT - delete any existing schedules/messages
            if (existing.qstash_schedule_ids && existing.qstash_schedule_ids.length > 0) {
              // Determine if these are recurring schedules or one-time messages
              // One-time messages have ISO date format in cron field (e.g., "2025-01-15T10:00:00Z")
              const isOneTime = existing.cron && /^\d{4}-\d{2}-\d{2}T/.test(existing.cron)
              
              if (isOneTime) {
                console.log('🗑️ Deleting one-time messages:', existing.qstash_schedule_ids)
                await deleteMultipleQStashMessages(existing.qstash_schedule_ids)
              } else {
                console.log('🗑️ Deleting recurring schedules:', existing.qstash_schedule_ids)
                await deleteMultipleQStashSchedules(existing.qstash_schedule_ids)
              }
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
              purpose: msg.purpose
            })
            .eq('id', msg.id)
            .select()
            .single()

          if (error) throw error
          if (reservedAmount) await setReservation(msg.id, reservedAmount)
          return { success: true, data }
          
        } else {
          console.log(msg.startDate)
          console.log(msg.endDate)
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
              start_date: msg.start_date,
              end_date: msg.end_date
            })
            .select()
            .single()

          if (error) throw error
          if (reservedAmount) await setReservation(msg.id, reservedAmount)
          return { success: true, data }
        }
        
      } catch (error: any) {
        console.error('Failed to save message:', error)
        if (reservedAmount) {
          await adjustCredits({
            userId: user.id,
            availableDelta: reservedAmount,
            reservedDelta: -reservedAmount,
            action: `Campaign activation failed - ${msg.title || 'Untitled Message'}`,
            referenceId: msg.id,
          }).catch(refundError => console.error('Failed to undo reservation:', refundError))
        }
        if (error instanceof InsufficientCreditsError) {
          return { success: false, error: 'Insufficient credits' }
        }
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
    const purposes = searchParams.getAll('purpose');
    const excludeDeleted = searchParams.get('excludeDeleted') === 'true';
    
    let query = supabase
      .from('sms_scheduled_messages')
      .select('*')
      .eq('user_id', user.id)
      .in('purpose', purposes);

    // Exclude soft-deleted messages if requested
    if (excludeDeleted) {
      query = query.eq('is_deleted', false);
    }

    const { data: messages, error } = await query.order('created_at', { ascending: true });

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
