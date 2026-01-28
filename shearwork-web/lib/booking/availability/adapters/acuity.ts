import { SupabaseClient } from '@supabase/supabase-js'
import type { AvailabilityAdapter } from '@/lib/booking/availability/adapters/AvailabilityAdapter'
import type {
  AvailabilityDateRange,
  AvailabilitySlotRecord,
} from '@/lib/booking/availability/types'

type AcuityTokenRow = {
  user_id: string
  access_token: string
  refresh_token?: string | null
  token_type?: string | null
  scope?: string | null
  expires_in?: number | null
  created_at?: string | null
  updated_at?: string | null
  expires_at?: string | number | null
}

type AcuityAppointmentType = {
  id: string
  name: string
  durationMinutes: number | null
  price: number | null
}

type TimeEntry = Record<string, unknown> | string

const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000

export class AcuityAvailabilityAdapter implements AvailabilityAdapter {
  readonly name = 'acuity'

  private readonly baseUrl = 'https://acuityscheduling.com'
  private readonly tokenEndpoint = `${this.baseUrl}/oauth2/token`
  private readonly apiBase = `${this.baseUrl}/api/v1`

  async fetchAvailabilitySlots(
    supabase: SupabaseClient,
    userId: string,
    dateRange: AvailabilityDateRange
  ): Promise<AvailabilitySlotRecord[]> {
    const accessToken = await this.ensureValidToken(supabase, userId)
    const calendarId = await this.getCalendarId(accessToken, supabase, userId)
    const appointmentTypes = await this.fetchAppointmentTypes(accessToken)

    if (appointmentTypes.length === 0) return []

    const fetchedAt = new Date().toISOString()
    const monthKeys = getMonthKeys(dateRange.dates)
    const slots: AvailabilitySlotRecord[] = []

    for (const appointmentType of appointmentTypes) {
      let availableDates: string[] = []

      for (const monthKey of monthKeys) {
        const monthDates = await this.fetchAvailabilityDatesForMonth(
          accessToken,
          appointmentType.id,
          calendarId,
          monthKey
        )
        availableDates = availableDates.concat(monthDates)
      }

      const uniqueDates = dedupeStrings(availableDates)
      const filteredDates = uniqueDates.filter((date) => dateRange.dates.includes(date))
      const datesToCheck = filteredDates.length > 0 ? filteredDates : dateRange.dates

      for (const slotDate of datesToCheck) {
        const timeEntries = await this.fetchAvailabilityTimes(
          accessToken,
          appointmentType.id,
          calendarId,
          slotDate
        )

        if (timeEntries.length === 0) continue

        const records = buildSlotRecords({
          userId,
          source: this.name,
          calendarId,
          appointmentType,
          slotDate,
          timeEntries,
          fetchedAt,
        })

        slots.push(...records)
      }
    }

    return slots
  }

  private async ensureValidToken(supabase: SupabaseClient, userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('acuity_tokens')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      throw new Error('No Acuity connection found')
    }

    const tokenRow = data as AcuityTokenRow
    const isExpired = isTokenExpired(tokenRow)

    if (!isExpired) {
      return tokenRow.access_token
    }

    return this.refreshToken(supabase, userId, tokenRow)
  }

  private async refreshToken(
    supabase: SupabaseClient,
    userId: string,
    tokenRow: AcuityTokenRow
  ): Promise<string> {
    if (!tokenRow.refresh_token) {
      throw new Error('No refresh token available for Acuity')
    }

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenRow.refresh_token,
        client_id: process.env.ACUITY_CLIENT_ID!,
        client_secret: process.env.ACUITY_CLIENT_SECRET!,
      }),
    })

    const newTokens = await response.json()

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${JSON.stringify(newTokens)}`)
    }

    const expiresIn = toNumber(newTokens.expires_in)

    await supabase
      .from('acuity_tokens')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokenRow.refresh_token,
        token_type: newTokens.token_type ?? tokenRow.token_type,
        scope: newTokens.scope ?? tokenRow.scope,
        expires_in: expiresIn ?? tokenRow.expires_in ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    return newTokens.access_token
  }

  private async getCalendarId(
    accessToken: string,
    supabase: SupabaseClient,
    userId: string
  ): Promise<string> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('calendar')
      .eq('user_id', userId)
      .single()

    if (error || !profile?.calendar) {
      throw new Error('No calendar configured in profile')
    }

    const targetCalendar = profile.calendar.trim().toLowerCase()

    const response = await fetch(`${this.apiBase}/calendars`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch calendars: ${response.status}`)
    }

    const calendars = (await response.json()) as Array<{ id: string | number; name?: string | null }>

    const match = calendars.find(
      (c) => c.name?.trim?.().toLowerCase?.() === targetCalendar
    )

    if (!match) {
      throw new Error(`No matching calendar found for: ${targetCalendar}`)
    }

    return String(match.id)
  }

  private async fetchAppointmentTypes(accessToken: string): Promise<AcuityAppointmentType[]> {
    const response = await fetch(`${this.apiBase}/appointment-types`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch appointment types: ${response.status}`)
    }

    const data = (await response.json()) as Array<Record<string, unknown>>

    if (!Array.isArray(data)) return []

    return data
      .map((item) => {
        const id = item.id ?? item.appointmentTypeID
        if (!id) return null

        const name = typeof item.name === 'string' ? item.name : String(item.name ?? '')
        const durationMinutes = toNumber(item.duration ?? item.durationMinutes)
        const price = toNumber(item.price ?? item.amount)

        return {
          id: String(id),
          name,
          durationMinutes: durationMinutes ?? null,
          price: price ?? null,
        }
      })
      .filter((item): item is AcuityAppointmentType => Boolean(item))
  }

  private async fetchAvailabilityDatesForMonth(
    accessToken: string,
    appointmentTypeId: string,
    calendarId: string,
    monthKey: string
  ): Promise<string[]> {
    const monthCandidates = [monthKey, `${monthKey}-01`]

    for (const month of monthCandidates) {
      const url = new URL(`${this.apiBase}/availability/dates`)
      url.searchParams.set('appointmentTypeID', appointmentTypeId)
      url.searchParams.set('calendarID', calendarId)
      url.searchParams.set('month', month)

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        console.error(`Acuity availability/dates failed (${month}):`, response.status)
        continue
      }

      const data = await response.json()
      const dates = extractDateStrings(data)
      if (dates.length > 0) return dates
    }

    return []
  }

  private async fetchAvailabilityTimes(
    accessToken: string,
    appointmentTypeId: string,
    calendarId: string,
    slotDate: string
  ): Promise<TimeEntry[]> {
    const url = new URL(`${this.apiBase}/availability/times`)
    url.searchParams.set('appointmentTypeID', appointmentTypeId)
    url.searchParams.set('calendarID', calendarId)
    url.searchParams.set('date', slotDate)

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      console.error(`Acuity availability/times failed (${slotDate}):`, response.status)
      return []
    }

    const data = await response.json()

    if (Array.isArray(data)) return data as TimeEntry[]
    if (data && typeof data === 'object') {
      const entries = (data as { times?: unknown[] }).times
      if (Array.isArray(entries)) return entries as TimeEntry[]
    }

    return []
  }
}

function buildSlotRecords(params: {
  userId: string
  source: string
  calendarId: string
  appointmentType: AcuityAppointmentType
  slotDate: string
  timeEntries: TimeEntry[]
  fetchedAt: string
}): AvailabilitySlotRecord[] {
  const records: AvailabilitySlotRecord[] = []

  for (const entry of params.timeEntries) {
    const { startTime, startAt, timezone } = extractTimeData(entry)
    if (!startTime) continue

    const price = params.appointmentType.price ?? 0
    const estimatedRevenue = roundCurrency(price)

    records.push({
      user_id: params.userId,
      source: params.source,
      calendar_id: params.calendarId,
      appointment_type_id: params.appointmentType.id,
      appointment_type_name: params.appointmentType.name || null,
      slot_date: params.slotDate,
      start_time: startTime,
      start_at: startAt,
      duration_minutes: params.appointmentType.durationMinutes,
      price,
      estimated_revenue: estimatedRevenue,
      timezone,
      fetched_at: params.fetchedAt,
      updated_at: params.fetchedAt,
    })
  }

  return records
}

function extractDateStrings(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const value = (item as { date?: unknown; day?: unknown }).date ?? (item as { day?: unknown }).day
          if (typeof value === 'string') return value
        }
        return null
      })
      .filter((value): value is string => Boolean(value))
  }

  if (data && typeof data === 'object') {
    const dates = (data as { dates?: unknown[] }).dates
    if (Array.isArray(dates)) {
      return dates
        .map((item) => (typeof item === 'string' ? item : null))
        .filter((value): value is string => Boolean(value))
    }
  }

  return []
}

function extractTimeData(entry: TimeEntry): {
  startTime: string | null
  startAt: string | null
  timezone: string | null
} {
  if (typeof entry === 'string') {
    const isoTime = entry.includes('T') ? extractTimeFromDateTime(entry) : null
    const parsedTime = isoTime || parseTimeString(entry)
    const startAt = entry.includes('T') ? toIsoString(entry) : null
    const timezone = entry.includes('T') ? extractTimezoneOffset(entry) : null

    return {
      startTime: parsedTime,
      startAt,
      timezone,
    }
  }

  const datetimeValue = getStringValue(entry, [
    'datetime',
    'dateTime',
    'start_at',
    'startAt',
    'start',
    'start_time',
  ])

  const rawTimeValue = getStringValue(entry, [
    'time',
    'startTime',
    'start_time',
    'label',
  ])

  const timeValue = rawTimeValue && rawTimeValue.includes('T') ? null : rawTimeValue
  const dateTimeCandidate = datetimeValue || (rawTimeValue && rawTimeValue.includes('T') ? rawTimeValue : null)

  const timezone =
    getStringValue(entry, ['timezone', 'timeZone', 'tz']) ||
    (dateTimeCandidate ? extractTimezoneOffset(dateTimeCandidate) : null)

  const timeFromDate = dateTimeCandidate ? extractTimeFromDateTime(dateTimeCandidate) : null
  const parsedTime = timeFromDate || (timeValue ? parseTimeString(timeValue) : null)

  return {
    startTime: parsedTime,
    startAt: dateTimeCandidate ? toIsoString(dateTimeCandidate) : null,
    timezone,
  }
}

function extractTimeFromDateTime(datetime: string): string | null {
  const match = datetime.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : null
}

function extractTimezoneOffset(datetime: string): string | null {
  const match = datetime.match(/([+-]\d{2}):?(\d{2})$/)
  if (!match) return null
  return `${match[1]}:${match[2]}`
}

function toIsoString(value: string): string | null {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function parseTimeString(input: string): string | null {
  const trimmed = input.trim().toLowerCase()
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)?$/)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  const meridiem = match[3]
  if (meridiem === 'pm' && hours < 12) hours += 12
  if (meridiem === 'am' && hours === 12) hours = 0

  if (hours > 23 || minutes > 59) return null

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function getMonthKeys(dates: string[]): string[] {
  const months = new Set<string>()
  for (const date of dates) {
    if (!date || date.length < 7) continue
    months.add(date.slice(0, 7))
  }
  return Array.from(months)
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function getStringValue(
  entry: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = entry[key]
    if (typeof value === 'string') return value
  }
  return null
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function isTokenExpired(tokenRow: AcuityTokenRow): boolean {
  const now = Date.now()

  if (tokenRow.expires_at) {
    const expiresAt = toDateMs(tokenRow.expires_at)
    if (expiresAt) {
      return now + TOKEN_EXPIRY_BUFFER_MS >= expiresAt
    }
  }

  if (tokenRow.expires_in) {
    const base = tokenRow.updated_at || tokenRow.created_at
    const baseMs = base ? new Date(base).getTime() : null
    if (baseMs && !Number.isNaN(baseMs)) {
      const expiresAt = baseMs + tokenRow.expires_in * 1000
      return now + TOKEN_EXPIRY_BUFFER_MS >= expiresAt
    }
  }

  return false
}

function toDateMs(value: string | number): number | null {
  if (typeof value === 'number') return value * 1000
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getTime()
}
