import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { createClient } from '@supabase/supabase-js'

const ACUITY_API_BASE = 'https://acuityscheduling.com/api/v1'
const WORK_START_HOUR = 8
const WORK_END_HOUR = 20

// ------------------- Date helpers -------------------
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

  const toStr = (d: Date) => d.toISOString().split('T')[0]
  return { start: toStr(start), end: toStr(end) }
}

function getWeekDays(start: string, end: string) {
  const days: string[] = []
  for (let d = new Date(start); d <= new Date(end); d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

// ------------------- Appointment helpers -------------------
async function getAppointmentTypeWithShortestDuration(accessToken: string): Promise<number | null> {
  const res = await fetch(`${ACUITY_API_BASE}/appointment-types`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const types = await res.json()
  if (!Array.isArray(types) || !types.length) return null
  return types.reduce((shortest: any, t: any) => (t.duration < shortest.duration ? t : shortest)).id
}

// ------------------- Merge intervals -------------------
function mergeIntervals(intervals: { start: number; end: number }[]) {
  if (!intervals.length) return { merged: [], totalMinutes: 0 }

  intervals.sort((a, b) => a.start - b.start)
  const merged: { start: number; end: number }[] = []
  let current = { ...intervals[0] }

  for (let i = 1; i < intervals.length; i++) {
    const slot = intervals[i]
    if (slot.start <= current.end) current.end = Math.max(current.end, slot.end)
    else {
      merged.push({ ...current })
      current = { ...slot }
    }
  }
  merged.push(current)

  const totalMinutes = merged.reduce((sum, i) => sum + (i.end - i.start) / 60000, 0)
  return { merged, totalMinutes }
}

// ------------------- Interval subtraction -------------------
function subtractIntervals(
  open: { start: number; end: number }[],
  booked: { start: number; end: number }[]
): { start: number; end: number }[] {
  const result: { start: number; end: number }[] = []

  for (const o of open) {
    let currentStart = o.start
    let currentEnd = o.end

    for (const b of booked) {
      if (b.end <= currentStart || b.start >= currentEnd) continue // no overlap

      if (b.start <= currentStart && b.end < currentEnd) currentStart = b.end
      else if (b.start > currentStart && b.end >= currentEnd) currentEnd = b.start
      else if (b.start > currentStart && b.end < currentEnd) {
        result.push({ start: currentStart, end: b.start })
        currentStart = b.end
      } else if (b.start <= currentStart && b.end >= currentEnd) {
        currentStart = currentEnd // fully covered
      }
    }

    if (currentStart < currentEnd) result.push({ start: currentStart, end: currentEnd })
  }

  return result
}

// ------------------- Fetch availability -------------------
async function fetchDayAvailability(accessToken: string, calendarId: number, appointmentTypeID: number, day: string) {
  const url = new URL(`${ACUITY_API_BASE}/availability/times`)
  url.searchParams.set('date', day)
  url.searchParams.set('calendarID', String(calendarId))
  url.searchParams.set('appointmentTypeID', String(appointmentTypeID))

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) return { raw: [], merged: [], totalMinutes: 0 }

  const slots = await res.json()
  if (!Array.isArray(slots) || !slots.length) return { raw: [], merged: [], totalMinutes: 0 }

  const workStart = new Date(`${day}T00:00:00`)
  workStart.setHours(WORK_START_HOUR, 0, 0, 0)
  const workEnd = new Date(`${day}T00:00:00`)
  workEnd.setHours(WORK_END_HOUR, 0, 0, 0)

  const intervals: { start: number; end: number }[] = slots
    .map((s: any) => {
      const start = Math.max(new Date(s.time).getTime(), workStart.getTime())
      const end = Math.min(start + (s.duration ?? 30) * 60000, workEnd.getTime())
      return { start, end }
    })
    .filter(i => i.start < i.end)

  const { merged, totalMinutes } = mergeIntervals(intervals)

  return { raw: intervals, merged, totalMinutes }
}

// ------------------- Fetch booked minutes -------------------
async function fetchDayBookedMinutes(accessToken: string, calendarId: number, day: string) {
  const url = new URL(`${ACUITY_API_BASE}/appointments`)
  url.searchParams.set('minDate', day)
  url.searchParams.set('maxDate', day)
  url.searchParams.set('calendarID', String(calendarId))
  url.searchParams.set('showall', 'true')

  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) return { totalMinutes: 0, intervals: [] }

  const data = await res.json()
  if (!Array.isArray(data)) return { totalMinutes: 0, intervals: [] }

  const intervals: { start: number; end: number }[] = []

  for (const appt of data) {
    if (appt.canceled || appt.noShow || !appt.datetime || !appt.duration) continue
    const start = new Date(appt.datetime).getTime()
    const duration = typeof appt.duration === 'number' ? appt.duration : parseInt(appt.duration ?? '0', 10)
    intervals.push({ start, end: start + duration * 60000 })
  }

  const { merged, totalMinutes } = mergeIntervals(intervals)
  return { totalMinutes, intervals: merged }
}

// ------------------- API handler -------------------
// ------------------- API handler -------------------
export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)
  if (!user || !supabase) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('calendar')
      .eq('user_id', user.id)
      .single()
    if (!profile?.calendar) return NextResponse.json({ error: 'Calendar not configured' }, { status: 400 })

    const { data: tokenRow } = await serviceClient
      .from('acuity_tokens')
      .select('access_token')
      .eq('user_id', user.id)
      .single()
    if (!tokenRow) return NextResponse.json({ error: 'No Acuity token' }, { status: 400 })

    const accessToken = tokenRow.access_token

    const calendarsRes = await fetch(`${ACUITY_API_BASE}/calendars`, { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!calendarsRes.ok) return NextResponse.json({ error: 'Failed to fetch calendars' }, { status: 500 })
    const calendars = await calendarsRes.json()
    const match = calendars.find((c: any) => c.name?.trim().toLowerCase() === profile.calendar.trim().toLowerCase())
    if (!match) return NextResponse.json({ error: 'Calendar not found' }, { status: 400 })

    const calendarId = match.id
    const appointmentTypeID = await getAppointmentTypeWithShortestDuration(accessToken)
    if (!appointmentTypeID) return NextResponse.json({ error: 'No appointment types found' }, { status: 400 })

    const { start, end } = getWeekRange()
    const days = getWeekDays(start, end)

    const results = await Promise.all(
      days.map(async (day) => {
        const [booked, open] = await Promise.all([
          fetchDayBookedMinutes(accessToken, calendarId, day),
          fetchDayAvailability(accessToken, calendarId, appointmentTypeID, day),
        ])

        const finalOpenIntervals = subtractIntervals(open.merged, booked.intervals)
        const finalOpenMinutes = finalOpenIntervals.reduce((sum, i) => sum + (i.end - i.start) / 60000, 0)

        // --- Human-readable logging ---
        console.log(`\n=== ${day} ===`)
        console.log(`Booked minutes: ${booked.totalMinutes}`)
        console.log(`Booked intervals:`)
        booked.intervals.forEach((i, idx) => {
          console.log(
            `  ${idx + 1}. ${new Date(i.start).toLocaleTimeString('en-US', { timeZone: 'America/Toronto' })} → ${new Date(
              i.end
            ).toLocaleTimeString('en-US', { timeZone: 'America/Toronto' })}`
          )
        })

        console.log(`Open intervals (filtered for bookings):`)
        finalOpenIntervals.forEach((i, idx) => {
          console.log(
            `  ${idx + 1}. ${new Date(i.start).toLocaleTimeString('en-US', { timeZone: 'America/Toronto' })} → ${new Date(
              i.end
            ).toLocaleTimeString('en-US', { timeZone: 'America/Toronto' })}`
          )
        })
        console.log(`Open minutes: ${finalOpenMinutes}`)

        return {
          day,
          bookedMinutes: booked.totalMinutes,
          openMinutes: finalOpenMinutes,
          bookedIntervals: booked.intervals,
          openIntervals: finalOpenIntervals,
        }
      })
    )

    const totalBooked = results.reduce((sum, r) => sum + r.bookedMinutes, 0)
    const totalOpen = results.reduce((sum, r) => sum + r.openMinutes, 0)

    console.log(`\n=== Week Summary (${start} → ${end}) ===`)
    console.log(`Total booked minutes: ${totalBooked}`)
    console.log(`Total open minutes: ${totalOpen}`)
    console.log(`Total capacity: ${Math.round((totalBooked / (totalBooked + totalOpen)) * 100)}%`)

    return NextResponse.json({ totalBooked, totalOpen, weekStart: start, weekEnd: end })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to calculate booking capacity' }, { status: 500 })
  }
}