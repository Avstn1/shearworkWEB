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
  total_revenue: number
  total_visits: number
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

export function normalizePhone(phone?: string | null) {
  return phone ? phone.replace(/\D/g, '') : ''
}

export function buildClientKey(client: AcuityAppointment & { id?: string }, userId: string) {
  const email = (client.email || '').toLowerCase().trim()
  const phone = normalizePhone(client.phone || '')
  const name = `${client.firstName || ''} ${client.lastName || ''}`
    .trim()
    .toLowerCase()
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

const REFERRAL_FILTER = ['unknown', 'returning', 'return', 'returning client']

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

      if (!REFERRAL_KEYWORDS.some((k) => fieldName.includes(k))) continue
      if (!fieldValue || fieldValue.includes(',')) continue

      const valueLower = fieldValue.toLowerCase()
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

  // ---------- First pass. visits, revenue, identity, source ----------
  for (const appt of appointments) {
    const apptDateISO = appt.datetime.split('T')[0]
    const price = parseFloat((appt.priceSold as any) || '0')

    const email = (appt.email || '').toLowerCase().trim()
    const phone = normalizePhone(appt.phone || '')
    const nameKey = `${appt.firstName || ''} ${appt.lastName || ''}`.trim().toLowerCase()

    if (!email && !phone && !nameKey) continue

    const clientKey = buildClientKey(appt as any, userId)

    if (!clientVisits[clientKey]) clientVisits[clientKey] = []
    clientVisits[clientKey].push({ dateISO: apptDateISO, price })

    clientIdentity[clientKey] = { email, phone, nameKey }

    // Determine canonical source for this client
    let source = clientSource[clientKey]
    if (!source) {
      const extracted = extractSourceFromForms(appt.forms)
      if (extracted) {
        clientSource[clientKey] = extracted
        source = extracted
      }
    }

    if (!source) continue

    // Aggregate revenue and visits per timeframe
    for (const tf of tfDefs) {
      if (apptDateISO >= tf.startISO && apptDateISO <= tf.endISO) {
        if (!funnels[tf.id]) funnels[tf.id] = {}
        if (!funnels[tf.id][source]) {
          funnels[tf.id][source] = {
            new_clients: 0,
            returning_clients: 0,
            total_revenue: 0,
            total_visits: 0,
          }
        }
        const stats = funnels[tf.id][source]
        stats.total_revenue += price
        stats.total_visits += 1
      }
    }
  }

  // ---------- Second pass. new vs returning per timeframe ----------
  for (const [clientKey, visits] of Object.entries(clientVisits)) {
    const source = clientSource[clientKey]
    if (!source) continue

    const identity = clientIdentity[clientKey]
    const idKeys = [
      identity?.email || '',
      identity?.phone || '',
      identity?.nameKey || '',
    ].filter(Boolean) as string[]

    let firstAppt: string | null = null
    for (const k of idKeys) {
      const fa = firstApptLookup[k]
      if (fa && (!firstAppt || fa < firstAppt)) {
        firstAppt = fa
      }
    }

    const sortedVisits = [...visits].sort((a, b) =>
      a.dateISO.localeCompare(b.dateISO),
    )

    if (!firstAppt && sortedVisits.length > 0) {
      firstAppt = sortedVisits[0].dateISO
    }

    const secondAppt =
      sortedVisits.length > 1 ? sortedVisits[1].dateISO : null

    if (!firstAppt) continue

    for (const tf of tfDefs) {
      if (!funnels[tf.id]) funnels[tf.id] = {}
      if (!funnels[tf.id][source]) {
        funnels[tf.id][source] = {
          new_clients: 0,
          returning_clients: 0,
          total_revenue: 0,
          total_visits: 0,
        }
      }
      const stats = funnels[tf.id][source]

      // New client in this timeframe
      if (firstAppt >= tf.startISO && firstAppt <= tf.endISO) {
        stats.new_clients += 1
      }

      // Returning client in this timeframe
      let isReturning = false
      if (secondAppt) {
        if (
          firstAppt >= tf.startISO &&
          firstAppt <= tf.endISO &&
          secondAppt > firstAppt &&
          secondAppt <= tf.endISO
        ) {
          isReturning = true
        }
      }

      if (isReturning) {
        stats.returning_clients += 1
      }
    }
  }

  return funnels
}
