import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { pullAvailability } from '@/lib/booking/availability/orchestrator'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_PRIMARY_SERVICE,
  isDefaultServiceName,
  normalizeServiceName,
} from '@/lib/booking/serviceNormalization'
import type { AvailabilitySlotRecord } from '@/lib/booking/availability/types'

const OPEN_BOOKINGS_CACHE_TTL_MS = 5 * 60 * 1000
const OPEN_BOOKINGS_DAY_END_MINUTES = 20 * 60

type OpenBookingsPayload = {
  totalOpenings: number
  weekStart: string
  weekEnd: string
  weekOffset: number
  selectedService: string
}

type OpenBookingsCacheEntry = {
  payload: OpenBookingsPayload
  cachedAtMs: number
}

type ServiceUsage = {
  normalizedName: string
  count: number
  minPrice: number
}

type IntervalCandidate = {
  startMinutes: number
  endMinutes: number
}

const openBookingsCache = new Map<string, OpenBookingsCacheEntry>()
const openBookingsInFlight = new Map<string, Promise<OpenBookingsPayload>>()

type OpenBookingsWeekRange = {
  startDate: string
  endDate: string
}

function cleanupOpenBookingsCache(nowMs: number) {
  for (const [key, entry] of openBookingsCache.entries()) {
    if (nowMs - entry.cachedAtMs > OPEN_BOOKINGS_CACHE_TTL_MS * 6) {
      openBookingsCache.delete(key)
    }
  }
}

function getCacheKey(userId: string, weekOffset: number): string {
  return [userId, String(weekOffset)].join('|')
}

function parseStartMinutes(value?: string | null): number | null {
  if (!value) return null
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return hours * 60 + minutes
}

function collectServiceUsage(
  slots: AvailabilitySlotRecord[],
  predicate: (slot: AvailabilitySlotRecord) => boolean
): ServiceUsage[] {
  const usageMap = new Map<string, ServiceUsage>()

  for (const slot of slots) {
    if (!predicate(slot)) continue

    const normalizedName = normalizeServiceName(slot.appointment_type_name)
    const price = Number.isFinite(slot.price) ? Number(slot.price) : Number.POSITIVE_INFINITY
    const current = usageMap.get(normalizedName)

    if (current) {
      current.count += 1
      current.minPrice = Math.min(current.minPrice, price)
      continue
    }

    usageMap.set(normalizedName, {
      normalizedName,
      count: 1,
      minPrice: price,
    })
  }

  return Array.from(usageMap.values())
}

function pickMostUsedService(usage: ServiceUsage[]): ServiceUsage | null {
  if (usage.length === 0) return null

  return usage.reduce((best, current) => {
    if (current.count > best.count) return current
    if (current.count < best.count) return best
    return current.minPrice < best.minPrice ? current : best
  }, usage[0])
}

function resolveSelectedService(slots: AvailabilitySlotRecord[]): string {
  const defaultUsage = collectServiceUsage(slots, (slot) =>
    isDefaultServiceName(slot.appointment_type_name)
  )

  const fallbackUsage = collectServiceUsage(slots, (slot) =>
    Boolean(slot.appointment_type_name?.trim())
  )

  const usagePool = defaultUsage.length > 0 ? defaultUsage : fallbackUsage
  const selected = pickMostUsedService(usagePool)

  return selected?.normalizedName ?? DEFAULT_PRIMARY_SERVICE
}

function countNonOverlappingOpenings(
  slots: AvailabilitySlotRecord[],
  selectedService: string
): number {
  const perDayMap = new Map<string, Map<number, IntervalCandidate>>()

  for (const slot of slots) {
    if (normalizeServiceName(slot.appointment_type_name) !== selectedService) continue

    const startMinutes = parseStartMinutes(slot.start_time)
    if (startMinutes === null) continue

    const duration = Number.isFinite(slot.duration_minutes)
      ? Number(slot.duration_minutes)
      : 30

    if (duration < 30) continue

    const endMinutes = startMinutes + duration

    // Treat day end as an exclusive boundary so close-time edge slots
    // are not counted as open bookable starts.
    if (endMinutes >= OPEN_BOOKINGS_DAY_END_MINUTES) continue

    const dayIntervals = perDayMap.get(slot.slot_date) ?? new Map<number, IntervalCandidate>()
    const existing = dayIntervals.get(startMinutes)

    if (!existing || endMinutes < existing.endMinutes) {
      dayIntervals.set(startMinutes, { startMinutes, endMinutes })
    }

    perDayMap.set(slot.slot_date, dayIntervals)
  }

  let total = 0

  for (const dayIntervals of perDayMap.values()) {
    const intervals = Array.from(dayIntervals.values()).sort(
      (a, b) => a.endMinutes - b.endMinutes || a.startMinutes - b.startMinutes
    )

    let lastEnd = -1

    for (const interval of intervals) {
      if (interval.startMinutes < lastEnd) continue
      total += 1
      lastEnd = interval.endMinutes
    }
  }

  return total
}

function getTorontoDayOfWeek(): number {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })
  ).getDay()
}

function formatTorontoDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getWeekRange(weekOffset: number): OpenBookingsWeekRange {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })
  )
  const dayOfWeek = now.getDay()
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const start = new Date(now)
  start.setDate(now.getDate() + diff + weekOffset * 7)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return {
    startDate: formatTorontoDate(start),
    endDate: formatTorontoDate(end),
  }
}

async function getLatestCachedSlots(params: {
  supabase: SupabaseClient
  userId: string
  range: OpenBookingsWeekRange
}): Promise<AvailabilitySlotRecord[] | null> {
  const { supabase, userId, range } = params

  const { data, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('user_id', userId)
    .eq('source', 'acuity')
    .gte('slot_date', range.startDate)
    .lte('slot_date', range.endDate)
    .order('slot_date', { ascending: true })
    .order('fetched_at', { ascending: false })

  if (error) {
    console.error('open-bookings cache lookup failed:', error)
    return null
  }

  if (!data || data.length === 0) return null

  const latestByDate = new Map<string, string>()
  const latestSlots: AvailabilitySlotRecord[] = []

  for (const row of data as AvailabilitySlotRecord[]) {
    const fetchedAt = row.fetched_at
    if (!fetchedAt) continue

    const latestForDate = latestByDate.get(row.slot_date)

    if (!latestForDate) {
      latestByDate.set(row.slot_date, fetchedAt)
      latestSlots.push(row)
      continue
    }

    if (fetchedAt === latestForDate) {
      latestSlots.push(row)
    }
  }

  return latestSlots.length > 0 ? latestSlots : null
}

async function computeOpenBookingsForWeek(params: {
  userId: string
  weekOffset: number
  supabase: SupabaseClient
  bypassCache?: boolean
}) {
  const { userId, weekOffset, supabase, bypassCache } = params
  const cacheKey = getCacheKey(userId, weekOffset)
  const nowMs = Date.now()

  cleanupOpenBookingsCache(nowMs)

  if (!bypassCache) {
    const cached = openBookingsCache.get(cacheKey)
    if (cached && nowMs - cached.cachedAtMs <= OPEN_BOOKINGS_CACHE_TTL_MS) {
      return cached.payload
    }

    const inFlight = openBookingsInFlight.get(cacheKey)
    if (inFlight) {
      return inFlight
    }
  }

  const computePromise = (async () => {
    const weekRange = getWeekRange(weekOffset)

    const cachedSlots = await getLatestCachedSlots({
      supabase,
      userId,
      range: weekRange,
    })

    if (cachedSlots && cachedSlots.length > 0) {
      const selectedService = resolveSelectedService(cachedSlots)
      const totalOpenings = countNonOverlappingOpenings(cachedSlots, selectedService)
      const cachedPayload: OpenBookingsPayload = {
        totalOpenings,
        weekStart: weekRange.startDate,
        weekEnd: weekRange.endDate,
        weekOffset,
        selectedService,
      }

      openBookingsCache.set(cacheKey, {
        payload: cachedPayload,
        cachedAtMs: Date.now(),
      })

      return cachedPayload
    }

    const availability = await pullAvailability(supabase, userId, {
      dryRun: true,
      forceRefresh: true,
      weekOffset,
    })

    const acuitySlots = availability.slots.filter((slot) => slot.source === 'acuity')
    const selectedService = resolveSelectedService(acuitySlots)
    const totalOpenings = countNonOverlappingOpenings(acuitySlots, selectedService)

    const payload: OpenBookingsPayload = {
      totalOpenings,
      weekStart: availability.range.startDate,
      weekEnd: availability.range.endDate,
      weekOffset,
      selectedService,
    }

    openBookingsCache.set(cacheKey, {
      payload,
      cachedAtMs: Date.now(),
    })

    return payload
  })()

  openBookingsInFlight.set(cacheKey, computePromise)

  try {
    return await computePromise
  } finally {
    openBookingsInFlight.delete(cacheKey)
  }
}

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const bypassCache = searchParams.get('fresh') === 'true'

    const currentWeek = await computeOpenBookingsForWeek({
      userId: user.id,
      weekOffset: 0,
      supabase,
      bypassCache,
    })

    const torontoDay = getTorontoDayOfWeek()

    if (torontoDay !== 0) {
      return NextResponse.json(currentWeek)
    }

    const nextWeek = await computeOpenBookingsForWeek({
      userId: user.id,
      weekOffset: 1,
      supabase,
      bypassCache,
    })

    if (nextWeek.totalOpenings >= currentWeek.totalOpenings) {
      return NextResponse.json(nextWeek)
    }

    return NextResponse.json(currentWeek)
  } catch (error) {
    console.error('open-bookings error:', error)
    return NextResponse.json(
      { error: 'Failed to load open bookings' },
      { status: 500 }
    )
  }
}
