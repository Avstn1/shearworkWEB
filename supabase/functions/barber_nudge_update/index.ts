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
 * Builds the Sunday night weekly results message.
 *
 * Case 1 — No replies, no bookings
 * Case 2 — Replies but no bookings
 * Case 3 — Bookings (with or without replies)
 */
function buildWeeklyResultsMessage(
  firstName: string,
  replyCount: number,
  bookingCount: number,
  totalRevenue: number
): string {
  if (replyCount === 0 && bookingCount === 0) {
    return `Hey ${firstName} — here are your Corva results for this week.\n\nNo bookings or replies came through this time. We'll try again next week!`
  }

  if (replyCount > 0 && bookingCount === 0) {
    return `Hey ${firstName} — here are your Corva results for this week.\n\n• ${replyCount} client${replyCount === 1 ? '' : 's'} replied\n• 0 bookings\n\nYou can view their messages in Corva.`
  }

  // Has bookings
  const replyLine = replyCount > 0
    ? `\n\n${replyCount} client${replyCount === 1 ? '' : 's'} also replied — view their messages in Corva.`
    : '\n\nView details in Corva.'

  return `Hey ${firstName} — here are your Corva results for this week.\n\nThis week Corva brought back ${bookingCount} booking${bookingCount === 1 ? '' : 's'}\n$${totalRevenue.toLocaleString()} revenue recovered${replyLine}`
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

/**
 * Returns the count of unique clients from the bucket who replied this week.
 * Only counts replies where client_id IS NOT NULL.
 */
async function getClientReplyCount(userId: string, isoWeek: string): Promise<number> {
  const { data: bucket, error: bucketError } = await supabase
    .from('sms_smart_buckets')
    .select('clients')
    .eq('user_id', userId)
    .eq('iso_week', isoWeek)
    .single()

  if (bucketError || !bucket?.clients?.length) {
    return 0
  }

  const bucketPhones = new Set<string>(
    bucket.clients
      .map((c: { phone: string }) => c.phone)
      .filter(Boolean)
  )

  if (bucketPhones.size === 0) return 0

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

async function sendWeeklyResultsMessage(barber: any, isoWeek: string): Promise<any> {
  const firstName = getFirstName(barber.full_name || 'there')

  const replyCount = await getClientReplyCount(barber.user_id, isoWeek)

  const nudgeSuccess = await getBarberNudgeSuccess(barber.user_id, isoWeek)
  const bookingCount = nudgeSuccess?.clientIds?.length ?? 0
  const totalRevenue = Math.round(
    (nudgeSuccess?.prices ?? []).reduce((sum, price) => sum + Number(price), 0)
  )

  const message = buildWeeklyResultsMessage(firstName, replyCount, bookingCount, totalRevenue)

  const statusCallbackUrl = `${siteUrl}/api/barber-nudge/sms-status`
  const callbackUrl = new URL(statusCallbackUrl)
  callbackUrl.searchParams.set('user_id', barber.user_id)
  callbackUrl.searchParams.set('message', message)
  callbackUrl.searchParams.set('purpose', 'barber_sms_weekly_results')
  
  const twilioMessage = await twilio_client.messages.create({
    body: `${message}\n\nReply STOP to unsubscribe.`,
    messagingServiceSid: messagingServiceSid,
    to: barber.phone,
    statusCallback: callbackUrl.toString()
  })

  console.log(`Weekly results sent to ${barber.full_name} (${barber.phone}): ${twilioMessage.sid}`)
  console.log(`Stats: replies=${replyCount}, bookings=${bookingCount}, revenue=$${totalRevenue}`)

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert({
      user_id: barber.user_id,
      header: 'Weekly results',
      message: bookingCount > 0
        ? `Corva brought back ${bookingCount} booking${bookingCount === 1 ? '' : 's'} and $${totalRevenue} in revenue this week.`
        : 'Your weekly auto-nudge results are in. View details in Corva.',
      reference_type: 'sms_auto_nudge',
    })

  if (notificationError) {
    console.error('Failed to insert notification. Continuing.', notificationError)
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
    
    console.log(`[barber_nudge_update] Edge function triggered.`)
    console.log(`  Day: ${dayOfWeek} (0=Sun, 1=Mon, ..., 6=Sat)`)
    console.log(`  ISO Week: ${isoWeek}`)
    console.log(`  Toronto time: ${getTorontoDate().toISOString()}`)

    // V1: Only run on Sunday (was Wednesday + barely-late flow)
    if (dayOfWeek !== 0) {
      console.log('Not Sunday — skipping.')
      return new Response(JSON.stringify({ message: 'Skipped — not Sunday' }), {
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
      console.log('No engaged barbers found for weekly results.')
      return new Response(JSON.stringify({ message: 'No engaged barbers this week' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`Sending weekly results to ${barbers.length} barber(s)`)

    const results = []

    for (const barber of barbers) {
      try {
        const result = await sendWeeklyResultsMessage(barber, isoWeek)
        results.push(result)
      } catch (error: any) {
        console.error(`Failed to send results to ${barber.full_name} (${barber.phone}):`, error)
        results.push({
          user_id: barber.user_id,
          phone: barber.phone,
          error: error.message,
          status: 'failed'
        })
      }
    }

    console.log(`Weekly results complete. Sent: ${results.filter(r => r.status === 'sent').length}, Failed: ${results.filter(r => r.status === 'failed').length}`)

    return new Response(JSON.stringify({ 
      success: true,
      day_of_week: dayOfWeek,
      isoWeek,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('Edge function error:', err)
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})