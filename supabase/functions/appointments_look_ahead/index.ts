// supabase/functions/appointments_look_ahead/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
  Deno.env.get("SERVICE_ROLE_KEY") ?? '', 
)

const baseUrl = 'https://acuityscheduling.com'
const apiBase = `${baseUrl}/api/v1`

function getISOWeek(date: Date = new Date()): string {
  const now = new Date(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  )

  const day = now.getDay() || 7
  now.setDate(now.getDate() + 4 - day)

  const yearStart = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((+now - +yearStart) / 86400000 + 1) / 7)
  const year = now.getFullYear()

  return `${year}-W${week.toString().padStart(2, '0')}`
}

function getRecentISOWeeks(count: number): string[] {
  const weeks: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() - i * 7)
    weeks.push(getISOWeek(d))
  }
  return weeks
}

function toEnCA(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getSevenDaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return toEnCA(d)
}

function getTwoMonthsFromNow(): string {
  const now = new Date()
  const twoMonths = new Date(now)
  twoMonths.setMonth(now.getMonth() + 2)
  return toEnCA(twoMonths)
}

function parseToUTCTimestamp(datetimeStr: string): string {
  try {
    const date = new Date(datetimeStr)
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date')
    }
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00')
  } catch (error) {
    console.error('Error parsing datetime:', datetimeStr, error)
    return new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00')
  }
}

const normalizeToE164 = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (raw.trimStart().startsWith('+') && digits.length >= 11) return `+${digits}`
  return `+${digits}`
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
  const minDate = getSevenDaysAgo()
  const maxDate = getTwoMonthsFromNow()

  const url = new URL(`${apiBase}/appointments`)
  url.searchParams.set('minDate', minDate)
  url.searchParams.set('maxDate', maxDate)
  url.searchParams.set('offset', '0')
  url.searchParams.set('max', '1000')
  url.searchParams.set('calendarID', calendarId)

  console.log(`🔍 Acuity request URL: ${url.toString()}`)

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    console.error(`Acuity API error: ${response.status}`)
    return []
  }

  const data = await response.json()
  console.log(`🔍 Acuity returned ${data.length} appointments`)
  return data
}

async function backfillNextFutureAppointment(
  userId: string,
  appointments: any[]
): Promise<void> {
  const now = new Date()

  const futureAppointments = appointments.filter(appt => {
    if (!appt.datetime) return false
    const dt = new Date(appt.datetime)
    return !isNaN(dt.getTime()) && dt > now
  })

  if (futureAppointments.length === 0) return

  const soonestByPhone = new Map<string, Date>()
  for (const appt of futureAppointments) {
    const phone = normalizeToE164(appt.phone)
    if (!phone) continue
    const dt = new Date(appt.datetime)
    const existing = soonestByPhone.get(phone)
    if (!existing || dt < existing) {
      soonestByPhone.set(phone, dt)
    }
  }

  for (const [phone, apptDatetime] of soonestByPhone) {
    const { data: client, error } = await supabase
      .from('acuity_clients')
      .select('client_id, next_future_appointment')
      .eq('user_id', userId)
      .eq('phone_normalized', phone)
      .maybeSingle()

    if (error || !client) continue

    const existing = client.next_future_appointment
      ? new Date(client.next_future_appointment)
      : null

    if (existing && existing <= apptDatetime) continue

    const { error: updateError } = await supabase
      .from('acuity_clients')
      .update({ next_future_appointment: apptDatetime.toISOString() })
      .eq('user_id', userId)
      .eq('client_id', client.client_id)

    if (updateError) {
      console.error(`[backfill] Failed to set next_future_appointment for client ${client.client_id}:`, updateError)
    }
  }
}

// ---------------------------------------------------------------------------
// backfillLastAppt — updates last_appt on acuity_clients from Acuity data.
//
// This catches cases where the webhook failed to fire or was not recognized,
// so that the nudge selection algorithm sees an accurate last_appt and does
// not treat a recently-seen client as "at risk".
//
// Uses the appointment DATE (YYYY-MM-DD in Toronto tz) to match the existing
// last_appt column format.
// ---------------------------------------------------------------------------

async function backfillLastAppt(
  userId: string,
  appointments: any[]
): Promise<void> {
  const now = new Date()

  // Only consider past appointments (already happened)
  const pastAppointments = appointments.filter(appt => {
    if (!appt.datetime) return false
    const dt = new Date(appt.datetime)
    return !isNaN(dt.getTime()) && dt <= now
  })

  if (pastAppointments.length === 0) return

  // Find the most recent past appointment date per phone
  const latestByPhone = new Map<string, string>() // phone → YYYY-MM-DD
  for (const appt of pastAppointments) {
    const phone = normalizeToE164(appt.phone)
    if (!phone) continue

    const apptDate = toEnCA(new Date(appt.datetime)) // YYYY-MM-DD Toronto tz
    const existing = latestByPhone.get(phone)

    if (!existing || apptDate > existing) {
      latestByPhone.set(phone, apptDate)
    }
  }

  let updated = 0

  for (const [phone, latestDate] of latestByPhone) {
    const { data: client, error } = await supabase
      .from('acuity_clients')
      .select('client_id, last_appt')
      .eq('user_id', userId)
      .eq('phone_normalized', phone)
      .maybeSingle()

    if (error || !client) continue

    // Only update if Acuity shows a more recent appointment than what's stored
    if (client.last_appt && client.last_appt >= latestDate) continue

    const { error: updateError } = await supabase
      .from('acuity_clients')
      .update({ last_appt: latestDate })
      .eq('user_id', userId)
      .eq('client_id', client.client_id)

    if (updateError) {
      console.error(`[backfillLastAppt] Failed to update last_appt for client ${client.client_id}:`, updateError)
    } else {
      updated++
    }
  }

  if (updated > 0) {
    console.log(`[backfillLastAppt] Updated last_appt for ${updated} client(s) of user ${userId}`)
  }
}

async function processBarber(userId: string, recentWeeks: string[], calendar: string) {
  // Get access token
  const accessToken = await getAccessToken(userId)
  if (!accessToken) {
    console.warn(`No access token for user ${userId}`)
    return { userId, success: false, reason: 'No access token' }
  }

  // Fetch all buckets for this user across the last 2 weeks
  const { data: buckets, error: bucketsError } = await supabase
    .from('sms_smart_buckets')
    .select('bucket_id, campaign_start, clients, total_clients, iso_week')
    .eq('user_id', userId)
    .in('iso_week', recentWeeks)
    .order('campaign_start', { ascending: false })

  if (bucketsError || !buckets || buckets.length === 0) {
    console.warn(`No smart buckets for ${userId} in weeks ${recentWeeks.join(', ')}`)
    return { userId, success: false, reason: 'No smart bucket' }
  }

  // Fetch all appointments once — shared across all bucket checks
  const allAppointments = await getAllAcuityAppointments(accessToken, calendar)

  // Backfill both future and past appointment data on acuity_clients.
  // This eliminates the webhook as a single point of failure:
  //   - backfillNextFutureAppointment: sets next_future_appointment for upcoming bookings
  //   - backfillLastAppt: updates last_appt for recent past bookings
  // Both run ~30 min before the Monday nudge, so the selection algorithm has accurate data.
  await backfillNextFutureAppointment(userId, allAppointments)
  await backfillLastAppt(userId, allAppointments)

  const normalizePhone = (phoneStr: string) => {
    if (!phoneStr) return ''
    return phoneStr.replace(/^\+?1/, '')
  }

  const DEBUG_PHONE = '6475752770'

  const appointmentsByPhone = new Map<string, any[]>()
  for (const appt of allAppointments) {
    const normalized = normalizePhone(appt.phone)
    if (normalized === DEBUG_PHONE) {
      console.log(`🔍 DEBUG: found target phone ${DEBUG_PHONE} in raw appointments`, JSON.stringify(appt, null, 2))
    }
    if (!appointmentsByPhone.has(normalized)) {
      appointmentsByPhone.set(normalized, [])
    }
    appointmentsByPhone.get(normalized)!.push(appt)
  }

  let overallSuccess = false

  // Process each bucket independently and upsert its own barber_nudge_success row
  for (const bucket of buckets) {
    const bucketClients: Array<{ phone: string; client_id: string; full_name: string }> =
      typeof bucket.clients === 'string' ? JSON.parse(bucket.clients) : bucket.clients

    if (!bucketClients || bucketClients.length === 0) {
      console.warn(`Empty clients array for bucket ${bucket.bucket_id}`)
      continue
    }

    const messagesDelivered = bucket.total_clients
    const isoWeek = bucket.iso_week

    const campaignStart = new Date(bucket.campaign_start)

    const clientIdsToAdd: string[] = []
    const servicesToAdd: string[] = []
    const pricesToAdd: number[] = []
    const appointmentDatesToAdd: string[] = []
    let clickedLinkCount = 0
    let appointmentsFound = false

    for (const { phone } of bucketClients) {
      const normalizedPhone = normalizePhone(phone)
      const appointments = appointmentsByPhone.get(normalizedPhone) || []

      const appointmentsAfterSMS = appointments
        .filter(appt => appt.datetimeCreated && new Date(appt.datetimeCreated) > campaignStart)
        .sort((a, b) => {
          const dateA = new Date(a.datetime || a.datetimeCreated).getTime()
          const dateB = new Date(b.datetime || b.datetimeCreated).getTime()
          return dateA - dateB
        })

      if (appointmentsAfterSMS.length === 0) continue

      appointmentsFound = true
      const firstAppt = appointmentsAfterSMS[0]

      console.log(`Client phone: ${phone} — attributed to bucket ${bucket.bucket_id} (${isoWeek})`)

      const { data: client } = await supabase
        .from('acuity_clients')
        .select('client_id, last_date_clicked_link')
        .eq('user_id', userId)
        .eq('phone_normalized', phone)
        .single()

      if (client) {
        clientIdsToAdd.push(client.client_id)
        servicesToAdd.push(firstAppt.type || 'Unknown')
        pricesToAdd.push(Math.round(Number(firstAppt.price)) || 0)
        appointmentDatesToAdd.push(parseToUTCTimestamp(firstAppt.datetime))

        if (client.last_date_clicked_link) {
          const clickedAt = new Date(client.last_date_clicked_link)
          if (clickedAt > campaignStart) {
            clickedLinkCount++
          }
        }
      }
    }

    if (!appointmentsFound) {
      console.log(`No appointments found for user ${userId} bucket ${isoWeek}`)
      continue
    }

    // Upsert barber_nudge_success for this specific week's bucket
    const { data: existing } = await supabase
      .from('barber_nudge_success')
      .select('id, client_ids, services, prices, appointment_dates')
      .eq('user_id', userId)
      .eq('iso_week_number', isoWeek)
      .single()

    if (existing) {
      const existingClientIds = existing.client_ids || []
      const mergedClientIds = [...existingClientIds]
      const mergedServices = [...(existing.services || [])]
      const mergedPrices = [...(existing.prices || [])]
      const mergedAppointmentDates = [...(existing.appointment_dates || [])]

      for (let i = 0; i < clientIdsToAdd.length; i++) {
        if (!existingClientIds.includes(clientIdsToAdd[i])) {
          mergedClientIds.push(clientIdsToAdd[i])
          mergedServices.push(servicesToAdd[i])
          mergedPrices.push(pricesToAdd[i])
          mergedAppointmentDates.push(appointmentDatesToAdd[i])
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

      console.log(`Updated barber_nudge_success for user ${userId} week ${isoWeek}`)
    } else {
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

      console.log(`Created barber_nudge_success for user ${userId} week ${isoWeek}`)
    }

    overallSuccess = true
  }

  return { userId, success: overallSuccess }
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

    const url = new URL(req.url)
    const targetUserId = url.searchParams.get('user_id')
    console.log(`target user_id: ${targetUserId ?? 'all'}`)

    const recentWeeks = getRecentISOWeeks(2)
    console.log(`Checking ISO weeks: ${recentWeeks.join(', ')}`)

    // Fetch all barbers who have a bucket in the last 2 weeks — no sms_engaged_current_week filter
    const { data: bucketUsers, error: bucketUsersError } = await supabase
      .from('sms_smart_buckets')
      .select('user_id')
      .in('iso_week', recentWeeks)

    if (bucketUsersError) throw bucketUsersError

    if (!bucketUsers || bucketUsers.length === 0) {
      return new Response(JSON.stringify({
        message: 'No buckets found in the last 2 weeks',
        recentWeeks,
        totalBarbers: 0,
        results: []
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 200,
      })
    }

    // Deduplicate user_ids
    let userIds = [...new Set(bucketUsers.map(r => r.user_id))]
    if (targetUserId) {
      userIds = userIds.filter(id => id === targetUserId)
    }

    if (userIds.length === 0) {
      return new Response(JSON.stringify({
        message: `No buckets found for user_id: ${targetUserId}`,
        recentWeeks,
        totalBarbers: 0,
        results: []
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 200,
      })
    }

    // Fetch calendar for each user
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, calendar, full_name')
      .in('user_id', userIds)
      .not('calendar', 'is', null)
      .neq('calendar', '')

    if (profileError) throw profileError

    console.log(`Processing ${profiles?.length ?? 0} barber(s)`)

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

            processBarber(barber.user_id, recentWeeks, barber.calendar)
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

    console.log(`Appointments look ahead completed. Success: ${successCount}, Failed: ${failCount}`)
    console.log(`SYNC ENDED`)

    return new Response(JSON.stringify({
      message: 'Appointments look ahead completed',
      mode: targetUserId ? 'specific_user' : 'all_with_recent_buckets',
      recentWeeks,
      totalBarbers: profiles?.length || 0,
      success: successCount,
      failed: failCount,
      results
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    })
  } catch (err: unknown) {
    console.error('Edge function error:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})