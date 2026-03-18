import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/utils/api-auth'
import {
  DEFAULT_PRIMARY_SERVICE,
  isDefaultServiceName,
  normalizeServiceName,
} from '@/lib/booking/serviceNormalization'
import type { AvailabilitySlotRecord } from '@/lib/booking/availability/types'

const OPEN_BOOKINGS_DAY_END_MINUTES = 20 * 60
const OPEN_BOOKINGS_SLOT_STALE_MS = 15 * 60 * 1000

type OpenBookingsPayload = {
  totalOpenings: number
  weekStart: string
  weekEnd: string
  weekOffset: number
  selectedService: string
  fetchedAt: string | null
  stale: boolean
  hasSnapshot: boolean
  dataSource: 'slots' | 'summary' | 'none'
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

type OpenBookingsWeekRange = {
  startDate: string
  endDate: string
}

type TorontoNowContext = {
  currentDate: string
  currentMinutes: number
}

type CachedSnapshotResult = {
  slots: AvailabilitySlotRecord[]
  fetchedAt: string | null
  hasSnapshot: boolean
  stale: boolean
}

type SummaryFallbackResult = {
  totalOpenings: number
  fetchedAt: string | null
  stale: boolean
  hasSummary: boolean
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

function formatTorontoDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getTorontoNow(): TorontoNowContext {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })
  )

  return {
    currentDate: formatTorontoDate(now),
    currentMinutes: now.getHours() * 60 + now.getMinutes(),
  }
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

function isFetchedAtStale(fetchedAt: string): boolean {
  const fetchedMs = new Date(fetchedAt).getTime()
  if (Number.isNaN(fetchedMs)) return true
  return Date.now() - fetchedMs > OPEN_BOOKINGS_SLOT_STALE_MS
}

async function getSelectedCalendarId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('acuity_tokens')
    .select('calendar_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to read selected Acuity calendar_id:', error)
    return null
  }

  if (data?.calendar_id === null || data?.calendar_id === undefined) {
    return null
  }

  return String(data.calendar_id)
}

async function getLatestCachedSnapshot(params: {
  supabase: SupabaseClient
  userId: string
  range: OpenBookingsWeekRange
}): Promise<CachedSnapshotResult> {
  const { supabase, userId, range } = params
  const calendarId = await getSelectedCalendarId(supabase, userId)

  let latestSnapshotQuery = supabase
    .from('availability_slots')
    .select('fetched_at, calendar_id')
    .eq('user_id', userId)
    .eq('source', 'acuity')
    .gte('slot_date', range.startDate)
    .lte('slot_date', range.endDate)
    .order('fetched_at', { ascending: false })
    .limit(1)

  if (calendarId) {
    latestSnapshotQuery = latestSnapshotQuery.eq('calendar_id', calendarId)
  }

  const { data: latestRows, error: latestError } = await latestSnapshotQuery

  if (latestError) {
    console.error('open-bookings snapshot lookup failed:', latestError)
    return {
      slots: [],
      fetchedAt: null,
      hasSnapshot: false,
      stale: true,
    }
  }

  const latestSnapshot = latestRows?.[0]
  if (!latestSnapshot?.fetched_at) {
    return {
      slots: [],
      fetchedAt: null,
      hasSnapshot: false,
      stale: true,
    }
  }

  const snapshotCalendarId = calendarId ?? String(latestSnapshot.calendar_id ?? '')

  let slotsQuery = supabase
    .from('availability_slots')
    .select('*')
    .eq('user_id', userId)
    .eq('source', 'acuity')
    .eq('fetched_at', latestSnapshot.fetched_at)
    .gte('slot_date', range.startDate)
    .lte('slot_date', range.endDate)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (snapshotCalendarId) {
    slotsQuery = slotsQuery.eq('calendar_id', snapshotCalendarId)
  }

  const { data: slots, error: slotsError } = await slotsQuery

  if (slotsError) {
    console.error('open-bookings slot snapshot read failed:', slotsError)
    return {
      slots: [],
      fetchedAt: latestSnapshot.fetched_at,
      hasSnapshot: false,
      stale: true,
    }
  }

  return {
    slots: (slots ?? []) as AvailabilitySlotRecord[],
    fetchedAt: latestSnapshot.fetched_at,
    hasSnapshot: true,
    stale: isFetchedAtStale(latestSnapshot.fetched_at),
  }
}

async function getSummaryFallback(params: {
  supabase: SupabaseClient
  userId: string
  range: OpenBookingsWeekRange
}): Promise<SummaryFallbackResult> {
  const { supabase, userId, range } = params

  const { data, error } = await supabase
    .from('availability_daily_summary')
    .select('slot_count, slot_count_update, fetched_at, updated_at')
    .eq('user_id', userId)
    .eq('source', 'acuity')
    .gte('slot_date', range.startDate)
    .lte('slot_date', range.endDate)

  if (error) {
    console.error('open-bookings summary fallback failed:', error)
    return {
      totalOpenings: 0,
      fetchedAt: null,
      stale: true,
      hasSummary: false,
    }
  }

  if (!data || data.length === 0) {
    return {
      totalOpenings: 0,
      fetchedAt: null,
      stale: true,
      hasSummary: false,
    }
  }

  let freshestTimestamp: string | null = null
  const totalOpenings = data.reduce((sum, row) => {
    const referenceTimestamp = row.updated_at ?? row.fetched_at ?? null
    if (referenceTimestamp && (!freshestTimestamp || referenceTimestamp > freshestTimestamp)) {
      freshestTimestamp = referenceTimestamp
    }

    return sum + Number(row.slot_count_update ?? row.slot_count ?? 0)
  }, 0)

  return {
    totalOpenings,
    fetchedAt: freshestTimestamp,
    stale: freshestTimestamp ? isFetchedAtStale(freshestTimestamp) : true,
    hasSummary: true,
  }
}

function filterRemainingWeekSlots(params: {
  slots: AvailabilitySlotRecord[]
  range: OpenBookingsWeekRange
  now: TorontoNowContext
}): AvailabilitySlotRecord[] {
  const { slots, range, now } = params

  return slots.filter((slot) => {
    if (slot.slot_date < range.startDate || slot.slot_date > range.endDate) {
      return false
    }

    if (slot.slot_date < now.currentDate) {
      return false
    }

    const startMinutes = parseStartMinutes(slot.start_time)
    if (startMinutes === null) {
      return false
    }

    const duration = Number.isFinite(slot.duration_minutes)
      ? Number(slot.duration_minutes)
      : 30

    if (duration < 30) {
      return false
    }

    const endMinutes = startMinutes + duration

    if (endMinutes >= OPEN_BOOKINGS_DAY_END_MINUTES) {
      return false
    }

    if (slot.slot_date === now.currentDate && startMinutes <= now.currentMinutes) {
      return false
    }

    return true
  })
}

function buildOpenBookingsPayload(params: {
  snapshot: CachedSnapshotResult
  summaryFallback: SummaryFallbackResult
  range: OpenBookingsWeekRange
  weekOffset: number
  now: TorontoNowContext
}): OpenBookingsPayload {
  if (!params.snapshot.hasSnapshot) {
    return {
      totalOpenings: params.summaryFallback.totalOpenings,
      weekStart: params.range.startDate,
      weekEnd: params.range.endDate,
      weekOffset: params.weekOffset,
      selectedService: DEFAULT_PRIMARY_SERVICE,
      fetchedAt: params.summaryFallback.fetchedAt,
      stale: params.summaryFallback.stale,
      hasSnapshot: false,
      dataSource: params.summaryFallback.hasSummary ? 'summary' : 'none',
    }
  }

  const selectedService = params.snapshot.hasSnapshot
    ? resolveSelectedService(params.snapshot.slots)
    : DEFAULT_PRIMARY_SERVICE

  const remainingSlots = filterRemainingWeekSlots({
    slots: params.snapshot.slots,
    range: params.range,
    now: params.now,
  })

  return {
    totalOpenings: params.snapshot.hasSnapshot
      ? countNonOverlappingOpenings(remainingSlots, selectedService)
      : 0,
    weekStart: params.range.startDate,
    weekEnd: params.range.endDate,
    weekOffset: params.weekOffset,
    selectedService,
    fetchedAt: params.snapshot.fetchedAt,
    stale: params.snapshot.stale,
    hasSnapshot: params.snapshot.hasSnapshot,
    dataSource: 'slots',
  }
}

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const weekOffset = 0
    const weekRange = getWeekRange(weekOffset)
    const snapshot = await getLatestCachedSnapshot({
      supabase,
      userId: user.id,
      range: weekRange,
    })
    const summaryFallback = await getSummaryFallback({
      supabase,
      userId: user.id,
      range: weekRange,
    })

    const payload = buildOpenBookingsPayload({
      snapshot,
      summaryFallback,
      range: weekRange,
      weekOffset,
      now: getTorontoNow(),
    })

    return NextResponse.json(payload)
  } catch (error) {
    console.error('open-bookings error:', error)
    return NextResponse.json(
      { error: 'Failed to load open bookings' },
      { status: 500 }
    )
  }
}
