// supabase/functions/barber_nudge_daily_update/index.ts

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

const TORONTO_TZ = 'America/Toronto'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function getFirstName(fullName: string): string {
  return fullName.trim().split(' ')[0]
}

function getTorontoDateComponents(date: Date = new Date()): {
  year: number; month: number; day: number;
  hours: number; minutes: number; seconds: number
} {
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

/**
 * Format an appointment date for SMS display.
 * e.g. "Thu 3:30 PM"
 */
function formatAppointmentShort(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleString('en-US', {
      timeZone: TORONTO_TZ,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return ''
  }
}

// ----------------------------------------------------------------
// Data fetchers
// ----------------------------------------------------------------

interface DailyUpdateState {
  reported_booking_client_ids: string[]
  reported_reply_phones: string[]
}

function getEmptyState(): DailyUpdateState {
  return {
    reported_booking_client_ids: [],
    reported_reply_phones: [],
  }
}

/**
 * Get the bucket for this user + ISO week, including the daily_update_state.
 */
async function getBucket(userId: string, isoWeek: string) {
  const { data, error } = await supabase
    .from('sms_smart_buckets')
    .select('bucket_id, clients, campaign_start, daily_update_state')
    .eq('user_id', userId)
    .eq('iso_week', isoWeek)
    .single()

  if (error || !data) return null
  return data
}

/**
 * Get new replies since last report.
 * Returns array of { phone, firstName } for replies not yet reported.
 */
async function getNewReplies(
  userId: string,
  isoWeek: string,
  bucket: { clients: any[]; campaign_start: string },
  previousState: DailyUpdateState
): Promise<{ phone: string; firstName: string }[]> {

  // Build phone → name map from bucket clients
  const phoneToName = new Map<string, string>()
  for (const client of bucket.clients || []) {
    if (client.phone && client.full_name) {
      phoneToName.set(client.phone, getFirstName(client.full_name))
    }
  }

  const bucketPhones = new Set(
    (bucket.clients || []).map((c: { phone: string }) => c.phone).filter(Boolean)
  )
  if (bucketPhones.size === 0) return []

  // Get week bounds
  const torontoDate = getTorontoDate()
  const { start: weekMonday, end: weekSunday } = getISOWeekDates(torontoDate)

  const { data: replies, error } = await supabase
    .from('sms_replies')
    .select('phone_number')
    .eq('user_id', userId)
    .not('client_id', 'is', null)
    .gte('received_at', weekMonday.toISOString())
    .lte('received_at', weekSunday.toISOString())

  if (error || !replies) return []

  // Deduplicate by phone
  const uniquePhones = new Set<string>()
  for (const reply of replies) {
    if (bucketPhones.has(reply.phone_number)) {
      uniquePhones.add(reply.phone_number)
    }
  }

  // Filter out already-reported phones
  const previousPhones = new Set(previousState.reported_reply_phones)
  const newReplies: { phone: string; firstName: string }[] = []

  for (const phone of uniquePhones) {
    if (!previousPhones.has(phone)) {
      newReplies.push({
        phone,
        firstName: phoneToName.get(phone) || 'A client',
      })
    }
  }

  return newReplies
}

/**
 * Get new bookings since last report.
 * Returns array of { clientId, firstName, appointmentDate, service, price }.
 */
async function getNewBookings(
  userId: string,
  isoWeek: string,
  bucket: { clients: any[] },
  previousState: DailyUpdateState
): Promise<{ clientId: string; firstName: string; appointmentDate: string; service: string; price: number }[]> {

  const { data, error } = await supabase
    .from('barber_nudge_success')
    .select('client_ids, services, prices, appointment_dates')
    .eq('user_id', userId)
    .eq('iso_week_number', isoWeek)
    .single()

  if (error || !data) return []

  const clientIds: string[] = data.client_ids || []
  const services: string[] = data.services || []
  const prices: number[] = data.prices || []
  const appointmentDates: string[] = data.appointment_dates || []

  // Build clientId → name map from bucket clients
  const clientIdToName = new Map<string, string>()
  for (const client of bucket.clients || []) {
    if (client.client_id && client.full_name) {
      clientIdToName.set(client.client_id, getFirstName(client.full_name))
    }
  }

  // Filter out already-reported client IDs
  const previousIds = new Set(previousState.reported_booking_client_ids)
  const newBookings: { clientId: string; firstName: string; appointmentDate: string; service: string; price: number }[] = []

  for (let i = 0; i < clientIds.length; i++) {
    const cid = clientIds[i]
    if (!previousIds.has(cid)) {
      // If name not in bucket, try acuity_clients
      let firstName = clientIdToName.get(cid) || ''
      if (!firstName) {
        const { data: acuityClient } = await supabase
          .from('acuity_clients')
          .select('first_name')
          .eq('client_id', cid)
          .single()
        firstName = acuityClient?.first_name
          ? acuityClient.first_name.charAt(0).toUpperCase() + acuityClient.first_name.slice(1).toLowerCase()
          : 'A client'
      }

      newBookings.push({
        clientId: cid,
        firstName,
        appointmentDate: appointmentDates[i] || '',
        service: services[i] || '',
        price: Number(prices[i]) || 0,
      })
    }
  }

  return newBookings
}

/**
 * Update the daily_update_state on the bucket so we don't re-report.
 */
async function updateDailyState(
  bucketId: string,
  previousState: DailyUpdateState,
  newReplyPhones: string[],
  newBookingClientIds: string[]
): Promise<void> {
  const updatedState: DailyUpdateState = {
    reported_booking_client_ids: [
      ...previousState.reported_booking_client_ids,
      ...newBookingClientIds,
    ],
    reported_reply_phones: [
      ...previousState.reported_reply_phones,
      ...newReplyPhones,
    ],
  }

  const { error } = await supabase
    .from('sms_smart_buckets')
    .update({ daily_update_state: updatedState })
    .eq('bucket_id', bucketId)

  if (error) {
    console.error('Failed to update daily_update_state:', error)
  }
}

// ----------------------------------------------------------------
// Message builder
// ----------------------------------------------------------------

function buildDailyMessage(
  barberFirstName: string,
  newReplies: { phone: string; firstName: string }[],
  newBookings: { clientId: string; firstName: string; appointmentDate: string; service: string; price: number }[]
): string | null {
  const hasReplies = newReplies.length > 0
  const hasBookings = newBookings.length > 0

  // Rule 5: If nothing happens, send nothing
  if (!hasReplies && !hasBookings) return null

  const lines: string[] = []
  lines.push(`Hey ${barberFirstName} — Corva here.`)

  if (hasBookings && !hasReplies) {
    // Case 2: Bookings only
    lines.push('')
    if (newBookings.length === 1) {
      lines.push(`${newBookings[0].firstName} booked from your nudges`)
    } else {
      lines.push(`${newBookings.length} clients booked from your nudges`)
    }

    for (const booking of newBookings) {
      const timeStr = formatAppointmentShort(booking.appointmentDate)
      lines.push(`${booking.firstName} → ${timeStr}`)
    }

    const totalRevenue = newBookings.reduce((sum, b) => sum + b.price, 0)
    if (totalRevenue > 0) {
      lines.push(`+$${totalRevenue} recovered`)
    }
  } else if (hasReplies && !hasBookings) {
    // Case 1: Replies only
    lines.push('')
    if (newReplies.length === 1) {
      lines.push(`${newReplies[0].firstName} replied to your nudges today`)
    } else if (newReplies.length === 2) {
      lines.push(`${newReplies[0].firstName} and ${newReplies[1].firstName} replied to your nudges today`)
    } else {
      const names = newReplies.slice(0, 2).map(r => r.firstName).join(', ')
      lines.push(`${names} and ${newReplies.length - 2} more replied to your nudges today`)
    }
    lines.push('')
    lines.push('You can view their messages in Corva.')
  } else {
    // Case 3: Both replies + bookings
    const totalEngaged = newReplies.length + newBookings.length
    lines.push('')
    lines.push(`${totalEngaged} client${totalEngaged === 1 ? '' : 's'} engaged with your nudges today`)

    // Bookings first (more important)
    for (const booking of newBookings) {
      const timeStr = formatAppointmentShort(booking.appointmentDate)
      lines.push(`${booking.firstName} → booked ${timeStr}`)
    }

    // Then replies
    for (const reply of newReplies) {
      lines.push(`${reply.firstName} → replied`)
    }

    const totalRevenue = newBookings.reduce((sum, b) => sum + b.price, 0)
    if (totalRevenue > 0) {
      lines.push(`+$${totalRevenue} recovered`)
    }

    lines.push('')
    lines.push('You can view their messages in Corva.')
  }

  return lines.join('\n')
}

// ----------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    const dayOfWeek = getCurrentDayOfWeek()
    const isoWeek = getISOWeek()
    const torontoNow = getTorontoDate()

    console.log(`[barber_nudge_daily_update] Edge function triggered.`)
    console.log(`  Day: ${dayOfWeek} (0=Sun, 1=Mon, ..., 6=Sat)`)
    console.log(`  ISO Week: ${isoWeek}`)
    console.log(`  Toronto time: ${torontoNow.toISOString()}`)

    // Run Mon–Sat only (skip Sunday — weekly results go out instead)
    if (dayOfWeek === 0) {
      console.log('Sunday — skipping daily update.')
      return new Response(JSON.stringify({ message: 'Skipped — Sunday' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Fetch all barbers who engaged this week (replied YES)
    const { data: barbers, error: barbersError } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone')
      .or('role.ilike.barber,role.ilike.owner')
      .eq('sms_engaged_current_week', true)
      .not('phone', 'is', null)
      .or('stripe_subscription_status.eq.active,trial_active.eq.true')

    if (barbersError) {
      console.error('Error fetching barbers:', barbersError)
      throw barbersError
    }

    if (!barbers || barbers.length === 0) {
      console.log('No engaged barbers found.')
      return new Response(JSON.stringify({ message: 'No engaged barbers' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`Processing daily updates for ${barbers.length} barber(s)`)

    const statusCallbackUrl = `${siteUrl}/api/barber-nudge/sms-status`
    const results: any[] = []

    for (const barber of barbers) {
      try {
        const barberFirstName = getFirstName(barber.full_name || 'there')

        // Get this week's bucket
        const bucket = await getBucket(barber.user_id, isoWeek)
        if (!bucket) {
          console.log(`No bucket for ${barber.full_name} this week — skipping`)
          results.push({ user_id: barber.user_id, status: 'skipped', reason: 'no_bucket' })
          continue
        }

        const previousState: DailyUpdateState = bucket.daily_update_state || getEmptyState()

        // Get new activity since last report
        const newReplies = await getNewReplies(barber.user_id, isoWeek, bucket, previousState)
        const newBookings = await getNewBookings(barber.user_id, isoWeek, bucket, previousState)

        console.log(`${barber.full_name}: ${newReplies.length} new replies, ${newBookings.length} new bookings`)

        // Rule 5: If nothing new, send nothing
        if (newReplies.length === 0 && newBookings.length === 0) {
          console.log(`No new activity for ${barber.full_name} — skipping`)
          results.push({ user_id: barber.user_id, status: 'skipped', reason: 'no_new_activity' })
          continue
        }

        // Build the message
        const message = buildDailyMessage(barberFirstName, newReplies, newBookings)
        if (!message) {
          results.push({ user_id: barber.user_id, status: 'skipped', reason: 'empty_message' })
          continue
        }

        // Send via Twilio
        const callbackUrl = new URL(statusCallbackUrl)
        callbackUrl.searchParams.set('user_id', barber.user_id)
        callbackUrl.searchParams.set('message', message)
        callbackUrl.searchParams.set('purpose', 'barber_sms_daily_update')

        const twilioMessage = await twilio_client.messages.create({
          body: `${message}\n\nReply STOP to unsubscribe.`,
          messagingServiceSid: messagingServiceSid,
          to: barber.phone,
          statusCallback: callbackUrl.toString(),
        })

        console.log(`Daily update sent to ${barber.full_name} (${barber.phone}): ${twilioMessage.sid}`)

        // Update state so we don't re-report this activity tomorrow
        await updateDailyState(
          bucket.bucket_id,
          previousState,
          newReplies.map(r => r.phone),
          newBookings.map(b => b.clientId)
        )

        results.push({
          user_id: barber.user_id,
          phone: barber.phone,
          message_sid: twilioMessage.sid,
          new_replies: newReplies.length,
          new_bookings: newBookings.length,
          status: 'sent',
        })
      } catch (error: any) {
        console.error(`Failed for ${barber.full_name}:`, error)
        results.push({
          user_id: barber.user_id,
          phone: barber.phone,
          error: error.message,
          status: 'failed',
        })
      }
    }

    const sent = results.filter(r => r.status === 'sent').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const failed = results.filter(r => r.status === 'failed').length

    console.log(`Daily update complete. Sent: ${sent}, Skipped: ${skipped}, Failed: ${failed}`)

    return new Response(JSON.stringify({
      success: true,
      day_of_week: dayOfWeek,
      isoWeek,
      sent,
      skipped,
      failed,
      results,
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('Edge function error:', err)
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})