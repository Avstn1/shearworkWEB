import { SupabaseClient } from '@supabase/supabase-js'
import { BookingAdapter } from './BookingAdapter'
import { NormalizedAppointment, DateRange } from '../types'
import { extractSourceFromForms } from '@/lib/marketingFunnels'
import {
  fetchAppointmentRange,
  fetchJsonWithRetry,
  type AcuityRawAppointment,
  type FetchPage,
} from './acuityRangeFetch'

/**
 * Results per Acuity /appointments request. 100 is Acuity's documented default and is
 * known to be honored. Raise via ACUITY_PAGE_LIMIT only after confirming Acuity returns
 * that many (scripts/compare-acuity-fetch.ts --probe-max): a silently lower cap would
 * make full pages look complete.
 */
const ACUITY_PAGE_LIMIT = Math.max(10, Number(process.env.ACUITY_PAGE_LIMIT) || 100)

export class AcuityAdapter implements BookingAdapter {
  readonly name = 'acuity'

  private readonly baseUrl = 'https://acuityscheduling.com'
  private readonly tokenEndpoint = `${this.baseUrl}/oauth2/token`
  private readonly apiBase = `${this.baseUrl}/api/v1`

  // ======================== TOKEN MANAGEMENT ========================

  async ensureValidToken(supabase: SupabaseClient, userId: string): Promise<string> {
    const { data: tokenRow, error } = await supabase
      .from('acuity_tokens')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !tokenRow) {
      throw new Error('No Acuity connection found')
    }

    const nowSec = Math.floor(Date.now() / 1000)

    // Refresh a minute early so the token can't expire part-way through a sync
    if (!tokenRow.expires_at || tokenRow.expires_at - 60 >= nowSec) {
      return tokenRow.access_token
    }

    return this.refreshToken(supabase, userId, tokenRow)
  }

  private async refreshToken(
    supabase: SupabaseClient,
    userId: string,
    tokenRow: any
  ): Promise<string> {
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

    const nowSec = Math.floor(Date.now() / 1000)

    await supabase
      .from('acuity_tokens')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokenRow.refresh_token,
        expires_at: nowSec + newTokens.expires_in,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    return newTokens.access_token
  }

  // ======================== CALENDAR ========================

  async getCalendarId(
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

    const calendars: any[] = await response.json()

    const match = calendars.find(
      (c) => c.name?.trim?.().toLowerCase?.() === targetCalendar
    )

    if (!match) {
      throw new Error(`No matching calendar found for: ${targetCalendar}`)
    }

    return match.id
  }

  // ======================== FETCH APPOINTMENTS ========================

  /**
   * Fetches all appointments in the range with adaptive chunking (see acuityRangeFetch.ts):
   * week-sized requests, split only when Acuity returns a full page, several in flight
   * at once, with retries. Throws if any range ultimately fails, so a sync is never
   * marked complete with missing days.
   */
  async fetchAppointments(
    accessToken: string,
    calendarId: string,
    dateRange: DateRange
  ): Promise<NormalizedAppointment[]> {
    // Appointments are only synced up to today; future ones are skipped below too
    const todayISO = new Date().toISOString().slice(0, 10)
    const endISO = dateRange.endISO < todayISO ? dateRange.endISO : todayISO

    const fetchPage: FetchPage = (startISO, rangeEndISO, direction) => {
      const url = new URL(`${this.apiBase}/appointments`)
      url.searchParams.set('showall', 'true')
      url.searchParams.set('minDate', startISO)
      url.searchParams.set('maxDate', rangeEndISO)
      url.searchParams.set('max', String(ACUITY_PAGE_LIMIT))
      url.searchParams.set('direction', direction)
      url.searchParams.set('calendarID', String(calendarId))
      return fetchJsonWithRetry<AcuityRawAppointment[]>(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(data => (Array.isArray(data) ? data : []))
    }

    const result = await fetchAppointmentRange(fetchPage, dateRange.startISO, endISO, {
      pageLimit: ACUITY_PAGE_LIMIT,
    })

    if (result.saturatedDays.length > 0) {
      console.warn(
        `[acuity] ${result.saturatedDays.length} day(s) exceeded ${ACUITY_PAGE_LIMIT * 2} appointments and may be incomplete:`,
        result.saturatedDays.join(', ')
      )
    }

    const now = Date.now()
    const appointments: NormalizedAppointment[] = []
    for (const raw of result.appointments) {
      const normalized = this.normalize(raw)
      if (!normalized) continue
      // Skip future appointments
      const datetime = typeof raw.datetime === 'string' ? raw.datetime : ''
      const startsAt = Date.parse(datetime.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
      if (!Number.isNaN(startsAt) && startsAt > now) continue
      appointments.push(normalized)
    }

    return appointments
  }

  // ======================== NORMALIZATION ========================

  private normalize(raw: any): NormalizedAppointment | null {
    // console.log('Raw appointment: ' + JSON.stringify(raw))

    const datetime = raw.datetime || ''
    const date = datetime.split('T')[0]

    const datetimeCreated = raw.datetimeCreated || ''

    const email = raw.email?.toLowerCase?.().trim() || null
    const phone = raw.phone || null
    const phoneNormalized = this.normalizePhone(phone)
    const firstName = raw.firstName?.trim() || null
    const lastName = raw.lastName?.trim() || null

    if (!email && !phoneNormalized && !(firstName && lastName)) {
      return null
    }

    return {
      externalId: String(raw.id),
      datetime,
      date,
      email,
      phone,
      phoneNormalized,
      firstName,
      lastName,
      serviceType: raw.type || null,
      price: parseFloat(raw.priceSold || '0'),
      tip: parseFloat(raw.tip || '0'),
      datetimeCreated: raw.datetimeCreated || null,
      notes: raw.notes || null,
      referralSource: extractSourceFromForms(raw.forms),
      forms: raw.forms,
      canceled: raw.canceled || raw.noShow,
    }
  }

  private normalizePhone(phone: string | null): string | null {
    if (!phone) return null

    const cleaned = phone.replace(/[^0-9]/g, '')

    if (/^1[0-9]{10}$/.test(cleaned)) return '+' + cleaned
    if (/^[0-9]{10}$/.test(cleaned)) return '+1' + cleaned

    if (cleaned.length === 11 && cleaned[0] !== '1') {
      const withoutFirst = cleaned.substring(1)
      if (/^[0-9]{10}$/.test(withoutFirst)) return '+1' + withoutFirst
    }

    return null
  }
}