import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { createClient } from '@supabase/supabase-js'

const ACUITY_API_BASE = 'https://acuityscheduling.com/api/v1'

function getWeekRange() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const start = new Date(now)
  start.setDate(now.getDate() + diff)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  const toDateStr = (d: Date) => d.toISOString().split('T')[0]
  return { start: toDateStr(start), end: toDateStr(end) }
}

// Returns total booked minutes for a given day (sum of appointment durations).
async function fetchDayBookedMinutes(
  accessToken: string,
  calendarId: string,
  dayStr: string
): Promise<number> {
  const pageSize = 100
  let offset = 0
  let totalMinutes = 0

  while (true) {
    const url = new URL(`${ACUITY_API_BASE}/appointments`)
    url.searchParams.set('minDate', dayStr)
    url.searchParams.set('maxDate', dayStr)
    url.searchParams.set('max', String(pageSize))
    url.searchParams.set('offset', String(offset))
    url.searchParams.set('calendarID', String(calendarId))
    url.searchParams.set('showall', 'true')

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      console.error(`Acuity fetch failed for ${dayStr}: ${response.status}`)
      break
    }

    const data = await response.json()
    if (!Array.isArray(data) || data.length === 0) break

    for (const appt of data) {
      if (appt.canceled || appt.noShow) continue

      const durationMinutes = typeof appt.duration === 'number'
        ? appt.duration
        : parseInt(appt.duration ?? '0', 10)

      if (durationMinutes > 0) {
        totalMinutes += durationMinutes
      }
    }

    if (data.length < pageSize) break
    offset += pageSize
  }

  return totalMinutes
}

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Use service role client for DB queries to avoid RLS/cookie auth mismatch
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {

    // 1. Get slot_length_minutes from profile
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('calendar')
      .eq('user_id', user.id)
      .single()


    if (profileError || !profile?.calendar) {
      return NextResponse.json({ error: 'No calendar configured' }, { status: 400 })
    }


    // 2. Get Acuity access token
    const { data: tokenRow, error: tokenError } = await serviceClient
      .from('acuity_tokens')
      .select('access_token, expires_in, refresh_token, updated_at')
      .eq('user_id', user.id)
      .single()


    if (tokenError || !tokenRow) {
      return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400 })
    }

    // 3. Refresh token if expired
    let accessToken = tokenRow.access_token
    const nowSec = Math.floor(Date.now() / 1000)
    const tokenUpdatedAt = tokenRow.updated_at ? Math.floor(new Date(tokenRow.updated_at).getTime() / 1000) : 0
    const tokenExpiresAt = tokenUpdatedAt + (tokenRow.expires_in ?? 0)
    if (tokenRow.expires_in && tokenExpiresAt < nowSec) {
      const refreshResponse = await fetch('https://acuityscheduling.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenRow.refresh_token,
          client_id: process.env.ACUITY_CLIENT_ID!,
          client_secret: process.env.ACUITY_CLIENT_SECRET!,
        }),
      })
      const newTokens = await refreshResponse.json()
      if (!refreshResponse.ok) {
        return NextResponse.json({ error: 'Failed to refresh Acuity token' }, { status: 400 })
      }
      accessToken = newTokens.access_token
      await serviceClient
        .from('acuity_tokens')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token ?? tokenRow.refresh_token,
          expires_in: newTokens.expires_in,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
    }

    // 4. Resolve calendar ID
    const calendarResponse = await fetch(`${ACUITY_API_BASE}/calendars`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!calendarResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch calendars' }, { status: 500 })
    }

    const calendars: any[] = await calendarResponse.json()
    const match = calendars.find(
      (c) => c.name?.trim().toLowerCase() === profile.calendar.trim().toLowerCase()
    )

    if (!match) {
      return NextResponse.json({ error: 'No matching calendar found' }, { status: 400 })
    }

    const calendarId = match.id

    // 5. Fetch total booked minutes for each day this week
    const { start, end } = getWeekRange()
    const startDate = new Date(start)
    const endDate = new Date(end)

    let totalBookedMinutes = 0
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0]
      const minutes = await fetchDayBookedMinutes(accessToken, calendarId, dayStr)
      totalBookedMinutes += minutes
    }

    return NextResponse.json({
      bookedMinutes: totalBookedMinutes,
      weekStart: start,
      weekEnd: end,
    })

  } catch (err) {
    console.error('Booking rate fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch booking rate', details: String(err) }, { status: 500 })
  }
}