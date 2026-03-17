// supabase/functions/backfill_next_future_appointment/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '',
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '',
)

const apiBase = 'https://acuityscheduling.com/api/v1'

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
  url.searchParams.set('max', 1000)

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    console.error(`Acuity API error: ${response.status}`)
    return []
  }

  return await response.json()
}

async function backfillNextFutureAppointment(
  userId: string,
  appointments: any[]
): Promise<{ updated: number; skipped: number }> {
  const now = new Date()
  let updated = 0
  let skipped = 0

  const futureAppointments = appointments.filter(appt => {
    if (!appt.datetime) return false
    const dt = new Date(appt.datetime)
    return !isNaN(dt.getTime()) && dt > now
  })

  if (futureAppointments.length === 0) return { updated, skipped }

  const normalizeToE164 = (raw: string | null | undefined): string | null => {
    if (!raw) return null
    const digits = raw.replace(/\D/g, '')
    if (!digits) return null
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
    if (digits.length === 10) return `+1${digits}`
    if (raw.trimStart().startsWith('+') && digits.length >= 11) return `+${digits}`
    return `+${digits}`
  }

  // Group future appointments by normalized phone, keeping only the soonest per client
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

    if (error || !client) {
      skipped++
      continue
    }

    const existing = client.next_future_appointment
      ? new Date(client.next_future_appointment)
      : null

    if (existing && existing <= apptDatetime) {
      skipped++
      continue
    }

    const { error: updateError } = await supabase
      .from('acuity_clients')
      .update({ next_future_appointment: apptDatetime.toISOString() })
      .eq('user_id', userId)
      .eq('client_id', client.client_id)

    if (updateError) {
      console.error(`Failed to update client ${client.client_id}:`, updateError)
      skipped++
    } else {
      console.log(`✅ ${client.client_id} → ${apptDatetime.toISOString()}`)
      updated++
    }
  }

  return { updated, skipped }
}

async function processUser(userId: string, calendar: string) {
  const accessToken = await getAccessToken(userId)
  if (!accessToken) {
    return { userId, success: false, reason: 'No access token' }
  }

  const appointments = await getAllAcuityAppointments(accessToken, calendar)
  const { updated, skipped } = await backfillNextFutureAppointment(userId, appointments)

  console.log(`User ${userId}: ${appointments.length} appointments fetched, ${updated} updated, ${skipped} skipped`)

  return { userId, success: true, appointmentsFetched: appointments.length, updated, skipped }
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
    console.log('STARTING BACKFILL NEXT FUTURE APPOINTMENT')

    // Optional single user mode
    const url = new URL(req.url)
    const targetUserId = url.searchParams.get('user_id')

    let query = supabase
      .from('profiles')
      .select('user_id, calendar, full_name')
      .not('calendar', 'is', null)
      .neq('calendar', '')

    if (targetUserId) {
      query = query.eq('user_id', targetUserId)
    }

    const { data: profiles, error: profileError } = await query

    if (profileError) throw profileError

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: 'No profiles found', totalUsers: 0 }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 200,
      })
    }

    console.log(`Processing ${profiles.length} user(s)`)

    const CONCURRENCY_LIMIT = 5
    const results: any[] = []

    async function processWithConcurrency(items: typeof profiles, limit: number) {
      let active = 0
      let index = 0

      return new Promise<void>(resolve => {
        function next() {
          while (active < limit && index < items.length) {
            const profile = items[index++]
            active++

            processUser(profile.user_id, profile.calendar)
              .then(result => {
                results.push(result)
              })
              .catch(err => {
                console.error(`Error processing ${profile.full_name}:`, err)
                results.push({ userId: profile.user_id, success: false, error: String(err) })
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

    await processWithConcurrency(profiles, CONCURRENCY_LIMIT)

    const successCount = results.filter(r => r.success).length
    const totalUpdated = results.reduce((sum, r) => sum + (r.updated ?? 0), 0)

    console.log(`BACKFILL COMPLETE — ${successCount}/${profiles.length} users succeeded, ${totalUpdated} clients updated`)

    return new Response(JSON.stringify({
      message: 'Backfill complete',
      mode: targetUserId ? 'specific_user' : 'all_users',
      totalUsers: profiles.length,
      success: successCount,
      totalUpdated,
      results,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    })
  } catch (err: unknown) {
    console.error('Edge function error:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})