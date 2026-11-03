import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { businessNow, businessTimeToUtcMs, businessWeekRange, datesBetween } from '@/lib/booking/torontoTime'

const ACUITY_API_BASE = 'https://acuityscheduling.com/api/v1'
const WORK_START_HOUR = 8
const WORK_END_HOUR = 20
const BOOKING_RATE_CACHE_TTL_MS = 5 * 60 * 1000
// v2: working hours in Toronto time, rest of the week only, same calendar as open-bookings
const BOOKING_RATE_CACHE_VERSION = 'remaining-week-v2'

type BookingRatePayload = {
  totalBooked: number
  totalOpen: number
  weekStart: string
  weekEnd: string
}

type BookingRateCacheEntry = {
  payload: BookingRatePayload
  cachedAtMs: number
}

type AcuityAppointmentType = {
  id: number | string
  name?: string | null
  duration?: number | string | null
}

type AcuityCalendar = {
  id: number | string
  name?: string | null
}

type AcuityAvailabilitySlot = {
  time?: string
  duration?: number | string | null
}

const bookingRateCache = new Map<string, BookingRateCacheEntry>()
const bookingRateInFlight = new Map<string, Promise<BookingRatePayload>>()

function cleanupBookingRateCache(nowMs: number) {
  for (const [key, entry] of bookingRateCache.entries()) {
    if (nowMs - entry.cachedAtMs > BOOKING_RATE_CACHE_TTL_MS * 6) {
      bookingRateCache.delete(key)
    }
  }
}

function buildBookingRateCacheKey(params: {
  userId: string
  weekStart: string
  weekEnd: string
  calendarId: number | string
  role: string | null | undefined
}) {
  return [
    BOOKING_RATE_CACHE_VERSION,
    params.userId,
    params.weekStart,
    params.weekEnd,
    String(params.calendarId),
    params.role ?? 'unknown',
  ].join('|')
}

// ------------------- Working window -------------------
/** The part of `day`'s working hours (Toronto time) still ahead of `nowMs`, or null if none. */
function remainingWorkWindow(day: string, nowMs: number): { start: number; end: number } | null {
  const workStart = businessTimeToUtcMs(day, WORK_START_HOUR * 60)
  const workEnd = businessTimeToUtcMs(day, WORK_END_HOUR * 60)
  const start = Math.max(workStart, nowMs)
  return start < workEnd ? { start, end: workEnd } : null
}

function clipIntervals(intervals: { start: number; end: number }[], window: { start: number; end: number }) {
  return intervals
    .map(i => ({ start: Math.max(i.start, window.start), end: Math.min(i.end, window.end) }))
    .filter(i => i.start < i.end)
}

// ------------------- Appointment helpers -------------------

async function getRandomAppointmentTypeFromRecent(
  accessToken: string,
  calendarId: number | string
): Promise<number | string | null> {
  const url = new URL(`${ACUITY_API_BASE}/appointments`)
  url.searchParams.set('max', '1')
  url.searchParams.set('calendarID', String(calendarId))
  url.searchParams.set('showall', 'true')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) return null

  const appts = await res.json()
  if (!Array.isArray(appts) || !appts.length) return null

  const apptType = appts[0].appointmentTypeID

  console.log('\n=== Owner Mode: Using Appointment Type From Recent Booking ===')
  console.log(`Appointment Type ID: ${apptType}`)

  return apptType
}

async function getAppointmentTypeWithShortestDuration(
  accessToken: string
): Promise<number | string | null> {
  const res = await fetch(`${ACUITY_API_BASE}/appointment-types`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) return null

  const types = (await res.json()) as AcuityAppointmentType[]
  if (!Array.isArray(types) || !types.length) return null

  const shortest = types.reduce((currentShortest, typeRow) => (
    (typeRow.duration ?? Number.POSITIVE_INFINITY) <
    (currentShortest.duration ?? Number.POSITIVE_INFINITY)
      ? typeRow
      : currentShortest
  ))

  console.log('\n=== Appointment Types ===')
  types.forEach((typeRow) => {
    console.log(`ID: ${typeRow.id} | Name: ${typeRow.name} | Duration: ${typeRow.duration}`)
  })

  console.log(`\nUsing shortest appointment type:`)
  console.log(`ID: ${shortest.id}`)

  return shortest.id
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
      if (b.end <= currentStart || b.start >= currentEnd) continue

      if (b.start <= currentStart && b.end < currentEnd) currentStart = b.end
      else if (b.start > currentStart && b.end >= currentEnd) currentEnd = b.start
      else if (b.start > currentStart && b.end < currentEnd) {
        result.push({ start: currentStart, end: b.start })
        currentStart = b.end
      }
      else if (b.start <= currentStart && b.end >= currentEnd) {
        currentStart = currentEnd
      }
    }

    if (currentStart < currentEnd) result.push({ start: currentStart, end: currentEnd })
  }

  return result
}

// ------------------- Fetch availability -------------------
async function fetchDayAvailability(
  accessToken: string,
  calendarId: number | string,
  appointmentTypeID: number | string,
  day: string,
  window: { start: number; end: number }
) {

  const url = new URL(`${ACUITY_API_BASE}/availability/times`)
  url.searchParams.set('date', day)
  url.searchParams.set('calendarID', String(calendarId))
  url.searchParams.set('appointmentTypeID', String(appointmentTypeID))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) return { raw: [], merged: [], totalMinutes: 0 }

  const slots = (await res.json()) as AcuityAvailabilitySlot[]
  if (!Array.isArray(slots) || !slots.length) return { raw: [], merged: [], totalMinutes: 0 }

  // Acuity times carry the calendar's UTC offset, so compare as absolute instants
  const intervals = clipIntervals(
    slots
      .map((slot) => {
        if (!slot.time) return null
        const start = new Date(slot.time).getTime()
        const duration = Number(slot.duration ?? 30)
        if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) return null
        return { start, end: start + duration * 60000 }
      })
      .filter((interval): interval is { start: number; end: number } => interval !== null),
    window
  )

  const { merged, totalMinutes } = mergeIntervals(intervals)

  return { raw: intervals, merged, totalMinutes }
}

// ------------------- Fetch booked minutes -------------------
async function fetchDayBookedMinutes(
  accessToken: string,
  calendarId: number | string,
  day: string,
  window: { start: number; end: number }
) {

  const url = new URL(`${ACUITY_API_BASE}/appointments`)
  url.searchParams.set('minDate', day)
  url.searchParams.set('maxDate', day)
  url.searchParams.set('calendarID', String(calendarId))
  url.searchParams.set('showall', 'true')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) return { totalMinutes: 0, intervals: [] }

  const data = await res.json()
  if (!Array.isArray(data)) return { totalMinutes: 0, intervals: [] }

  const intervals: { start: number; end: number }[] = []

  for (const appt of data) {
    if (appt.canceled || appt.noShow || !appt.datetime || !appt.duration) continue

    const start = new Date(appt.datetime).getTime()
    const duration = typeof appt.duration === 'number'
      ? appt.duration
      : parseInt(appt.duration ?? '0', 10)

    intervals.push({
      start,
      end: start + duration * 60000
    })
  }

  const { merged, totalMinutes } = mergeIntervals(clipIntervals(intervals, window))

  return { totalMinutes, intervals: merged }
}

// ------------------- API handler -------------------
export async function GET(request: Request) {

  const { user, supabase } = await getAuthenticatedUser(request)
  if (!user || !supabase)
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const serviceClient = createSupabaseAdminClient()

  try {

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('calendar, role')
      .eq('user_id', user.id)
      .single()

    if (!profile?.calendar)
      return NextResponse.json({ error: 'Calendar not configured' }, { status: 400 })

    const { data: tokenRow } = await serviceClient
      .from('acuity_tokens')
      .select('access_token, calendar_id')
      .eq('user_id', user.id)
      .single()

    if (!tokenRow)
      return NextResponse.json({ error: 'No Acuity token' }, { status: 400 })

    const accessToken = tokenRow.access_token

    // Same calendar as open-bookings: the ID saved with the Acuity connection, falling
    // back to matching the profile's calendar name
    let calendarId: number | string | null = tokenRow.calendar_id ?? null
    if (calendarId === null) {
      const calendarsRes = await fetch(`${ACUITY_API_BASE}/calendars`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      const calendars = (await calendarsRes.json()) as AcuityCalendar[]

      const match = calendars.find(
        (calendar) =>
          calendar.name?.trim().toLowerCase() === profile.calendar.trim().toLowerCase()
      )

      if (!match)
        return NextResponse.json({ error: 'Calendar not found' }, { status: 400 })

      calendarId = match.id
    }
    const { startDate: start, endDate: end } = businessWeekRange()
    const cacheKey = buildBookingRateCacheKey({
      userId: user.id,
      weekStart: start,
      weekEnd: end,
      calendarId,
      role: profile.role,
    })

    const nowMs = Date.now()
    cleanupBookingRateCache(nowMs)

    const cached = bookingRateCache.get(cacheKey)
    if (cached && nowMs - cached.cachedAtMs <= BOOKING_RATE_CACHE_TTL_MS) {
      return NextResponse.json(cached.payload)
    }

    const inFlight = bookingRateInFlight.get(cacheKey)
    if (inFlight) {
      const shared = await inFlight
      return NextResponse.json(shared)
    }

    const computePromise = (async (): Promise<BookingRatePayload> => {
      let appointmentTypeID: number | string | null = null

      if (profile.role?.toLowerCase() === 'owner') {
        appointmentTypeID = await getRandomAppointmentTypeFromRecent(accessToken, calendarId!)
      }

      if (!appointmentTypeID) {
        appointmentTypeID = await getAppointmentTypeWithShortestDuration(accessToken)
      }

      if (!appointmentTypeID) {
        throw new Error('No appointment types found')
      }

      // Rest of the week only: past days have no open slots in Acuity, so counting
      // their bookings would push the rate towards 100% as the week goes on
      const nowMs = Date.now()
      const days = datesBetween(businessNow().date, end)
        .map(day => ({ day, window: remainingWorkWindow(day, nowMs) }))
        .filter((d): d is { day: string; window: { start: number; end: number } } => d.window !== null)

      const results = await Promise.all(
        days.map(async ({ day, window }) => {
          const [booked, open] = await Promise.all([
            fetchDayBookedMinutes(accessToken, calendarId!, day, window),
            fetchDayAvailability(accessToken, calendarId!, appointmentTypeID!, day, window),
          ])

          const finalOpenIntervals = subtractIntervals(open.merged, booked.intervals)

          const finalOpenMinutes = finalOpenIntervals.reduce(
            (sum, i) => sum + (i.end - i.start) / 60000,
            0
          )

          return {
            bookedMinutes: booked.totalMinutes,
            openMinutes: finalOpenMinutes,
          }
        })
      )

      const totalBooked = results.reduce((sum, r) => sum + r.bookedMinutes, 0)
      const totalOpen = results.reduce((sum, r) => sum + r.openMinutes, 0)

      const payload: BookingRatePayload = {
        totalBooked,
        totalOpen,
        weekStart: start,
        weekEnd: end,
      }

      bookingRateCache.set(cacheKey, {
        payload,
        cachedAtMs: Date.now(),
      })

      return payload
    })()

    bookingRateInFlight.set(cacheKey, computePromise)

    try {
      const payload = await computePromise
      return NextResponse.json(payload)
    } catch (computeError) {
      if (cached) {
        return NextResponse.json(cached.payload)
      }

      if (
        computeError instanceof Error &&
        computeError.message === 'No appointment types found'
      ) {
        return NextResponse.json({ error: 'No appointment types found' }, { status: 400 })
      }

      throw computeError
    } finally {
      bookingRateInFlight.delete(cacheKey)
    }

  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Failed to calculate booking capacity' },
      { status: 500 }
    )
  }
}
