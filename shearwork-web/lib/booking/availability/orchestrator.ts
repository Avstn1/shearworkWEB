import type { SupabaseClient } from '@supabase/supabase-js'
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns'
import { AcuityAvailabilityAdapter } from '@/lib/booking/availability/adapters/acuity'
import { SquareAvailabilityAdapter } from '@/lib/booking/availability/adapters/square'
import type { AvailabilityAdapter } from '@/lib/booking/availability/adapters/AvailabilityAdapter'
import {
  DEFAULT_PRIMARY_SERVICE,
  isDefaultServiceName,
  normalizeServiceName,
} from '@/lib/booking/serviceNormalization'
import type {
  AvailabilityAppointmentType,
  AvailabilityDailySummaryRecord,
  AvailabilityDateRange,
  AvailabilityCapacityBucket,
  AvailabilityHourlyBucket,
  AvailabilityPullOptions,
  AvailabilityPullResult,
  AvailabilitySlotRecord,
} from '@/lib/booking/availability/types'

const CACHE_TTL_MS = 5 * 60 * 1000

type AvailabilityCache = {
  fetchedAt: string
  slots: AvailabilitySlotRecord[]
}

type SourceAvailabilityResult = {
  slots: AvailabilitySlotRecord[]
  summaries: AvailabilityDailySummaryRecord[]
  fetchedAt: string
  cacheHit: boolean
}

type AvailabilityAppointmentTypeFetcher = AvailabilityAdapter & {
  fetchAppointmentTypesForUser: (
    supabase: SupabaseClient,
    userId: string
  ) => Promise<AvailabilityAppointmentType[]>
}

export async function pullAvailability(
  supabase: SupabaseClient,
  userId: string,
  options: AvailabilityPullOptions = {}
): Promise<AvailabilityPullResult> {
  const dateRange = buildCurrentWeekRange(options.weekOffset ?? 0)
  const fetchedAt = new Date().toISOString()
  const errors: string[] = []
  const sources: AvailabilityPullResult['sources'] = {}

  const { data: acuityToken } = await supabase
    .from('acuity_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .maybeSingle()

  const { data: squareToken } = await supabase
    .from('square_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .maybeSingle()

  // Build the adapter list up front so each source can be handled consistently.
  const sourceConfigs: Array<{ adapter: AvailabilityAdapter; enabled: boolean }> = [
    { adapter: new AcuityAvailabilityAdapter(), enabled: Boolean(acuityToken?.access_token) },
    { adapter: new SquareAvailabilityAdapter(), enabled: Boolean(squareToken?.access_token) },
  ]

  const slotLengthMinutes = await resolveSlotLengthMinutesForUser({
    supabase,
    userId,
    sourceConfigs,
  })

  const outputSlots: AvailabilitySlotRecord[] = []
  const outputSummaries: AvailabilityDailySummaryRecord[] = []
  const cacheHitFlags: boolean[] = []

  let effectiveFetchedAt = fetchedAt

  // Process each enabled source independently so a failure doesn't block others.
  for (const { adapter, enabled } of sourceConfigs) {
    if (!enabled) continue

    try {
      // Pull per-source availability with cache handling and slot deduping.
      const result = await pullAvailabilityForSource({
        supabase,
        userId,
        adapter,
        dateRange,
        fetchedAt,
        options,
        slotLengthMinutes,
      })

      outputSlots.push(...result.slots)
      outputSummaries.push(...result.summaries)
      cacheHitFlags.push(result.cacheHit)
      effectiveFetchedAt = pickMostRecentFetchedAt(effectiveFetchedAt, result.fetchedAt)

      const sourceRevenue = sumEstimatedRevenue(result.summaries)

      sources[adapter.name] = {
        slotCount: result.slots.length,
        dayCount: result.summaries.length,
        estimatedRevenue: roundCurrency(sourceRevenue),
        fetchedAt: result.fetchedAt,
      }
    } catch (err) {
      const message = formatErrorMessage(err)
      errors.push(`${formatSourceName(adapter.name)}: ${message}`)
      sources[adapter.name] = {
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

  // Aggregate deduped slots into hour buckets for reporting/analysis.
  const hourlyBuckets = buildHourlyBuckets(outputSlots)
  // Build 30-minute capacity buckets for Acuity (source-specific, mutually exclusive).
  const capacityBuckets = buildCapacityBuckets(outputSlots)
  const cacheHit = cacheHitFlags.length > 0 && cacheHitFlags.every(Boolean)

  return {
    success: errors.length === 0,
    fetchedAt: effectiveFetchedAt,
    cacheHit,
    range: dateRange,
    totalSlots: outputSlots.length,
    totalEstimatedRevenue: roundCurrency(sumEstimatedRevenue(outputSummaries)),
    slots: outputSlots,
    summaries: outputSummaries,
    hourlyBuckets,
    capacityBuckets,
    sources,
    errors: errors.length > 0 ? errors : undefined,
  }
}

function buildCurrentWeekRange(weekOffset: number = 0): AvailabilityDateRange {
  // Use Toronto timezone for current date, then date-fns for ISO week (Mon-Sun).
  const torontoNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })
  )

  // Apply week offset (e.g., 1 = next week, -1 = last week)
  if (weekOffset !== 0) {
    torontoNow.setDate(torontoNow.getDate() + weekOffset * 7)
  }

  // weekStartsOn: 1 = Monday (ISO week standard)
  const monday = startOfWeek(torontoNow, { weekStartsOn: 1 })
  const sunday = endOfWeek(torontoNow, { weekStartsOn: 1 })

  const dates = eachDayOfInterval({ start: monday, end: sunday })
    .map(d => format(d, 'yyyy-MM-dd'))

  return {
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    dates,
  }
}

function buildDailySummaries(
  slots: AvailabilitySlotRecord[],
  fetchedAt: string,
  slotLengthMinutes: number
): AvailabilityDailySummaryRecord[] {
  const fallbackPrice = resolveHaircutFallbackPrice(slots)

  // Count only slots that can fit the slot length threshold.
  // Ignore services under the threshold (e.g., 15-minute lineups).
  // Use interval scheduling to maximize non-overlapping slots per day.
  const dayMap = new Map<string, DayIntervalState>()

  for (const slot of slots) {
    const durationMinutes = slot.duration_minutes ?? 30
    if (!isHaircutServiceName(slot.appointment_type_name)) continue
    if (!Number.isFinite(durationMinutes) || durationMinutes !== slotLengthMinutes) continue

    const startMinutes = parseStartTimeMinutes(slot.start_time)
    if (startMinutes === null) continue

    const endMinutes = startMinutes + slotLengthMinutes
    const price = getSlotPrice(slot) ?? fallbackPrice
    const dayKey = `${slot.user_id}|${slot.source}|${slot.slot_date}`
    const current = dayMap.get(dayKey)
    const timezone = slot.timezone ?? null

    if (!current) {
      const startMap = new Map<number, IntervalCandidate>()
      startMap.set(startMinutes, { startMinutes, endMinutes, price })
      dayMap.set(dayKey, {
        userId: slot.user_id,
        source: slot.source,
        slotDate: slot.slot_date,
        timezone,
        startMap,
      })
      continue
    }

    if (!current.timezone && timezone) {
      current.timezone = timezone
    }

    const existing = current.startMap.get(startMinutes)
    if (!existing || price < existing.price) {
      current.startMap.set(startMinutes, { startMinutes, endMinutes, price })
    }
  }

  const summaryMap = new Map<string, AvailabilityDailySummaryRecord>()

  for (const entry of dayMap.values()) {
    const intervals = Array.from(entry.startMap.values())
      .sort((a, b) => a.endMinutes - b.endMinutes || a.startMinutes - b.startMinutes)

    let count = 0
    let revenue = 0
    let lastEnd = -1

    for (const interval of intervals) {
      if (interval.startMinutes < lastEnd) continue
      count += 1
      revenue += interval.price
      lastEnd = interval.endMinutes
    }

    if (count === 0) continue

    summaryMap.set(`${entry.userId}|${entry.source}|${entry.slotDate}`, {
      user_id: entry.userId,
      source: entry.source,
      slot_date: entry.slotDate,
      slot_count: count,
      slot_units: count,
      estimated_revenue: revenue,
      timezone: entry.timezone,
      fetched_at: fetchedAt,
      updated_at: fetchedAt,
    })
  }

  for (const summary of summaryMap.values()) {
    summary.slot_units = roundUnits(summary.slot_units ?? 0)
    summary.estimated_revenue = roundCurrency(summary.estimated_revenue)
  }

  return Array.from(summaryMap.values())
}

type IntervalCandidate = {
  startMinutes: number
  endMinutes: number
  price: number
}

type DayIntervalState = {
  userId: string
  source: string
  slotDate: string
  timezone: string | null
  startMap: Map<number, IntervalCandidate>
}

type ServiceUsage = {
  name: string
  normalizedName: string
  count: number
  minPrice: number
}

type DefaultServiceContext = {
  normalizedName: string
  price: number
}

function resolveDefaultServiceContext(
  slots: AvailabilitySlotRecord[]
): DefaultServiceContext {
  const haircutUsage = collectServiceUsage(slots, (slot) => {
    if (!slot.appointment_type_name?.trim()) return false
    return isDefaultServiceName(slot.appointment_type_name)
  })

  const fallbackUsage = collectServiceUsage(slots, (slot) =>
    Boolean(slot.appointment_type_name?.trim())
  )

  const usagePool = haircutUsage.length > 0 ? haircutUsage : fallbackUsage
  const selected = pickMostUsedService(usagePool)
  const averagePrice = getAverageServicePrice(pickTopServices(usagePool, 2))

  if (!selected) {
    return {
      normalizedName: DEFAULT_PRIMARY_SERVICE,
      price: 0,
    }
  }

  return {
    normalizedName: selected.normalizedName,
    price: averagePrice,
  }
}

function resolveHaircutFallbackPrice(slots: AvailabilitySlotRecord[]): number {
  const usage = collectServiceUsage(slots, (slot) =>
    isHaircutServiceName(slot.appointment_type_name)
  )
  if (usage.length === 0) return 0
  return getAverageServicePrice(pickTopServices(usage, 2))
}

function hasAppointmentTypeFetcher(
  adapter: AvailabilityAdapter
): adapter is AvailabilityAppointmentTypeFetcher {
  return typeof (adapter as AvailabilityAppointmentTypeFetcher).fetchAppointmentTypesForUser === 'function'
}

async function resolveSlotLengthMinutesForUser(params: {
  supabase: SupabaseClient
  userId: string
  sourceConfigs: Array<{ adapter: AvailabilityAdapter; enabled: boolean }>
}): Promise<number> {
  const { supabase, userId, sourceConfigs } = params

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('slot_length_minutes')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch slot length from profile:', error)
  }

  const stored = profile?.slot_length_minutes
  if (stored && stored > 0) return stored

  const appointmentTypes = await fetchAppointmentTypesFromSources(
    supabase,
    userId,
    sourceConfigs
  )

  if (appointmentTypes.length === 0) return 30

  const derived = deriveSlotLengthFromAppointmentTypes(appointmentTypes)
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      slot_length_minutes: derived,
      slot_length_derived_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (updateError) {
    console.error('Failed to persist slot length:', updateError)
  }

  return derived
}

async function fetchAppointmentTypesFromSources(
  supabase: SupabaseClient,
  userId: string,
  sourceConfigs: Array<{ adapter: AvailabilityAdapter; enabled: boolean }>
): Promise<AvailabilityAppointmentType[]> {
  const preferredOrder = ['acuity', 'square']

  for (const sourceName of preferredOrder) {
    const match = sourceConfigs.find(
      ({ adapter, enabled }) => enabled && adapter.name === sourceName && hasAppointmentTypeFetcher(adapter)
    )

    if (!match || !hasAppointmentTypeFetcher(match.adapter)) continue

    try {
      const types = await match.adapter.fetchAppointmentTypesForUser(supabase, userId)
      if (types.length > 0) return types
    } catch (err) {
      console.error(`Failed to fetch ${sourceName} appointment types:`, err)
    }
  }

  for (const { adapter, enabled } of sourceConfigs) {
    if (!enabled || !hasAppointmentTypeFetcher(adapter)) continue

    try {
      const types = await adapter.fetchAppointmentTypesForUser(supabase, userId)
      if (types.length > 0) return types
    } catch (err) {
      console.error(`Failed to fetch ${adapter.name} appointment types:`, err)
    }
  }

  return []
}

function deriveSlotLengthFromAppointmentTypes(
  appointmentTypes: AvailabilityAppointmentType[]
): number {
  const durations = appointmentTypes
    .filter((type) => isHaircutServiceName(type.name))
    .map((type) => type.durationMinutes)
    .filter((duration): duration is number =>
      typeof duration === 'number' && Number.isFinite(duration) && duration >= 30
    )

  if (durations.length === 0) return 30

  const minDuration = Math.min(...durations)
  return normalizeSlotLengthMinutes(minDuration)
}

function collectServiceUsage(
  slots: AvailabilitySlotRecord[],
  predicate: (slot: AvailabilitySlotRecord) => boolean
): ServiceUsage[] {
  const usageMap = new Map<string, ServiceUsage>()

  for (const slot of slots) {
    if (!predicate(slot)) continue

    const rawName = slot.appointment_type_name?.trim()
    if (!rawName) continue

    const key = rawName.toLowerCase()
    const normalizedName = normalizeServiceName(rawName)
    const price = getSlotPrice(slot)

    const current = usageMap.get(key)
    if (current) {
      current.count += 1
      if (price !== null) {
        current.minPrice = Math.min(current.minPrice, price)
      }
      continue
    }

    usageMap.set(key, {
      name: rawName,
      normalizedName,
      count: 1,
      minPrice: price ?? Number.POSITIVE_INFINITY,
    })
  }

  return Array.from(usageMap.values())
}


function pickMostUsedService(usage: ServiceUsage[]): ServiceUsage | null {
  if (usage.length === 0) return null

  return usage.reduce((best, current) => {
    if (!best) return current
    if (current.count > best.count) return current
    if (current.count < best.count) return best

    const currentPrice = current.minPrice
    const bestPrice = best.minPrice

    if (currentPrice < bestPrice) return current
    if (currentPrice > bestPrice) return best

    return best
  }, usage[0])
}

function pickTopServices(usage: ServiceUsage[], limit: number): ServiceUsage[] {
  if (limit <= 0 || usage.length === 0) return []

  const sorted = [...usage].sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count

    const priceA = a.minPrice
    const priceB = b.minPrice

    if (priceA < priceB) return -1
    if (priceA > priceB) return 1

    return 0
  })

  return sorted.slice(0, limit)
}


function getAverageServicePrice(services: ServiceUsage[]): number {
  const prices = services
    .map((service) => service.minPrice)
    .filter((price) => Number.isFinite(price)) as number[]

  if (prices.length === 0) return 0

  const total = prices.reduce((sum, price) => sum + price, 0)
  return total / prices.length
}

function getNormalizedServiceName(value?: string | null): string | null {
  if (!value || !value.trim()) return null
  return normalizeServiceName(value)
}

function isHaircutServiceName(value?: string | null): boolean {
  if (!value) return false
  const name = value.trim().toLowerCase()
  if (!name) return false
  if (name.includes('kid')) return false
  return name.includes('haircut') || name.includes('scissor')
}

function parseStartTimeMinutes(value?: string | null): number | null {
  if (!value) return null
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return hours * 60 + minutes
}

function normalizeSlotLengthMinutes(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 30
  const normalized = Math.floor(value / 15) * 15
  return normalized < 30 ? 30 : normalized
}

function getSlotPrice(slot: AvailabilitySlotRecord): number | null {
  const direct = normalizePrice(slot.price)
  if (direct !== null) return direct
  return normalizePrice(slot.estimated_revenue)
}

function buildHourlyBuckets(slots: AvailabilitySlotRecord[]): AvailabilityHourlyBucket[] {
  const bucketMap = new Map<string, AvailabilityHourlyBucket>()

  for (const slot of slots) {
    const hour = extractSlotHour(slot)
    if (!hour) continue

    const key = `${slot.user_id}|${slot.source}|${slot.slot_date}|${hour}`
    const current = bucketMap.get(key)

    if (current) {
      current.slot_count += 1
      continue
    }

    bucketMap.set(key, {
      user_id: slot.user_id,
      source: slot.source,
      slot_date: slot.slot_date,
      hour,
      slot_count: 1,
      timezone: slot.timezone ?? null,
    })
  }

  return Array.from(bucketMap.values())
}

function buildCapacityBuckets(slots: AvailabilitySlotRecord[]): AvailabilityCapacityBucket[] {
  const bucketMap = new Map<string, { bucket: AvailabilityCapacityBucket; calendars: Set<string> }>()

  for (const slot of slots) {
    if (slot.source !== 'acuity') continue

    const effectiveDuration = slot.duration_minutes ?? 30
    if (effectiveDuration < 30) continue

    const block = getHalfHourBlock(slot)
    if (!block) continue

    const key = `${slot.user_id}|${slot.source}|${slot.slot_date}|${block}`
    const calendarId = slot.calendar_id || 'unknown'

    const current = bucketMap.get(key)
    if (current) {
      current.calendars.add(calendarId)
      current.bucket.capacity = current.calendars.size
      continue
    }

    bucketMap.set(key, {
      bucket: {
        user_id: slot.user_id,
        source: slot.source,
        slot_date: slot.slot_date,
        block,
        capacity: 1,
        timezone: slot.timezone ?? null,
      },
      calendars: new Set([calendarId]),
    })
  }

  return Array.from(bucketMap.values()).map((entry) => entry.bucket)
}

function extractSlotHour(slot: AvailabilitySlotRecord): string | null {
  const timeValue = slot.start_time || ''
  const timeMatch = timeValue.match(/^(\d{1,2})/)

  if (timeMatch) {
    const hour = Number(timeMatch[1])
    if (!Number.isNaN(hour) && hour >= 0 && hour <= 23) {
      return `${String(hour).padStart(2, '0')}:00`
    }
  }

  if (slot.start_at) {
    const date = new Date(slot.start_at)
    if (!Number.isNaN(date.getTime())) {
      return `${String(date.getHours()).padStart(2, '0')}:00`
    }
  }

  return null
}

function getHalfHourBlock(slot: AvailabilitySlotRecord): string | null {
  const timeValue = slot.start_time || ''
  const timeMatch = timeValue.match(/^(\d{1,2}):(\d{2})/)

  if (timeMatch) {
    const hour = Number(timeMatch[1])
    const minutes = Number(timeMatch[2])

    if (!Number.isNaN(hour) && !Number.isNaN(minutes)) {
      const blockMinutes = minutes >= 30 ? 30 : 0
      return `${String(hour).padStart(2, '0')}:${blockMinutes === 0 ? '00' : '30'}`
    }
  }

  // Fallback to start_at only if start_time is missing/unparseable.
  if (slot.start_at) {
    const date = new Date(slot.start_at)
    if (!Number.isNaN(date.getTime())) {
      const hour = date.getHours()
      const minutes = date.getMinutes() >= 30 ? 30 : 0
      return `${String(hour).padStart(2, '0')}:${minutes === 0 ? '00' : '30'}`
    }
  }

  return null
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

async function pullAvailabilityForSource(params: {
  supabase: SupabaseClient
  userId: string
  adapter: AvailabilityAdapter
  dateRange: AvailabilityDateRange
  fetchedAt: string
  options: AvailabilityPullOptions
  slotLengthMinutes: number
}): Promise<SourceAvailabilityResult> {
  const { supabase, userId, adapter, dateRange, fetchedAt, options, slotLengthMinutes } = params
  // Reuse cached slots when possible to avoid hammering external APIs.
  const cached = options.forceRefresh
    ? null
    : await getCachedAvailability(supabase, userId, adapter.name, dateRange)

  if (cached) {
    const dedupedSlots = dedupeSlotsByTime(cached.slots)
    const summaries = buildDailySummaries(cached.slots, cached.fetchedAt, slotLengthMinutes)

    return {
      slots: dedupedSlots,
      summaries,
      fetchedAt: cached.fetchedAt,
      cacheHit: true,
    }
  }

  // Fetch fresh slots directly from the provider.
  const slots = await adapter.fetchAvailabilitySlots(supabase, userId, dateRange)
  const rawSlots = applyFetchedAtToSlots(slots, fetchedAt)
  const dedupedSlots = dedupeSlotsByTime(rawSlots)
  const summaries = buildDailySummaries(rawSlots, fetchedAt, slotLengthMinutes)

  if (!options.dryRun) {
    // Store raw slots for service-specific filtering, but return deduped slots for summaries/UI.
    await upsertSlots(supabase, rawSlots)
    await upsertSummaries(supabase, summaries, options)
    
    // Only cleanup cache when doing a full refresh, not in updateMode
    if (!options.updateMode) {
      await cleanupAvailabilityCache(supabase, userId, adapter.name, dateRange, fetchedAt)
    }
  }

  return {
    slots: dedupedSlots,
    summaries,
    fetchedAt,
    cacheHit: false,
  }
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
  summaries: AvailabilityDailySummaryRecord[],
  options: AvailabilityPullOptions,
) {
  if (summaries.length === 0) return

  if (options.updateMode) {
    console.log('Update mode - summaries count:', summaries.length)
    console.log('First summary:', summaries[0])
    
    const updates = summaries.map(summary => ({
      user_id: summary.user_id,
      source: summary.source,
      slot_date: summary.slot_date,
      slot_count_update: summary.slot_count,
      slot_units_update: summary.slot_units ?? 0,
      updated_at: new Date().toISOString()
    }))
    
    console.log('Updates to apply:', updates.length)
    console.log('First update:', updates[0])

    const { data, error } = await supabase
      .from('availability_daily_summary')
      .upsert(updates, {
        onConflict: 'user_id,source,slot_date',
      })
      .select()
    
    console.log('Upsert result data:', data)
    console.log('Upsert result error:', error)
  } else {
    const { error } = await supabase
      .from('availability_daily_summary')
      .upsert(summaries, {
        onConflict: 'user_id,source,slot_date',
      })

    if (error) {
      throw new Error(`Failed to upsert availability daily summary: ${error.message}`)
    }
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

function pickMostRecentFetchedAt(current: string, candidate: string): string {
  return candidate > current ? candidate : current
}

function formatSourceName(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : 'Source'
}

function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return formatter.format(date)
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function roundUnits(value: number): number {
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
