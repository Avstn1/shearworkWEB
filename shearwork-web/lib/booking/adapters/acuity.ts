import { SupabaseClient } from '@supabase/supabase-js'
import { BookingAdapter } from './BookingAdapter'
import { NormalizedAppointment, DateRange } from '../types'
import { extractSourceFromForms } from '@/lib/marketingFunnels'

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

    if (!tokenRow.expires_at || tokenRow.expires_at >= nowSec) {
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

async fetchAppointments(
  accessToken: string,
  calendarId: string,
  dateRange: DateRange
): Promise<NormalizedAppointment[]> {
  const seen = new Set<string>()
  const appointments: NormalizedAppointment[] = []
  const today = new Date()

  const start = new Date(dateRange.startISO)
  const end = new Date(dateRange.endISO)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d > today) break

    const dayStr = d.toISOString().split('T')[0]
    const dayAppointments = await this.fetchDay(accessToken, calendarId, dayStr)
    
    // Dedupe: only add appointments we haven't seen yet
    for (const appt of dayAppointments) {
      // console.log(JSON.stringify(appt))
      if (!seen.has(appt.externalId)) {
        seen.add(appt.externalId)
        appointments.push(appt)
      }
    }
  }

  return appointments
}

  private async fetchDay(
    accessToken: string,
    calendarId: string,
    dayStr: string
  ): Promise<NormalizedAppointment[]> {
    const pageSize = 100
    let offset = 0
    const results: NormalizedAppointment[] = []

    while (true) {
      const url = new URL(`${this.apiBase}/appointments?showall=true`)
      url.searchParams.set('minDate', dayStr)
      url.searchParams.set('maxDate', dayStr)
      url.searchParams.set('max', String(pageSize))
      url.searchParams.set('offset', String(offset))
      url.searchParams.set('calendarID', String(calendarId))

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        console.error(`Acuity fetch failed for ${dayStr}: ${response.status}`)
        break
      }

      const data = await response.json()

      if (!Array.isArray(data) || data.length === 0) break

      for (const raw of data) {
        const normalized = this.normalize(raw)
        if (!normalized) continue
        
        // Skip future appointments
        const parseWithOffset = (dt: string) =>
          new Date(dt.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
        
        if (parseWithOffset(raw.datetime) > new Date()) {
          continue
        }
        
        results.push(normalized)
      }

      if (data.length < pageSize) break
      offset += pageSize
    }

    return results
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