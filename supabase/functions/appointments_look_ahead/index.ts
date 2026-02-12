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
  return phone.replace(/^\+1/, '')
}

function phoneToSearchParam(phone: string): string {
  return phone.startsWith('+')
    ? `%2b${phone.slice(1)}`
    : phone
}

function parseToUTCTimestamp(datetimeStr: string): string {
  // Parse Acuity datetime format (e.g., "2026-02-01T16:30:00-0500") to UTC timestamptz
  try {
    const date = new Date(datetimeStr)
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date')
    }
    // Format as PostgreSQL timestamptz: "2026-01-31 21:30:00+00"
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00')
  } catch (error) {
    console.error('Error parsing datetime:', datetimeStr, error)
    // Return current time as fallback
    return new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00')
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

async function getAllAcuityAppointments(
  accessToken: string,
  calendarId: string
): Promise<any[]> {
  const today = toEnCA(new Date())
  const maxDate = getTwoMonthsFromNow()

  const url = new URL(`${apiBase}/appointments`)
  url.searchParams.set('minDate', today)
  url.searchParams.set('maxDate', maxDate)
  url.searchParams.set('offset', '0')
  url.searchParams.set('calendarID', calendarId)

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    console.error(`Acuity API error: ${response.status}`)
    return []
  }

  const data = await response.json()
  // console.log("data: " + JSON.stringify(data))

  return data
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

  // Fetch all appointments once
  const allAppointments = await getAllAcuityAppointments(accessToken, calendar)
  // console.log("allAppointments: " + JSON.stringify(allAppointments))

  // Normalize phone number to compare (remove +1 or 1 prefix)
  const normalizePhone = (phoneStr: string) => {
    if (!phoneStr) return ''
    return phoneStr.replace(/^\+?1/, '')
  }

  // Create a map of normalized phone -> appointments
  const appointmentsByPhone = new Map<string, any[]>()
  for (const appt of allAppointments) {
    const normalized = normalizePhone(appt.phone)
    if (!appointmentsByPhone.has(normalized)) {
      appointmentsByPhone.set(normalized, [])
    }
    appointmentsByPhone.get(normalized)!.push(appt)
  }

  let appointmentsFound = false
  const clientIdsToAdd: string[] = []
  const servicesToAdd: string[] = []
  const pricesToAdd: number[] = []
  const appointmentDatesToAdd: string[] = []

  let clickedLinkCount = 0
  const messagesDelivered = sentMessages.filter(msg => msg.is_sent).length

  // Check appointments for each phone number
  for (const { phone, createdAt } of phoneNumbers) {
    const normalizedPhone = normalizePhone(phone)
    const appointments = appointmentsByPhone.get(normalizedPhone) || []

    // Find all appointments created after SMS was sent, sorted by appointment datetime
    const appointmentsAfterSMS = appointments
      .filter(appt => appt.datetimeCreated && appt.datetimeCreated > createdAt)
      .sort((a, b) => {
        const dateA = new Date(a.datetime || a.datetimeCreated).getTime()
        const dateB = new Date(b.datetime || b.datetimeCreated).getTime()
        return dateA - dateB
      })

    console.log("appointmentsAfterSMS: " + JSON.stringify(appointmentsAfterSMS))

    if (appointmentsAfterSMS.length > 0) {
      appointmentsFound = true
      const firstAppt = appointmentsAfterSMS[0]

      console.log("Client's phone: " + phone)

      // Get client info
      const { data: client } = await supabase
        .from('acuity_clients')
        .select('client_id, last_date_clicked_link')
        .eq('user_id', userId)
        .eq('phone_normalized', phone)
        .single()

      if (client) {
        console.log(client)

        clientIdsToAdd.push(client.client_id)
        servicesToAdd.push(firstAppt.type || 'Unknown')
        pricesToAdd.push(Math.round(Number(firstAppt.price)) || 0)
        
        // Parse appointment datetime to UTC timestamptz format
        const apptDatetime = parseToUTCTimestamp(firstAppt.datetime)
        appointmentDatesToAdd.push(apptDatetime)

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
    .select('id, client_ids, services, prices, appointment_dates')
    .eq('user_id', userId)
    .eq('iso_week_number', isoWeek)
    .single()

  if (existing) {
    // Update existing record - merge arrays while maintaining index alignment
    const existingClientIds = existing.client_ids || []
    const existingServices = existing.services || []
    const existingPrices = existing.prices || []
    const existingAppointmentDates = existing.appointment_dates || []
    
    // Add new clients and services, avoiding duplicates
    const mergedClientIds = [...existingClientIds]
    const mergedServices = [...existingServices]
    const mergedPrices = [...existingPrices]
    const mergedAppointmentDates = [...existingAppointmentDates]
    
    for (let i = 0; i < clientIdsToAdd.length; i++) {
      const clientId = clientIdsToAdd[i]
      const service = servicesToAdd[i]
      const price = pricesToAdd[i]
      const appointmentDate = appointmentDatesToAdd[i]
      
      if (!existingClientIds.includes(clientId)) {
        mergedClientIds.push(clientId)
        mergedServices.push(service)
        mergedPrices.push(price)
        mergedAppointmentDates.push(appointmentDate)
      }
    }

    await supabase
      .from('barber_nudge_success')
      .update({
        messages_delivered: messagesDelivered,
        clicked_link: clickedLinkCount,
        client_ids: mergedClientIds,
        services: mergedServices,
        prices: mergedPrices,
        appointment_dates: mergedAppointmentDates,
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
        client_ids: clientIdsToAdd,
        services: servicesToAdd,
        prices: pricesToAdd,
        appointment_dates: appointmentDatesToAdd
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    console.log(`STARTING APPOINTMENTS LOOK AHEAD`)

    // Parse optional user_id from query params
    let targetUserId: string | null = null
    
    // Check query params first
    const url = new URL(req.url)
    targetUserId = url.searchParams.get('user_id')
    console.log(targetUserId)
    
    const isoWeek = getISOWeek()

    // Build query based on mode
    let query = supabase
      .from('profiles')
      .select('user_id, calendar, full_name')
      .eq('sms_engaged_current_week', true)
      .not('calendar', 'is', null)
      .neq('calendar', '')

    // Mode 2: Add user_id filter if provided
    if (targetUserId) {
      query = query.eq('user_id', targetUserId)
    }

    const { data: profiles, error: profileError } = await query

    if (profileError) throw profileError

    if (!profiles || profiles.length === 0) {
      const message = targetUserId 
        ? `No profile found for user_id: ${targetUserId}`
        : 'No engaged barbers found'
      console.log(message)
      return new Response(JSON.stringify({
        message,
        isoWeek,
        totalBarbers: 0,
        results: []
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 200,
      })
    }

    console.log(`Processing ${profiles.length} barber(s)`)

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
      mode: targetUserId ? 'specific_user' : 'all_engaged',
      isoWeek,
      totalBarbers: profiles?.length || 0,
      success: successCount,
      failed: failCount,
      appointmentsFound: appointmentsFoundCount,
      results
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      status: 200,
    })
  } catch (err: unknown) {
    console.error('Edge function error:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({
      error: errorMessage
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
})