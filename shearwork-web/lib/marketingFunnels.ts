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
  new_clients_retained: number  // NEW: new clients who came back within the same timeframe
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

  // ==================== PASS 1: Collect all visits and determine sources ====================
  const appointmentsByClient: Record<string, Array<{ dateISO: string; price: number; source: string | null }>> = {}

  for (const appt of appointments) {
    const apptDateISO = appt.datetime.split('T')[0]
    const price = parseFloat((appt.priceSold as any) || '0')

    const email = (appt.email || '').toLowerCase().trim()
    const phone = normalizePhone(appt.phone || '')
    const nameKey = normalizeNameKey(appt.firstName, appt.lastName)

    if (!email && !phone && !nameKey) continue

    const clientKey = buildClientKey(appt as any, userId)

    // Store all visits for this client WITH their individual sources
    if (!appointmentsByClient[clientKey]) appointmentsByClient[clientKey] = []
    const extracted = extractSourceFromForms(appt.forms)
    appointmentsByClient[clientKey].push({ dateISO: apptDateISO, price, source: extracted })

    // Store all visits for this client (for backward compatibility)
    if (!clientVisits[clientKey]) clientVisits[clientKey] = []
    clientVisits[clientKey].push({ dateISO: apptDateISO, price })

    // Store identity info
    clientIdentity[clientKey] = { email, phone, nameKey }
  }

  // Now determine the source based on the EARLIEST appointment WITH a source
  for (const [clientKey, appts] of Object.entries(appointmentsByClient)) {
    // Sort by date
    const sorted = appts.sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    
    // Find first appointment with a source
    const firstWithSource = sorted.find(a => a.source !== null)
    
    if (firstWithSource && firstWithSource.source) {
      clientSource[clientKey] = firstWithSource.source  // ✅ Just store the string
    } else {
      clientSource[clientKey] = 'No Source'
    }
  }

  // ==================== PASS 2: Determine first appointment date for each client ====================
  const clientFirstAppt: Record<string, string> = {}

  for (const [clientKey, visits] of Object.entries(clientVisits)) {
    const identity = clientIdentity[clientKey]

    // Build lookup keys (must match acuity/pull logic EXACTLY)
    const lookupKeys = [identity?.email, identity?.phone, identity?.nameKey].filter(Boolean)

    // Find earliest first_appt from database lookup ONLY
    let firstAppt: string | null = null
    for (const key of lookupKeys) {
      const dbFirstAppt = firstApptLookup[key]
      if (dbFirstAppt && (!firstAppt || dbFirstAppt < firstAppt)) {
        firstAppt = dbFirstAppt
      }
    }

    // Only use database value - if not found, client will be skipped in PASS 3
    if (firstAppt) {
      clientFirstAppt[clientKey] = firstAppt
    }
  }

  // ==================== PASS 3: Process each timeframe and classify clients ====================
  for (const tf of tfDefs) {
    if (!funnels[tf.id]) funnels[tf.id] = {}

    for (const [clientKey, visits] of Object.entries(clientVisits)) {
      let source = clientSource[clientKey] || 'No Source' 
      const firstAppt = clientFirstAppt[clientKey]
      const identity = clientIdentity[clientKey]

      if (!firstAppt) continue

      // Get all visits within this timeframe
      const visitsInTimeframe = visits.filter((v) => v.dateISO >= tf.startISO && v.dateISO <= tf.endISO)

      if (visitsInTimeframe.length === 0) continue

      // ✅ NEW LOGIC: Reclassify "Returning Client" as "No Source" if they're actually NEW
      const isFirstApptInTimeframe = firstAppt >= tf.startISO && firstAppt <= tf.endISO

      if (source === 'Returning Client' && isFirstApptInTimeframe) {
        source = 'No Source'
      }

      // Classify new vs returning clients
      const isFirstApptBeforeTimeframe = firstAppt < tf.startISO

      // ✅ ONLY CREATE SOURCE ENTRY IF CLIENT IS NEW OR RETURNING
      const isNew = isFirstApptInTimeframe
      const isReturning = isFirstApptBeforeTimeframe
      
      if (!isNew && !isReturning) continue  // Skip if neither new nor returning

      // Initialize stats for this source if needed
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

      if (isFirstApptInTimeframe) {
        stats.new_clients += 1
        
        // Add revenue and visits for new client
        for (const visit of visitsInTimeframe) {
          stats.total_revenue += visit.price
          stats.total_visits += 1
        }

        if (visitsInTimeframe.length > 1) {
          stats.returning_clients += 1
          stats.new_clients_retained += 1
        }
      } else if (isFirstApptBeforeTimeframe) {
        stats.returning_clients += 1
        
        // Add revenue and visits for returning client
        for (const visit of visitsInTimeframe) {
          stats.total_revenue += visit.price
          stats.total_visits += 1
        }
      }
    }
  }

  return funnels
}
