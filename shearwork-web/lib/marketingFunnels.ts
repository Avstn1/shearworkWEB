// lib/marketingFunnels.ts

import crypto from 'crypto'

export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export type TimeframeDef = {
  id: string           // 'year', 'Q1', 'Q2', '2025-03', 'March-2025', etc
  startISO: string     // 'YYYY-MM-DD'
  endISO: string       // 'YYYY-MM-DD'
}

export type FunnelStats = {
  new_clients: number
  returning_clients: number
  new_clients_retained: number
  total_revenue: number
  total_visits: number
  client_names?: { client_name: string; first_visit: string }[]
}

export interface AcuityAppointment {
  datetime: string
  priceSold?: string | number
  email?: string | null
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  forms?: {
    values?: { name?: string | null; value?: string | number | null }[]
  }[]
}

// -------------------- Identity helpers --------------------

/**
 * Normalize phone into the SAME format used by acuity/pull:
 * - If 10 digits: +1XXXXXXXXXX
 * - If 11 digits starting with 1: +1XXXXXXXXXX
 * - If 11 digits not starting with 1 but last 10 look valid: +1(last10)
 * Otherwise: '' (unknown/invalid)
 */
export function normalizePhone(phone?: string | null) {
  if (!phone) return ''
  const cleaned = phone.replace(/[^0-9]/g, '')

  if (/^1[0-9]{10}$/.test(cleaned)) return `+${cleaned}`
  if (/^[0-9]{10}$/.test(cleaned)) return `+1${cleaned}`

  if (cleaned.length === 11 && cleaned[0] !== '1') {
    const withoutFirst = cleaned.substring(1)
    if (/^[0-9]{10}$/.test(withoutFirst)) return `+1${withoutFirst}`
  }

  return ''
}

function normalizeNameKey(firstName?: string | null, lastName?: string | null) {
  return `${firstName || ''} ${lastName || ''}`
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function buildClientKey(client: AcuityAppointment & { id?: string }, userId: string) {
  const email = (client.email || '').toLowerCase().trim()
  const phone = normalizePhone(client.phone || '')
  const name = normalizeNameKey(client.firstName, client.lastName)

  const raw = email || phone || name
  if (raw) return `${userId}_${raw}`

  // fallback for missing identifiers. deterministic internal ID
  const seed = `${userId}|${client.id || ''}|${client.datetime || ''}|${client.firstName || ''}|${client.lastName || ''}`
  return crypto.createHash('sha256').update(seed).digest('hex')
}

// -------------------- Source helpers --------------------

const REFERRAL_KEYWORDS = [
  'referral',
  'referred',
  'hear',
  'heard',
  'source',
  'social',
  'instagram',
  'facebook',
  'tiktok',
  'walking',
  'walk',
]

const REFERRAL_FILTER = ['unknown']

export function canonicalizeSource(raw?: string | null): string | null {
  if (!raw) return null

  const value = raw.trim()
  if (!value) return null

  const lower = value.toLowerCase()

  // Normalize common variants
  if (['tiktok', 'tik tok', 'tik-tok'].includes(lower)) return 'TikTok'
  if (['instagram', 'insta', 'ig'].includes(lower)) return 'Instagram'
  if (['facebook', 'fb'].includes(lower)) return 'Facebook'
  if (['google', 'google search', 'google maps'].includes(lower)) return 'Google'
  if (['walk', 'walking', 'walk-in', 'walk in', 'walk by'].includes(lower)) return 'Walk-in'

  // Default: just return trimmed value
  return value
}

export function extractSourceFromForms(forms: AcuityAppointment['forms']): string | null {
  if (!forms || !Array.isArray(forms)) return null

  for (const form of forms) {
    if (!form?.values || !Array.isArray(form.values)) continue

    for (const field of form.values) {
      const fieldName = field.name?.toLowerCase() || ''
      const fieldValue = (field.value || '').toString().trim()

      // Must match a referral keyword in the field name
      if (!REFERRAL_KEYWORDS.some((k) => fieldName.includes(k))) continue

      // Skip empty or multi-select values (comma-separated)
      if (!fieldValue || fieldValue.includes(',')) continue

      const valueLower = fieldValue.toLowerCase()

      // Return "Returning Client" as the actual source
      // We'll handle the classification logic in the computation phase
      if (valueLower.includes('returning') || valueLower.includes('return')) {
        return 'Returning Client'
      }

      // Filter out "unknown" only
      if (REFERRAL_FILTER.some((k) => valueLower.includes(k))) continue

      const canonical = canonicalizeSource(fieldValue)
      if (!canonical) continue

      return canonical
    }
  }

  return null
}

// -------------------- Timeframe builders --------------------

// Year + quarters. What you already have in yearly route
export function buildYearAndQuarterTimeframes(year: number): TimeframeDef[] {
  return [
    {
      id: 'year',
      startISO: `${year}-01-01`,
      endISO: `${year}-12-31`,
    },
    {
      id: 'Q1',
      startISO: `${year}-01-01`,
      endISO: `${year}-03-31`,
    },
    {
      id: 'Q2',
      startISO: `${year}-04-01`,
      endISO: `${year}-06-30`,
    },
    {
      id: 'Q3',
      startISO: `${year}-07-01`,
      endISO: `${year}-09-30`,
    },
    {
      id: 'Q4',
      startISO: `${year}-10-01`,
      endISO: `${year}-12-31`,
    },
  ]
}

// Months in a year. Good for marketing_funnels table
export function buildMonthlyTimeframes(year: number): TimeframeDef[] {
  const tfs: TimeframeDef[] = []

  for (let m = 0; m < 12; m++) {
    const start = new Date(year, m, 1)
    const end = new Date(year, m + 1, 0)
    const startISO = start.toISOString().split('T')[0]
    const endISO = end.toISOString().split('T')[0]

    const monthName = MONTHS[m]

    tfs.push({
      id: monthName, // simple id. you can change to `${year}-${m+1}` if you prefer later
      startISO,
      endISO,
    })
  }

  return tfs
}

// -------------------- Core funnel computation --------------------

// firstApptLookup maps identity key (email or phone or nameKey) to earliest first_appt ISO date
export function computeFunnelsFromAppointments(
  appointments: AcuityAppointment[],
  userId: string,
  firstApptLookup: Record<string, string>,
  tfDefs: TimeframeDef[],
): Record<string, Record<string, FunnelStats>> {
  const funnels: Record<string, Record<string, FunnelStats>> = {}
  const clientVisits: Record<string, { dateISO: string; price: number }[]> = {}
  const clientIdentity: Record<string, { email: string; phone: string; nameKey: string }> = {}
  const clientSource: Record<string, string> = {}

  // ==================== PASS 1: Collect visits, identity, and sources ====================
  for (const appt of appointments) {
    const apptDateISO = appt.datetime.split('T')[0]
    const price = parseFloat((appt.priceSold as any) || '0')

    const email = (appt.email || '').toLowerCase().trim()
    const phone = normalizePhone(appt.phone || '')
    const nameKey = normalizeNameKey(appt.firstName, appt.lastName)

    if (!email && !phone && !nameKey) continue

    const clientKey = buildClientKey(appt as any, userId)

    if (!clientVisits[clientKey]) {
      clientVisits[clientKey] = []
    }
    clientVisits[clientKey].push({ dateISO: apptDateISO, price })

    clientIdentity[clientKey] = { email, phone, nameKey }

    // Only set source once per client (first occurrence)
    if (!clientSource[clientKey]) {
      const extracted = extractSourceFromForms(appt.forms)
      if (extracted) {
        clientSource[clientKey] = extracted
      }
    }
  }

  // ==================== PASS 2: Classify clients and compute stats per timeframe ====================
  for (const [clientKey, visits] of Object.entries(clientVisits)) {
    const source = clientSource[clientKey]
    if (!source) continue

    const identity = clientIdentity[clientKey]
    const idKeys = [
      identity?.email || '',
      identity?.phone || '',
      identity?.nameKey || '',
    ].filter(Boolean) as string[]

    // Look up first_appt from database
    let firstAppt: string | null = null
    for (const k of idKeys) {
      const fa = firstApptLookup[k]
      if (fa && (!firstAppt || fa < firstAppt)) {
        firstAppt = fa
      }
    }

    // Skip if not found in database
    if (!firstAppt) continue

    // Log client info
    console.log(`${identity.nameKey.padEnd(30)} | First visit: ${firstAppt} | Source: ${source}`)

    const sortedVisits = [...visits].sort((a, b) =>
      a.dateISO.localeCompare(b.dateISO),
    )

    const secondAppt = sortedVisits.length > 1 ? sortedVisits[1].dateISO : null

    // Process each timeframe
    for (const tf of tfDefs) {
      const isFirstApptInTimeframe = firstAppt >= tf.startISO && firstAppt <= tf.endISO
      const isFirstApptBeforeTimeframe = firstAppt < tf.startISO

      // Skip if neither new nor returning in this timeframe
      if (!isFirstApptInTimeframe && !isFirstApptBeforeTimeframe) continue

      // Get visits within this timeframe
      const visitsInTimeframe = visits.filter(
        v => v.dateISO >= tf.startISO && v.dateISO <= tf.endISO
      )

      // Skip if no visits in this timeframe
      if (visitsInTimeframe.length === 0) continue

      // Initialize funnel structures
      if (!funnels[tf.id]) {
        funnels[tf.id] = {}
      }
      if (!funnels[tf.id][source]) {
        funnels[tf.id][source] = {
          new_clients: 0,
          returning_clients: 0,
          new_clients_retained: 0,
          total_revenue: 0,
          total_visits: 0,
        }
      }

      const stats = funnels[tf.id][source]

      // Add revenue and visits for this timeframe
      for (const visit of visitsInTimeframe) {
        stats.total_revenue += visit.price
        stats.total_visits += 1
      }

      // Classify as new or returning
      if (isFirstApptInTimeframe) {
        stats.new_clients += 1

        // Check if new client returned within the same timeframe
        if (secondAppt && secondAppt > firstAppt && secondAppt <= tf.endISO) {
          stats.new_clients_retained += 1
        }
      } else if (isFirstApptBeforeTimeframe) {
        stats.returning_clients += 1
      }
    }
  }

  return funnels
}