import { SupabaseClient } from '@supabase/supabase-js'
import { BookingAdapter } from './BookingAdapter'
import { NormalizedAppointment, DateRange } from '../types'
import {
  normalizeSquareBooking,
  normalizeSquarePayment,
  normalizeSquareOrder,
  SquareBookingPayload,
  SquareLocationInfo,
  SquareLocationPayload,
  SquareOrderPayload,
  SquareOrderRecord,
  SquarePaymentPayload,
  SquarePaymentRecord,
} from '@/lib/square/normalize'

const DEFAULT_SQUARE_VERSION = '2025-10-16'
const MAX_SQUARE_RANGE_DAYS = 27

function squareBaseUrl() {
  return process.env.SQUARE_ENV === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

function getSquareVersion() {
  return process.env.SQUARE_VERSION || DEFAULT_SQUARE_VERSION
}

function getSquareClientSecret() {
  return process.env.SQUARE_APPLICATION_SECRET || process.env.SQUARE_CLIENT_SECRET || ''
}

export class SquareAdapter implements BookingAdapter {
  readonly name = 'square'

  async ensureValidToken(supabase: SupabaseClient, userId: string): Promise<string> {
    const { data: tokenRow, error } = await supabase
      .from('square_tokens')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !tokenRow?.access_token) {
      throw new Error('No Square connection found')
    }

    if (!tokenRow.expires_in) {
      return tokenRow.access_token
    }

    const expiresAt = new Date(tokenRow.expires_in).getTime()
    if (Number.isNaN(expiresAt) || expiresAt > Date.now()) {
      return tokenRow.access_token
    }

    const clientSecret = getSquareClientSecret()
    if (!clientSecret) {
      throw new Error('Square client secret not configured')
    }

    const response = await fetch(`${squareBaseUrl()}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': getSquareVersion(),
      },
      body: JSON.stringify({
        client_id: process.env.SQUARE_APPLICATION_ID,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: tokenRow.refresh_token,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`Square token refresh failed: ${JSON.stringify(data)}`)
    }

    const expiresAtIso = data.expires_at
      ? new Date(data.expires_at).toISOString()
      : data.expires_in
        ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
        : null

    await supabase
      .from('square_tokens')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? tokenRow.refresh_token,
        expires_in: expiresAtIso,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    return data.access_token
  }

  async getCalendarId(
    accessToken: string,
    supabase: SupabaseClient,
    userId: string
  ): Promise<string> {
    const { data: selections, error } = await supabase
      .from('square_locations')
      .select('location_id')
      .eq('user_id', userId)
      .eq('selected', true)
      .eq('is_active', true)

    if (error) {
      console.error('Failed to load square_locations:', error)
    }

    const selected = selections?.map((row) => row.location_id) || []

    if (selected.length === 0) return 'all'

    return selected.join(',')
  }

  async fetchLocations(accessToken: string): Promise<SquareLocationInfo[]> {
    const response = await fetch(`${squareBaseUrl()}/v2/locations`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Square-Version': getSquareVersion(),
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`Square locations fetch failed: ${JSON.stringify(data)}`)
    }

    return Array.isArray(data.locations)
      ? data.locations.map((location: SquareLocationPayload) => ({
          id: location.id || '',
          name: location.name,
          timezone: location.timezone || null,
          status: location.status || null,
        }))
      : []
  }

  async fetchAppointments(
    accessToken: string,
    calendarId: string,
    dateRange: DateRange
  ): Promise<NormalizedAppointment[]> {
    const locations = await this.fetchLocations(accessToken)
    return this.fetchAppointmentsForLocations(accessToken, calendarId, dateRange, locations)
  }

  async fetchAppointmentsForLocations(
    accessToken: string,
    calendarId: string,
    dateRange: DateRange,
    locations: SquareLocationInfo[]
  ): Promise<NormalizedAppointment[]> {
    const selectedIds = parseLocationIds(calendarId)
    const activeLocations = filterLocations(locations, selectedIds)

    if (activeLocations.length === 0) return []

    const seen = new Set<string>()
    const appointments: NormalizedAppointment[] = []
    const today = new Date().toISOString().split('T')[0]

    for (const location of activeLocations) {
      const bookings = await fetchSquareBookingsForLocation(
        accessToken,
        location.id,
        dateRange
      )

      for (const booking of bookings) {
        const normalized = normalizeSquareBooking(booking, location.timezone || null)
        if (!normalized) continue

        if (normalized.date < dateRange.startISO || normalized.date > dateRange.endISO) {
          continue
        }

        if (normalized.date > today) {
          continue
        }

        if (!seen.has(normalized.externalId)) {
          seen.add(normalized.externalId)
          appointments.push(normalized)
        }
      }
    }

    return appointments
  }

  async fetchPayments(
    accessToken: string,
    calendarId: string,
    dateRange: DateRange,
    locations: SquareLocationInfo[]
  ): Promise<SquarePaymentRecord[]> {
    const selectedIds = parseLocationIds(calendarId)
    const activeLocations = filterLocations(locations, selectedIds)
    const timezones = buildTimezoneMap(activeLocations)

    const locationIds = activeLocations.length > 0
      ? activeLocations.map((location) => location.id)
      : selectedIds || []

    const targets = locationIds.length > 0 ? locationIds : [null]

    const payments: SquarePaymentRecord[] = []

    for (const locationId of targets) {
      const records = await fetchSquarePaymentsForLocation(
        accessToken,
        locationId,
        dateRange
      )

      for (const payment of records) {
        if (payment.status !== 'COMPLETED') continue

        const timezone = locationId ? timezones[locationId] ?? null : null
        const normalized = normalizeSquarePayment(payment, timezone)
        if (!normalized) continue

        if (!normalized.appointmentDate) continue

        if (
          normalized.appointmentDate < dateRange.startISO ||
          normalized.appointmentDate > dateRange.endISO
        ) {
          continue
        }

        payments.push(normalized)
      }
    }

    return payments
  }

  async fetchOrders(
    accessToken: string,
    calendarId: string,
    dateRange: DateRange,
    locations: SquareLocationInfo[]
  ): Promise<SquareOrderRecord[]> {
    const selectedIds = parseLocationIds(calendarId)
    const activeLocations = filterLocations(locations, selectedIds)
    const timezones = buildTimezoneMap(activeLocations)

    const locationIds = activeLocations.length > 0
      ? activeLocations.map((location) => location.id)
      : selectedIds || []

    const orders = await fetchSquareOrders(accessToken, locationIds, dateRange)
    const seen = new Set<string>()
    const normalizedOrders: SquareOrderRecord[] = []

    for (const order of orders) {
      const locationId = order.location_id || null
      const timezone = locationId ? timezones[locationId] ?? null : null
      const normalized = normalizeSquareOrder(order, timezone)
      if (!normalized) continue

      if (!normalized.appointmentDate) continue
      if (
        normalized.appointmentDate < dateRange.startISO ||
        normalized.appointmentDate > dateRange.endISO
      ) {
        continue
      }

      if (seen.has(normalized.orderId)) continue
      seen.add(normalized.orderId)
      normalizedOrders.push(normalized)
    }

    return normalizedOrders
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

function buildTimezoneMap(locations: SquareLocationInfo[]): Record<string, string | null> {
  return locations.reduce<Record<string, string | null>>((map, location) => {
    map[location.id] = location.timezone || null
    return map
  }, {})
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

async function fetchSquareBookingsForLocation(
  accessToken: string,
  locationId: string,
  dateRange: DateRange
): Promise<SquareBookingPayload[]> {
  const bookings: SquareBookingPayload[] = []

  const chunks = buildDateChunks(
    dateRange.startISO,
    dateRange.endISO,
    MAX_SQUARE_RANGE_DAYS
  )

  for (const chunk of chunks) {
    let cursor: string | null = null
    const start = new Date(chunk.start)
    const end = new Date(chunk.end)

    start.setDate(start.getDate() - 1)
    end.setDate(end.getDate() + 1)

    do {
      const url = new URL(`${squareBaseUrl()}/v2/bookings`)
      url.searchParams.set('start_at_min', start.toISOString())
      url.searchParams.set('start_at_max', end.toISOString())
      url.searchParams.set('location_id', locationId)
      url.searchParams.set('limit', '100')
      if (cursor) url.searchParams.set('cursor', cursor)

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Square-Version': getSquareVersion(),
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Square bookings fetch failed: ${JSON.stringify(data)}`)
      }

      if (Array.isArray(data.bookings)) {
        bookings.push(...data.bookings)
      }

      cursor = data.cursor || null

      if (cursor) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } while (cursor)
  }

  return bookings
}

async function fetchSquarePaymentsForLocation(
  accessToken: string,
  locationId: string | null,
  dateRange: DateRange
): Promise<SquarePaymentPayload[]> {
  const payments: SquarePaymentPayload[] = []
  const chunks = buildDateChunks(
    dateRange.startISO,
    dateRange.endISO,
    MAX_SQUARE_RANGE_DAYS
  )

  for (const chunk of chunks) {
    let cursor: string | null = null

    const start = new Date(chunk.start)
    const end = new Date(chunk.end)
    start.setDate(start.getDate() - 1)
    end.setDate(end.getDate() + 1)

    do {
      const url = new URL(`${squareBaseUrl()}/v2/payments`)
      url.searchParams.set('begin_time', start.toISOString())
      url.searchParams.set('end_time', end.toISOString())
      url.searchParams.set('limit', '100')
      url.searchParams.set('status', 'COMPLETED')
      if (locationId) url.searchParams.set('location_id', locationId)
      if (cursor) url.searchParams.set('cursor', cursor)

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Square-Version': getSquareVersion(),
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Square payments fetch failed: ${JSON.stringify(data)}`)
      }

      if (Array.isArray(data.payments)) {
        payments.push(...data.payments)
      }

      cursor = data.cursor || null

      if (cursor) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } while (cursor)
  }

  return payments
}

async function fetchSquareOrders(
  accessToken: string,
  locationIds: string[],
  dateRange: DateRange
): Promise<SquareOrderPayload[]> {
  const orders: SquareOrderPayload[] = []
  const chunks = buildDateChunks(
    dateRange.startISO,
    dateRange.endISO,
    MAX_SQUARE_RANGE_DAYS
  )

  for (const chunk of chunks) {
    let cursor: string | null = null

    const start = new Date(chunk.start)
    const end = new Date(chunk.end)
    start.setDate(start.getDate() - 1)
    end.setDate(end.getDate() + 1)

    do {
      const body: Record<string, unknown> = {
        limit: 100,
        return_entries: false,
        query: {
          filter: {
            date_time_filter: {
              created_at: {
                start_at: start.toISOString(),
                end_at: end.toISOString(),
              },
            },
          },
        },
      }

      if (locationIds.length > 0) {
        body.location_ids = locationIds
      }

      if (cursor) {
        body.cursor = cursor
      }

      const response = await fetch(`${squareBaseUrl()}/v2/orders/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Square-Version': getSquareVersion(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Square orders fetch failed: ${JSON.stringify(data)}`)
      }

      if (Array.isArray(data.orders)) {
        orders.push(...data.orders)
      }

      cursor = data.cursor || null

      if (cursor) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } while (cursor)
  }

  return orders
}
