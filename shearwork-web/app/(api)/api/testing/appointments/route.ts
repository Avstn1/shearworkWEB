// app/api/debug/february-appointments/route.ts

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
  url.searchParams.set('maxDate', '2026-03-31')
  url.searchParams.set('offset', '0')
  url.searchParams.set('calendarID', calendarId)
  url.searchParams.set('firstName', 'Chris')
  url.searchParams.set('lastName', 'Gil')


  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    console.error(`Acuity API error: ${response.status} ${await response.text()}`)
    return []
  }

  return await response.json()
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ error: 'user_id query param is required' }, { status: 400 })
    }

    const accessToken = await getAccessToken(userId)
    if (!accessToken) {
      return NextResponse.json({ error: `No access token for user ${userId}` }, { status: 404 })
    }

    const calendar = await getCalendar(userId)
    if (!calendar) {
      return NextResponse.json({ error: `No calendar for user ${userId}` }, { status: 404 })
    }

    const appointments = await getFebruaryAppointments(accessToken, calendar)

    return NextResponse.json({
      userId,
      calendar,
      totalAppointments: appointments.length,
      appointments,
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}