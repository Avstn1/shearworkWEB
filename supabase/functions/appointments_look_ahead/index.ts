// supabase/functions/appointments_look_ahead/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
  Deno.env.get("SERVICE_ROLE_KEY") ?? '', 
)

const baseUrl = 'https://acuityscheduling.com'
const apiBase = `${baseUrl}/api/v1`

function getISOWeek(): string {
  const now = new Date(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  )

  const day = now.getDay() || 7
  now.setDate(now.getDate() + 4 - day)

  const yearStart = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((+now - +yearStart) / 86400000 + 1) / 7)
  const year = now.getFullYear()

  return `${year}-W${week.toString().padStart(2, '0')}`
}

function toEnCA(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getTwoMonthsFromNow(): string {
  const now = new Date()
  const twoMonths = new Date(now)
  twoMonths.setMonth(now.getMonth() + 2)
  return toEnCA(twoMonths)
}

function stripE164(phone: string): string {
  // Remove +1 prefix for Acuity API
  return phone.replace(/^\+1/, '')
}

function parseDateCreated(dateStr: string): Date | null {
  try {
    return new Date(dateStr)
  } catch {
    return null
  }
}

async function getAccessToken(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('acuity_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    console.error(`No access token for user ${userId}:`, error)
    return null
  }

  return data.access_token
}

async function getAcuityAppointments(
  accessToken: string,
  calendarId: string,
  phone: string
): Promise<any[]> {
  const today = toEnCA(new Date())
  const maxDate = getTwoMonthsFromNow()

  const url = new URL(`${apiBase}/appointments`)
  url.searchParams.set('showall', 'true')
  url.searchParams.set('minDate', today)
  url.searchParams.set('maxDate', maxDate)
  url.searchParams.set('offset', '0')
  url.searchParams.set('calendarID', calendarId)
  url.searchParams.set('phone', phone.toString())

  // console.log("Phone: " + phone)

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    console.error(`Acuity API error: ${response.status}`)
    return []
  }

  const data = await response.json()

  console.log(JSON.stringify(data))

  return Array.isArray(data) ? data : []
}

async function processBarber(userId: string, isoWeek: string, calendar: string) {
  const title = `${userId}_${isoWeek}`

  // Get scheduled message
  const { data: scheduledMessage, error: messageError } = await supabase
    .from('sms_scheduled_messages')
    .select('id')
    .eq('title', title)
    .single()

  if (messageError || !scheduledMessage) {
    console.warn(`No scheduled message for ${userId} with title ${title}`)
    return { userId, success: false, reason: 'No scheduled message' }
  }

  const messageId = scheduledMessage.id

  // Get sent messages
  const { data: sentMessages, error: sentError } = await supabase
    .from('sms_sent')
    .select('phone_normalized, created_at, is_sent')
    .eq('message_id', messageId)

  if (sentError || !sentMessages || sentMessages.length === 0) {
    console.warn(`No sent messages for message_id ${messageId}`)
    return { userId, success: false, reason: 'No sent messages' }
  }

  // Get access token
  const accessToken = await getAccessToken(userId)
  if (!accessToken) {
    console.warn(`No access token for user ${userId}`)
    return { userId, success: false, reason: 'No access token' }
  }

  const phoneNumbers = sentMessages
    .filter(msg => msg.phone_normalized)
    .map(msg => ({
      phone: msg.phone_normalized!,
      createdAt: new Date(msg.created_at).toLocaleString('en-CA', { timeZone: 'America/Toronto' }),
      isSent: msg.is_sent
    }))

  let appointmentsFound = false
  const clientIdsToAdd: string[] = []
  let clickedLinkCount = 0
  const messagesDelivered = sentMessages.filter(msg => msg.is_sent).length

  // Check appointments for each phone number
  for (const { phone, createdAt } of phoneNumbers) {
    const nonE164Phone = stripE164(phone)
    const appointments = await getAcuityAppointments(accessToken, calendar, nonE164Phone)

    // Check if any appointment was created after SMS was sent
    const hasAppointmentAfterSMS = appointments.some(appt => {
      // console.log('dateCreated (appt created date): ' + appt.datetimeCreated)
      // console.log('created at (msg sent): ' + createdAt)

      return appt.datetimeCreated && appt.datetimeCreated > createdAt
    })

    if (hasAppointmentAfterSMS) {
      appointmentsFound = true

      console.log("Client's phone: " + phone)

      // Get client info
      const { data: client } = await supabase
        .from('test_acuity_clients')
        .select('client_id, last_date_clicked_link')
        .eq('user_id', userId)
        .eq('phone_normalized', phone)
        .single()

      if (client) {
        console.log(client)

        clientIdsToAdd.push(client.client_id)

        // Check if they clicked the link
        if (client.last_date_clicked_link) {
          const clickedAt = new Date(client.last_date_clicked_link)
          if (clickedAt > createdAt) {
            clickedLinkCount++
          }
        }
      }
    }
  }

  // Only create/update if appointments were found
  if (!appointmentsFound) {
    console.log(`No appointments found for user ${userId}`)
    return { userId, success: true, appointmentsFound: false }
  }

  // Check if record exists
  const { data: existing } = await supabase
    .from('barber_nudge_success')
    .select('id, client_ids')
    .eq('user_id', userId)
    .eq('iso_week_number', isoWeek)
    .single()

  if (existing) {
    // Update existing record
    const existingClientIds = existing.client_ids || []
    const mergedClientIds = Array.from(new Set([...existingClientIds, ...clientIdsToAdd]))

    await supabase
      .from('barber_nudge_success')
      .update({
        messages_delivered: messagesDelivered,
        clicked_link: clickedLinkCount,
        client_ids: mergedClientIds,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)

    console.log(`Updated barber_nudge_success for user ${userId}`)
  } else {
    // Create new record
    await supabase
      .from('barber_nudge_success')
      .insert({
        user_id: userId,
        iso_week_number: isoWeek,
        messages_delivered: messagesDelivered,
        clicked_link: clickedLinkCount,
        client_ids: clientIdsToAdd
      })

    console.log(`Created barber_nudge_success for user ${userId}`)
  }

  return {
    userId,
    success: true,
    appointmentsFound: true,
    messagesDelivered,
    clickedLinkCount,
    clientCount: clientIdsToAdd.length
  }
}

Deno.serve(async (_req) => {
  try {
    console.log(`STARTING APPOINTMENTS LOOK AHEAD`)

    const isoWeek = getISOWeek()
    console.log(`Current ISO Week: ${isoWeek}`)

    // Get all engaged barbers
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, calendar, full_name')
      .eq('sms_engaged_current_week', true)
      .not('calendar', 'is', null)
      .neq('calendar', '')

    if (profileError) throw profileError

    console.log(`Processing ${profiles?.length || 0} engaged barbers`)

    const CONCURRENCY_LIMIT = 100
    const results: any[] = []

    async function processWithConcurrency(items: typeof profiles, limit: number) {
      let active = 0
      let index = 0

      return new Promise<void>(resolve => {
        function next() {
          while (active < limit && index < items.length) {
            const barber = items[index++]
            active++

            processBarber(barber.user_id, isoWeek, barber.calendar)
              .then(result => {
                results.push(result)
                console.log(`Processed ${barber.full_name}: ${JSON.stringify(result)}`)
              })
              .catch(err => {
                console.error(`Error processing ${barber.full_name}:`, err)
                results.push({ userId: barber.user_id, success: false, error: String(err) })
              })
              .finally(() => {
                active--
                next()
              })
          }

          if (active === 0 && index >= items.length) resolve()
        }

        next()
      })
    }

    await processWithConcurrency(profiles || [], CONCURRENCY_LIMIT)

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const appointmentsFoundCount = results.filter(r => r.appointmentsFound).length

    console.log(`Appointments look ahead completed. Success: ${successCount}, Failed: ${failCount}, Appointments Found: ${appointmentsFoundCount}`)
    console.log(`SYNC ENDED`)

    return new Response(JSON.stringify({
      message: 'Appointments look ahead completed',
      isoWeek,
      totalBarbers: profiles?.length || 0,
      success: successCount,
      failed: failCount,
      appointmentsFound: appointmentsFoundCount,
      results
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: unknown) {
    console.error('Edge function error:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})