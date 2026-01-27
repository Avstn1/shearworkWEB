import type { SupabaseClient } from '@supabase/supabase-js'
import { AcuityAvailabilityAdapter } from '@/lib/booking/availability/adapters/acuity'
import { isDefaultServiceName } from '@/lib/booking/serviceNormalization'
import type {
  AvailabilityDailySummaryRecord,
  AvailabilityDateRange,
  AvailabilityPullOptions,
  AvailabilityPullResult,
  AvailabilitySlotRecord,
} from '@/lib/booking/availability/types'

const CACHE_TTL_MS = 5 * 60 * 1000

type AvailabilityCache = {
  fetchedAt: string
  slots: AvailabilitySlotRecord[]
}

export async function pullAvailability(
  supabase: SupabaseClient,
  userId: string,
  options: AvailabilityPullOptions = {}
): Promise<AvailabilityPullResult> {
  const dateRange = buildCurrentWeekRange()
  const fetchedAt = new Date().toISOString()
  const errors: string[] = []
  const sources: AvailabilityPullResult['sources'] = {}

  let cacheHit = false
  let outputSlots: AvailabilitySlotRecord[] = []
  let outputSummaries: AvailabilityDailySummaryRecord[] = []
  let effectiveFetchedAt = fetchedAt

  const { data: acuityToken } = await supabase
    .from('acuity_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .maybeSingle()

  if (acuityToken?.access_token) {
    const adapter = new AcuityAvailabilityAdapter()

    try {
      const cached = options.forceRefresh
        ? null
        : await getCachedAvailability(supabase, userId, adapter.name, dateRange)

      if (cached) {
        cacheHit = true
        effectiveFetchedAt = cached.fetchedAt
        outputSlots = dedupeSlotsByTime(cached.slots)
        outputSummaries = buildDailySummaries(outputSlots, cached.fetchedAt)
      } else {
        const slots = await adapter.fetchAvailabilitySlots(supabase, userId, dateRange)
        const rawSlots = applyFetchedAtToSlots(slots, fetchedAt)
        const dedupedSlots = dedupeSlotsByTime(rawSlots)
        const summaries = buildDailySummaries(dedupedSlots, fetchedAt)

        outputSlots = dedupedSlots
        outputSummaries = summaries

        if (!options.dryRun) {
          await upsertSlots(supabase, rawSlots)
          await upsertSummaries(supabase, summaries)
          await cleanupAvailabilityCache(
            supabase,
            userId,
            adapter.name,
            dateRange,
            fetchedAt
          )
        }
      }

      const sourceRevenue = sumEstimatedRevenue(outputSummaries)

      sources[adapter.name] = {
        slotCount: outputSlots.length,
        dayCount: outputSummaries.length,
        estimatedRevenue: roundCurrency(sourceRevenue),
      }
    } catch (err) {
      const message = formatErrorMessage(err)
      errors.push(`Acuity: ${message}`)
      sources.acuity = {
        slotCount: 0,
        dayCount: 0,
        estimatedRevenue: 0,
        errors: [message],
      }
    }
  }

  if (Object.keys(sources).length === 0) {
    errors.push('No booking sources connected')
  }

  return {
    success: errors.length === 0,
    fetchedAt: effectiveFetchedAt,
    cacheHit,
    range: dateRange,
    totalSlots: outputSlots.length,
    totalEstimatedRevenue: roundCurrency(sumEstimatedRevenue(outputSummaries)),
    slots: outputSlots,
    summaries: outputSummaries,
    sources,
    errors: errors.length > 0 ? errors : undefined,
  }
}

function buildCurrentWeekRange(): AvailabilityDateRange {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek

  const monday = new Date(today)
  monday.setDate(today.getDate() - (isoDay - 1))
  monday.setHours(0, 0, 0, 0)

  const dates: string[] = []

  for (let i = 0; i < 7; i += 1) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    dates.push(formatDate(date))
  }

  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    dates,
  }
}

function buildDailySummaries(
  slots: AvailabilitySlotRecord[],
  fetchedAt: string
): AvailabilityDailySummaryRecord[] {
  const summaryMap = new Map<string, AvailabilityDailySummaryRecord>()

  for (const slot of slots) {
    const key = `${slot.user_id}|${slot.source}|${slot.slot_date}`
    const revenue = roundCurrency(slot.estimated_revenue ?? 0)

    const current = summaryMap.get(key)
    if (current) {
      current.slot_count += 1
      current.estimated_revenue = roundCurrency(current.estimated_revenue + revenue)
      continue
    }

    summaryMap.set(key, {
      user_id: slot.user_id,
      source: slot.source,
      slot_date: slot.slot_date,
      slot_count: 1,
      estimated_revenue: revenue,
      timezone: slot.timezone ?? null,
      fetched_at: fetchedAt,
      updated_at: fetchedAt,
    })
  }

  return Array.from(summaryMap.values())
}

function dedupeSlotsByTime(slots: AvailabilitySlotRecord[]): AvailabilitySlotRecord[] {
  const deduped = new Map<string, AvailabilitySlotRecord>()

  for (const slot of slots) {
    const key = [
      slot.user_id,
      slot.source,
      slot.calendar_id,
      slot.slot_date,
      slot.start_time,
    ].join('|')

    const current = deduped.get(key)
    if (!current) {
      deduped.set(key, slot)
      continue
    }

    deduped.set(key, pickPreferredSlot(current, slot))
  }

  return Array.from(deduped.values())
}

function pickPreferredSlot(
  current: AvailabilitySlotRecord,
  candidate: AvailabilitySlotRecord
): AvailabilitySlotRecord {
  const currentDefault = isDefaultService(current)
  const candidateDefault = isDefaultService(candidate)

  if (currentDefault && !candidateDefault) return current
  if (candidateDefault && !currentDefault) return candidate

  const currentPrice = normalizePrice(current.price)
  const candidatePrice = normalizePrice(candidate.price)

  if (currentPrice === null && candidatePrice === null) return current
  if (currentPrice === null) return candidate
  if (candidatePrice === null) return current

  return candidatePrice < currentPrice ? candidate : current
}

function isDefaultService(slot: AvailabilitySlotRecord): boolean {
  return isDefaultServiceName(slot.appointment_type_name)
}

function normalizePrice(value?: number | null): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null
  return value
}

function applyFetchedAtToSlots(
  slots: AvailabilitySlotRecord[],
  fetchedAt: string
): AvailabilitySlotRecord[] {
  return slots.map((slot) => ({
    ...slot,
    fetched_at: fetchedAt,
    updated_at: fetchedAt,
  }))
}

async function getCachedAvailability(
  supabase: SupabaseClient,
  userId: string,
  source: string,
  dateRange: AvailabilityDateRange
): Promise<AvailabilityCache | null> {
  const { data: latestRows, error: latestError } = await supabase
    .from('availability_daily_summary')
    .select('fetched_at')
    .eq('user_id', userId)
    .eq('source', source)
    .gte('slot_date', dateRange.startDate)
    .lte('slot_date', dateRange.endDate)
    .order('fetched_at', { ascending: false })
    .limit(1)

  if (latestError) {
    console.error('Availability cache lookup failed:', latestError)
    return null
  }

  const fetchedAt = latestRows?.[0]?.fetched_at
  if (!fetchedAt || isCacheStale(fetchedAt)) return null

  const { data: slots, error: slotsError } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('user_id', userId)
    .eq('source', source)
    .eq('fetched_at', fetchedAt)
    .gte('slot_date', dateRange.startDate)
    .lte('slot_date', dateRange.endDate)

  if (slotsError) {
    console.error('Availability slot cache failed:', slotsError)
    return null
  }

  return {
    fetchedAt,
    slots: slots ?? [],
  }
}

async function upsertSlots(
  supabase: SupabaseClient,
  slots: AvailabilitySlotRecord[]
) {
  if (slots.length === 0) return

  const { error } = await supabase
    .from('availability_slots')
    .upsert(slots, {
      onConflict: 'user_id,source,appointment_type_id,calendar_id,slot_date,start_time',
    })

  if (error) {
    throw new Error(`Failed to upsert availability slots: ${error.message}`)
  }
}

async function upsertSummaries(
  supabase: SupabaseClient,
  summaries: AvailabilityDailySummaryRecord[]
) {
  if (summaries.length === 0) return

  const { error } = await supabase
    .from('availability_daily_summary')
    .upsert(summaries, {
      onConflict: 'user_id,source,slot_date',
    })

  if (error) {
    throw new Error(`Failed to upsert availability daily summary: ${error.message}`)
  }
}

async function cleanupAvailabilityCache(
  supabase: SupabaseClient,
  userId: string,
  source: string,
  range: AvailabilityDateRange,
  fetchedAt: string
) {
  const cleanupSlotsBefore = await supabase
    .from('availability_slots')
    .delete()
    .eq('user_id', userId)
    .eq('source', source)
    .lt('slot_date', range.startDate)

  if (cleanupSlotsBefore.error) {
    console.error('Failed to cleanup old availability slots:', cleanupSlotsBefore.error)
  }

  const cleanupSlotsAfter = await supabase
    .from('availability_slots')
    .delete()
    .eq('user_id', userId)
    .eq('source', source)
    .gt('slot_date', range.endDate)

  if (cleanupSlotsAfter.error) {
    console.error('Failed to cleanup future availability slots:', cleanupSlotsAfter.error)
  }

  const cleanupSlotsStale = await supabase
    .from('availability_slots')
    .delete()
    .eq('user_id', userId)
    .eq('source', source)
    .gte('slot_date', range.startDate)
    .lte('slot_date', range.endDate)
    .lt('fetched_at', fetchedAt)

  if (cleanupSlotsStale.error) {
    console.error('Failed to cleanup stale availability slots:', cleanupSlotsStale.error)
  }

  const cleanupSummariesBefore = await supabase
    .from('availability_daily_summary')
    .delete()
    .eq('user_id', userId)
    .eq('source', source)
    .lt('slot_date', range.startDate)

  if (cleanupSummariesBefore.error) {
    console.error('Failed to cleanup old availability summaries:', cleanupSummariesBefore.error)
  }

  const cleanupSummariesAfter = await supabase
    .from('availability_daily_summary')
    .delete()
    .eq('user_id', userId)
    .eq('source', source)
    .gt('slot_date', range.endDate)

  if (cleanupSummariesAfter.error) {
    console.error('Failed to cleanup future availability summaries:', cleanupSummariesAfter.error)
  }

  const cleanupSummariesStale = await supabase
    .from('availability_daily_summary')
    .delete()
    .eq('user_id', userId)
    .eq('source', source)
    .gte('slot_date', range.startDate)
    .lte('slot_date', range.endDate)
    .lt('fetched_at', fetchedAt)

  if (cleanupSummariesStale.error) {
    console.error('Failed to cleanup stale availability summaries:', cleanupSummariesStale.error)
  }
}

function sumEstimatedRevenue(summaries: AvailabilityDailySummaryRecord[]): number {
  return summaries.reduce((total, row) => total + row.estimated_revenue, 0)
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function isCacheStale(fetchedAt: string): boolean {
  const fetchedMs = new Date(fetchedAt).getTime()
  if (Number.isNaN(fetchedMs)) return true
  return Date.now() - fetchedMs > CACHE_TTL_MS
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}
