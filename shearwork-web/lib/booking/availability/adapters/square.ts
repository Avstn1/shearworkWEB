import { SupabaseClient } from '@supabase/supabase-js'
import type { AvailabilityAdapter } from '@/lib/booking/availability/adapters/AvailabilityAdapter'
import type {
  AvailabilityAppointmentType,
  AvailabilityDateRange,
  AvailabilitySlotRecord,
} from '@/lib/booking/availability/types'
import { SquareAdapter } from '@/lib/booking/adapters/square'

type SquareLocationInfo = {
  id: string
  timezone: string | null
  status: string | null
}

type SquareServiceVariation = {
  id: string
  name: string | null
  durationMinutes: number | null
  price: number | null
}

type SquareAvailability = {
  start_at?: string
}

const DEFAULT_SQUARE_VERSION = '2025-10-16'
const MAX_SQUARE_RANGE_DAYS = 27
const MAX_SERVICE_VARIATIONS = 40
const MAX_CATALOG_PAGES = 3
const AVAILABILITY_DELAY_MS = 120

function squareBaseUrl() {
  return process.env.SQUARE_ENV === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

function getSquareVersion() {
  return process.env.SQUARE_VERSION || DEFAULT_SQUARE_VERSION
}

export class SquareAvailabilityAdapter implements AvailabilityAdapter {
  readonly name = 'square'

  async fetchAvailabilitySlots(
    supabase: SupabaseClient,
    userId: string,
    dateRange: AvailabilityDateRange
  ): Promise<AvailabilitySlotRecord[]> {
    // Reuse the existing Square adapter for auth + location selection.
    const squareAdapter = new SquareAdapter()
    const accessToken = await squareAdapter.ensureValidToken(supabase, userId)
    const calendarId = await squareAdapter.getCalendarId(accessToken, supabase, userId)
    const locations = await squareAdapter.fetchLocations(accessToken)

    const selectedIds = parseLocationIds(calendarId)
    const activeLocations = filterLocations(locations as SquareLocationInfo[], selectedIds)

    if (activeLocations.length === 0) return []

    // Collect service variations (appointment types) from Square Catalog.
    const serviceVariations = await fetchServiceVariations(accessToken)
    const limitedVariations = serviceVariations.slice(0, MAX_SERVICE_VARIATIONS)

    if (limitedVariations.length === 0) return []

    const slots: AvailabilitySlotRecord[] = []
    // Square availability uses a date range filter; chunk to stay within limits.
    const dateChunks = buildDateChunks(dateRange.startDate, dateRange.endDate, MAX_SQUARE_RANGE_DAYS)
    const seen = new Set<string>()

    // Square availability searches can be heavy, so we cap variations and space calls slightly.
    for (const location of activeLocations) {
      for (const variation of limitedVariations) {
        for (const chunk of dateChunks) {
          const availabilities = await fetchAvailabilityForVariation(
            accessToken,
            location.id,
            variation.id,
            chunk.start,
            chunk.end
          )

          for (const availability of availabilities) {
            const slot = buildSlotRecord(userId, location, variation, availability)
            if (!slot) continue

            const key = `${slot.calendar_id}|${slot.appointment_type_id}|${slot.slot_date}|${slot.start_time}`
            if (seen.has(key)) continue
            seen.add(key)
            slots.push(slot)
          }

          await delay(AVAILABILITY_DELAY_MS)
        }
      }
    }

    return slots
  }

  async fetchAppointmentTypesForUser(
    supabase: SupabaseClient,
    userId: string
  ): Promise<AvailabilityAppointmentType[]> {
    const squareAdapter = new SquareAdapter()
    const accessToken = await squareAdapter.ensureValidToken(supabase, userId)
    const serviceVariations = await fetchServiceVariations(accessToken)

    return serviceVariations.map((variation) => ({
      id: variation.id,
      name: variation.name || null,
      durationMinutes: variation.durationMinutes,
      price: variation.price,
    }))
  }
}

async function fetchServiceVariations(accessToken: string): Promise<SquareServiceVariation[]> {
  const variations: SquareServiceVariation[] = []
  let cursor: string | null = null
  let pageCount = 0

  // The catalog list can be large; we limit pages to keep availability pulls bounded.
  while (pageCount < MAX_CATALOG_PAGES) {
    const url = new URL(`${squareBaseUrl()}/v2/catalog/list`)
    url.searchParams.set('types', 'ITEM')
    if (cursor) url.searchParams.set('cursor', cursor)

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Square-Version': getSquareVersion(),
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Square catalog list failed:', data)
      return variations
    }

    const objects = Array.isArray(data.objects) ? data.objects : []

    for (const item of objects) {
      const itemData = item?.item_data
      const itemName = typeof itemData?.name === 'string' ? itemData.name : null
      const itemVariations = Array.isArray(itemData?.variations) ? itemData.variations : []

      for (const variation of itemVariations) {
        const variationData = variation?.item_variation_data
        // Square Bookings exposes appointment services as item variations with service_duration.
        if (!variation?.id || !variationData?.service_duration) continue

        const durationMinutes = parseServiceDuration(variationData.service_duration)
        const price = toPrice(variationData.price_money?.amount)

        variations.push({
          id: variation.id,
          name: variationData.name || itemName,
          durationMinutes,
          price,
        })
      }
    }

    cursor = data.cursor ?? null
    pageCount += 1

    if (!cursor) break
  }

  return variations
}

async function fetchAvailabilityForVariation(
  accessToken: string,
  locationId: string,
  serviceVariationId: string,
  startAt: Date,
  endAt: Date
): Promise<SquareAvailability[]> {
  const url = `${squareBaseUrl()}/v2/bookings/availability/search`

  // We query availability per service variation to keep service-level matching intact.
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': getSquareVersion(),
    },
    body: JSON.stringify({
      query: {
        filter: {
          location_id: locationId,
          start_at_range: {
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
          },
          segment_filters: [
            { service_variation_id: serviceVariationId },
          ],
        },
      },
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Square availability search failed:', data)
    return []
  }

  return Array.isArray(data.availabilities) ? data.availabilities : []
}

function buildSlotRecord(
  userId: string,
  location: SquareLocationInfo,
  variation: SquareServiceVariation,
  availability: SquareAvailability
): AvailabilitySlotRecord | null {
  if (!availability.start_at) return null

  const dateParts = availability.start_at.split('T')
  const slotDate = dateParts[0]
  const startTime = extractTimeFromDateTime(availability.start_at)

  // Use the start_at string directly so we don't shift dates across timezones.

  if (!slotDate || !startTime) return null

  const price = variation.price ?? 0

  return {
    user_id: userId,
    source: 'square',
    calendar_id: location.id,
    appointment_type_id: variation.id,
    appointment_type_name: variation.name,
    slot_date: slotDate,
    start_time: startTime,
    start_at: availability.start_at,
    duration_minutes: variation.durationMinutes,
    price,
    estimated_revenue: roundCurrency(price),
    timezone: location.timezone,
  }
}

function parseLocationIds(calendarId: string): string[] | null {
  if (!calendarId || calendarId === 'all') return null
  return calendarId
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function filterLocations(
  locations: SquareLocationInfo[],
  selectedIds: string[] | null
): SquareLocationInfo[] {
  const active = locations.filter((location) => location.status === 'ACTIVE')
  if (!selectedIds || selectedIds.length === 0) return active
  return active.filter((location) => selectedIds.includes(location.id))
}

function buildDateChunks(
  startISO: string,
  endISO: string,
  maxDays: number
): Array<{ start: Date; end: Date }> {
  const chunks: Array<{ start: Date; end: Date }> = []
  const startDate = new Date(`${startISO}T00:00:00Z`)
  const endDate = new Date(`${endISO}T23:59:59Z`)

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return chunks
  }

  let current = new Date(startDate)

  while (current <= endDate) {
    const chunkEnd = new Date(current)
    chunkEnd.setDate(chunkEnd.getDate() + maxDays)

    if (chunkEnd > endDate) {
      chunkEnd.setTime(endDate.getTime())
    }

    chunks.push({ start: new Date(current), end: new Date(chunkEnd) })

    current = new Date(chunkEnd)
    current.setDate(current.getDate() + 1)
  }

  return chunks
}

function parseServiceDuration(durationMs: number): number | null {
  // Square sends service_duration in milliseconds.
  if (!Number.isFinite(durationMs)) return null
  if (durationMs <= 0) return null
  return Math.round(durationMs / 60000)
}

function toPrice(amount?: number | null): number | null {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return null
  return amount / 100
}

function extractTimeFromDateTime(datetime: string): string | null {
  const match = datetime.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : null
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function delay(ms: number): Promise<void> {
  // Small pacing delay to reduce API burst risk.
  return new Promise((resolve) => setTimeout(resolve, ms))
}
