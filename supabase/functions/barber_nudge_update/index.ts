// supabase/functions/barber_nudge_update/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import twilio from 'npm:twilio'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
  Deno.env.get("SERVICE_ROLE_KEY") ?? '', 
)

const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")
const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")
const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID_BARBERS")
const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL")

const twilio_client = twilio(accountSid, authToken)

// Toronto timezone
const TORONTO_TZ = 'America/Toronto'

function getFirstName(fullName: string): string {
  return fullName.trim().split(' ')[0]
}

/**
 * Builds the Wednesday update message based on 3 cases:
 *
 * Case 1 — No replies, no bookings
 * Case 2 — Replies but no bookings
 * Case 3 — Replies + bookings
 */
function buildUpdateMessage(
  firstName: string,
  replyCount: number,
  bookingCount: number,
  totalRevenue: number
): string {
  if (replyCount === 0 && bookingCount === 0) {
    // Case 1
    return `Hey ${firstName} — Corva results.\n\nNo replies or bookings yet. Results may still come in.`
  }

  if (replyCount > 0 && bookingCount === 0) {
    // Case 2
    return `Hey ${firstName} — Corva results.\n\nSo far:\n• ${replyCount} client${replyCount === 1 ? '' : 's'} replied\n\nYou can view their messages in Corva.`
  }

  // Case 3 — replies + bookings
  return `Hey ${firstName} — Corva results.\n\nSo far:\n• ${replyCount} client${replyCount === 1 ? '' : 's'} replied\n• ${bookingCount} booking${bookingCount === 1 ? '' : 's'}\n• $${totalRevenue} booked\n\nYou can view their messages in Corva.`
}

function getTorontoDateComponents(date: Date = new Date()): { year: number; month: number; day: number; hours: number; minutes: number; seconds: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  return {
    year: parseInt(parts.find(p => p.type === 'year')!.value),
    month: parseInt(parts.find(p => p.type === 'month')!.value) - 1,
    day: parseInt(parts.find(p => p.type === 'day')!.value),
    hours: parseInt(parts.find(p => p.type === 'hour')!.value),
    minutes: parseInt(parts.find(p => p.type === 'minute')!.value),
    seconds: parseInt(parts.find(p => p.type === 'second')!.value),
  }
}

function getTorontoDate(date: Date = new Date()): Date {
  const c = getTorontoDateComponents(date)
  return new Date(c.year, c.month, c.day, c.hours, c.minutes, c.seconds)
}

function getCurrentDayOfWeek(): number {
  const c = getTorontoDateComponents()
  return new Date(c.year, c.month, c.day).getDay()
}

function getISOWeek(): string {
  const c = getTorontoDateComponents()
  const torontoDate = new Date(c.year, c.month, c.day)

  const day = torontoDate.getDay() || 7
  torontoDate.setDate(torontoDate.getDate() + 4 - day)

  const yearStart = new Date(torontoDate.getFullYear(), 0, 1)
  const week = Math.ceil(((+torontoDate - +yearStart) / 86400000 + 1) / 7)
  const year = torontoDate.getFullYear()

  return `${year}-W${week.toString().padStart(2, '0')}`
}

function getISOWeekDates(date: Date): { start: Date; end: Date } {
  const currentDate = new Date(date)
  const dayOfWeek = currentDate.getDay()
  
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  
  const monday = new Date(currentDate)
  monday.setDate(currentDate.getDate() + daysToMonday)
  monday.setHours(0, 0, 0, 0)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  
  return { start: monday, end: sunday }
}

function getCurrentWeekMondayAt10AM(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  const { start } = getISOWeekDates(torontoDate)
  
  const monday10am = new Date(start)
  monday10am.setHours(10, 0, 0, 0)
  
  return monday10am
}

function getCurrentWeekTuesdayStart(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  const { start } = getISOWeekDates(torontoDate)

  const tuesday = new Date(start)
  tuesday.setDate(start.getDate() + 1)
  tuesday.setHours(0, 0, 0, 0)

  return tuesday
}

function getCurrentWeekWednesdayEnd(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  const { start } = getISOWeekDates(torontoDate)
  
  const wednesday = new Date(start)
  wednesday.setDate(start.getDate() + 2)
  wednesday.setHours(23, 59, 59, 999)
  
  return wednesday
}

function getCurrentWeekMondayStart(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  const { start } = getISOWeekDates(torontoDate)
  
  return start
}

function getCurrentWeekFridayEnd(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  const { start } = getISOWeekDates(torontoDate)

  const friday = new Date(start)
  friday.setDate(start.getDate() + 4)
  friday.setHours(23, 59, 59, 999)

  return friday
}

function getCurrentWeekThursdayEnd(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  const { start } = getISOWeekDates(torontoDate)
  
  const thursday = new Date(start)
  thursday.setDate(start.getDate() + 3)
  thursday.setHours(23, 59, 59, 999)
  
  return thursday
}

function getTwoDaysAgo(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  
  const twoDaysAgo = new Date(torontoDate)
  twoDaysAgo.setDate(torontoDate.getDate() - 2)
  
  return twoDaysAgo
}

function isDateInBarelyLateWindow(date: Date): boolean {
  const tuesdayStart = getCurrentWeekTuesdayStart()
  const thursdayEnd = getCurrentWeekThursdayEnd()
  
  return date >= tuesdayStart && date <= thursdayEnd
}

async function getBarberAvailability(userId: string): Promise<{ slots: number; taken_slots: number; revenue: number }> {
  const now = new Date()
  const { start, end } = getISOWeekDates(now)
  
  const startDate = start.toISOString().split('T')[0]
  const endDate = end.toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('availability_daily_summary')
    .select('slot_count, slot_count_update, estimated_revenue')
    .eq('user_id', userId)
    .gte('slot_date', startDate)
    .lte('slot_date', endDate)
    
  if (error) {
    console.error(`Error fetching availability for user ${userId}:`, error)
    return { slots: 0, taken_slots: 0, revenue: 0 }
  }

  if (!data || data.length === 0) {
    return { slots: 0, taken_slots: 0, revenue: 0 }
  }
  
  const totalSlots = data.reduce((sum, row) => sum + (row.slot_count || 0), 0)
  const totalSlotsUpdate = data.reduce((sum, row) => sum + (row.slot_count_update || 0), 0)
  
  const takenSlots = totalSlots - totalSlotsUpdate

  const totalRevenue = data.reduce((sum, row) => sum + (parseFloat(row.estimated_revenue?.toString() || '0')), 0)
  
  return {
    slots: totalSlots,
    taken_slots: takenSlots,
    revenue: Math.round(totalRevenue)
  }
}

async function updateBarbersAvailability(userIds: string[]): Promise<void> {
  if (!userIds || userIds.length === 0) {
    console.log('No user IDs to update availability for')
    return
  }

  console.log(`Updating availability for ${userIds.length} barber(s)`)

  try {
    const { data, error } = await supabase.functions.invoke('update_barber_availability', {
      body: { user_ids: userIds }
    })

    if (error) {
      console.error('Failed to update barber availability:', error)
    } else {
      console.log(`Availability update completed. Success: ${data?.success}, Failed: ${data?.failed}`)
    }
  } catch (error) {
    console.error('Error calling update_barber_availability:', error)
  }
}

async function getLatestYesReply(userId: string): Promise<{ received_at: string } | null> {
  const { data, error } = await supabase
    .from('sms_replies')
    .select('received_at, message')
    .eq('user_id', userId)
    .eq('message', 'yes')
    .order('received_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return {
    received_at: data.received_at
  }
}

/**
 * Returns the count of clients from the current bucket who replied this week.
 * Only counts replies where client_id IS NOT NULL (i.e. resolved to a known client).
 */
async function getClientReplyCount(userId: string, isoWeek: string): Promise<number> {
  // Get the current week's bucket to find the recipient phone numbers
  const { data: bucket, error: bucketError } = await supabase
    .from('sms_smart_buckets')
    .select('clients')
    .eq('user_id', userId)
    .eq('iso_week', isoWeek)
    .single()

  if (bucketError || !bucket?.clients?.length) {
    return 0
  }

  // Build a set of phone numbers that were in this bucket
  const bucketPhones = new Set<string>(
    bucket.clients
      .map((c: { phone: string }) => c.phone)
      .filter(Boolean)
  )

  if (bucketPhones.size === 0) return 0

  // Compute Monday–Sunday bounds
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  const { start: weekMonday, end: weekSunday } = getISOWeekDates(torontoDate)

  const { data: replies, error: repliesError } = await supabase
    .from('sms_replies')
    .select('phone_number')
    .eq('user_id', userId)
    .not('client_id', 'is', null)
    .gte('received_at', weekMonday.toISOString())
    .lte('received_at', weekSunday.toISOString())

  if (repliesError || !replies) return 0

  // Only count replies from phones that were in the bucket
  const uniqueRepliers = new Set(
    replies
      .filter(r => bucketPhones.has(r.phone_number))
      .map(r => r.phone_number)
  )

  return uniqueRepliers.size
}

async function getBarberNudgeSuccess(userId: string, isoWeek: string): Promise<{ clientIds: string[]; prices: number[] } | null> {
  const { data, error } = await supabase
    .from('barber_nudge_success')
    .select('client_ids, prices')
    .eq('user_id', userId)
    .eq('iso_week_number', isoWeek)
    .single()

  if (error || !data) {
    return null
  }

  return {
    clientIds: data.client_ids || [],
    prices: data.prices || []
  }
}

async function sendUpdateMessage(barber: any, isoWeek: string): Promise<any> {
  const firstName = getFirstName(barber.full_name)

  // Get reply count (only from bucket recipients this week)
  const replyCount = await getClientReplyCount(barber.user_id, isoWeek)

  // Get booking + revenue data
  const nudgeSuccess = await getBarberNudgeSuccess(barber.user_id, isoWeek)
  const bookingCount = nudgeSuccess?.clientIds?.length ?? 0
  const totalRevenue = Math.round(
    (nudgeSuccess?.prices ?? []).reduce((sum, price) => sum + Number(price), 0)
  )

  const message = buildUpdateMessage(firstName, replyCount, bookingCount, totalRevenue)

  const statusCallbackUrl = `${siteUrl}/api/barber-nudge/sms-status`
  const callbackUrl = new URL(statusCallbackUrl)
  callbackUrl.searchParams.set('user_id', barber.user_id)
  callbackUrl.searchParams.set('message', message)
  callbackUrl.searchParams.set('purpose', 'barber_sms_update')
  
  const twilioMessage = await twilio_client.messages.create({
    body: `${message}\n\nReply STOP to unsubscribe.`,
    messagingServiceSid: messagingServiceSid,
    to: barber.phone,
    statusCallback: callbackUrl.toString()
  })

  console.log(`Update sent to ${barber.full_name} (${barber.phone}): ${twilioMessage.sid}`)
  console.log(`Stats: replies=${replyCount}, bookings=${bookingCount}, revenue=$${totalRevenue}`)

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert({
      user_id: barber.user_id,
      header: "Auto nudge update",
      message: "Your auto nudge update has been sent to your phone. Click to view details in Corva.",
      reference_type: 'sms_auto_nudge',
      show: false,
    })

  if (notificationError) {
    console.error('Failed to insert notifications. Continuing without notification', notificationError)
  }
  
  return {
    user_id: barber.user_id,
    phone: barber.phone,
    message_sid: twilioMessage.sid,
    reply_count: replyCount,
    booking_count: bookingCount,
    total_revenue: totalRevenue,
    status: 'sent'
  }
}

Deno.serve(async (req) => {
  try {
    const dayOfWeek = getCurrentDayOfWeek()
    const isoWeek = getISOWeek()
    
    console.log(`Edge function triggered. Current day: ${dayOfWeek} (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)`)
    console.log(`ISO Week: ${isoWeek}`)
    
    const results = []

    // Tuesday start — used to identify "barely late" repliers in Flow 1
    const tuesdayStart = getCurrentWeekTuesdayStart()
    
    // FLOW 1: Normal Wednesday updates (on-time barbers only)
    if (dayOfWeek === 3) {
      console.log('Wednesday flow: Sending updates to on-time barbers')
      
      const monday10am = getCurrentWeekMondayAt10AM()
      
      console.log(`Excluding barbers with date_autonudge_enabled after ${monday10am.toISOString()}`)
      
      const { data: barbers, error: barbersError } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone, date_autonudge_enabled')
        .or('role.ilike.barber,role.ilike.owner')
        .eq('sms_engaged_current_week', true)
        .not('phone', 'is', null)
        .or('stripe_subscription_status.eq.active,trial_active.eq.true')
        .lt('date_autonudge_enabled', monday10am.toISOString())
        // .eq('user_id', 'e4120eae-1d2f-4181-8417-168233fc01b7') // TEMP - debug only

      if (barbersError) {
        console.error('Error fetching barbers:', barbersError)
        throw barbersError
      }

      if (!barbers || barbers.length === 0) {
        console.log('No on-time barbers found for Wednesday update')
      } else {
        console.log(`Checking ${barbers.length} barber(s) for on-time eligibility`)

        // Filter out barbers who replied Tuesday or later — they are "barely late"
        // and will receive their update via Flow 2 instead
        const eligibleBarbers = []
        for (const barber of barbers) {
          const latestReply = await getLatestYesReply(barber.user_id)
          if (latestReply) {
            const replyDate = getTorontoDate(new Date(latestReply.received_at))
            if (replyDate >= tuesdayStart) {
              console.log(`Skipping ${barber.full_name} — replied on Tue/Wed (${replyDate.toISOString()}), will get delayed update`)
              continue
            }
          }
          eligibleBarbers.push(barber)
        }

        if (eligibleBarbers.length === 0) {
          console.log('No eligible on-time barbers after reply-date filtering')
        } else {
          console.log(`Sending update messages to ${eligibleBarbers.length} on-time barber(s)`)
          
          const barberUserIds = eligibleBarbers.map(b => b.user_id)
          await updateBarbersAvailability(barberUserIds)
          
          for (const barber of eligibleBarbers) {
            try {
              const result = await sendUpdateMessage(barber, isoWeek)
              results.push(result)
            } catch (error) {
              console.error(`Failed to send update to ${barber.full_name} (${barber.phone}):`, error)
              results.push({
                user_id: barber.user_id,
                phone: barber.phone,
                error: error.message,
                status: 'failed'
              })
            }
          }
        }
      }
    }
    
    // FLOW 2: Special updates for "barely late" barbers (3 days after onboarding OR late reply)
    const twoDaysAgo = getTwoDaysAgo()
    
    console.log(`Checking if 2 days ago (${twoDaysAgo.toISOString()}) is in barely late window`)
    
    if (isDateInBarelyLateWindow(twoDaysAgo)) {
      console.log('3 days ago is in barely late window - checking for special updates')
      
      const mondayStart = getCurrentWeekMondayStart()
      const thursdayEnd = getCurrentWeekThursdayEnd()
      const fridayEnd = getCurrentWeekFridayEnd()
      
      const { data: allBarbers, error: allBarbersError } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .or('role.ilike.barber,role.ilike.owner')
        .not('phone', 'is', null)
        .or('stripe_subscription_status.eq.active,trial_active.eq.true')
        // .eq('user_id', 'e4120eae-1d2f-4181-8417-168233fc01b7') // TEMP - debug only

      if (allBarbersError) {
        console.error('Error fetching all barbers:', allBarbersError)
        throw allBarbersError
      }

      if (allBarbers && allBarbers.length > 0) {
        console.log(`Checking ${allBarbers.length} barbers for barely late updates`)
        
        const barbersToUpdate = []
        
        for (const barber of allBarbers) {
          try {
            const latestReply = await getLatestYesReply(barber.user_id)
            
            if (!latestReply) {
              continue
            }
            
            const replyDate = new Date(latestReply.received_at)
            const replyDateToronto = getTorontoDate(replyDate)
            
            // Only send delayed update if they replied Tuesday or later this week
            // (replies on Monday are on-time and already handled by Flow 1)
            if (replyDateToronto >= tuesdayStart && replyDateToronto <= fridayEnd) {
              barbersToUpdate.push(barber)
            }
          } catch (error) {
            console.error(`Failed to check barely late eligibility for ${barber.full_name}:`, error)
          }
        }
        
        if (barbersToUpdate.length > 0) {
          console.log(`Found ${barbersToUpdate.length} barbers for barely late updates`)
          
          const barberUserIds = barbersToUpdate.map(b => b.user_id)
          await updateBarbersAvailability(barberUserIds)
          
          for (const barber of barbersToUpdate) {
            try {
              console.log(`Sending barely late update to ${barber.full_name}`)
              const result = await sendUpdateMessage(barber, isoWeek)
              results.push({ ...result, flow: 'barely_late' })
            } catch (error) {
              console.error(`Failed to send barely late update to ${barber.full_name}:`, error)
            }
          }
        }
      }
    } else {
      console.log('3 days ago is NOT in barely late window - skipping special updates')
    }

    console.log(`Update sending completed. Current time: ${new Date().toISOString()}`)

    return new Response(JSON.stringify({ 
      success: true,
      day_of_week: dayOfWeek,
      isoWeek: isoWeek,
      sent: results.filter(r => r.status === 'sent').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      failed: results.filter(r => r.status === 'failed').length,
      results 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})