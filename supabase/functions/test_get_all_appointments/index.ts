// supabase/functions/test_get_all_appointments/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '',
  Deno.env.get("SERVICE_ROLE_KEY") ?? '',
)

const apiBase = 'https://acuityscheduling.com/api/v1'

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

async function getCalendar(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('calendar')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    console.error(`No profile for user ${userId}:`, error)
    return null
  }

  return data.calendar
}

async function getFebruaryAppointments(
  accessToken: string,
  calendarId: string
): Promise<any[]> {
  const url = new URL(`${apiBase}/appointments`)
  url.searchParams.set('minDate', '2026-02-01')
  url.searchParams.set('maxDate', '2026-02-28')
  url.searchParams.set('offset', '0')
  url.searchParams.set('calendarID', calendarId)

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    console.error(`Acuity API error: ${response.status} ${await response.text()}`)
    return []
  }

  return await response.json()
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
    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id')

    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id query param is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const accessToken = await getAccessToken(userId)
    if (!accessToken) {
      return new Response(JSON.stringify({ error: `No access token for user ${userId}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const calendar = await getCalendar(userId)
    if (!calendar) {
      return new Response(JSON.stringify({ error: `No calendar for user ${userId}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    console.log(`Fetching February 2026 appointments for user ${userId}, calendar ${calendar}`)

    const appointments = await getFebruaryAppointments(accessToken, calendar)

    console.log(`Total appointments found: ${appointments.length}`)
    console.log(JSON.stringify(appointments, null, 2))

    return new Response(JSON.stringify({
      userId,
      calendar,
      totalAppointments: appointments.length,
      appointments,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
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