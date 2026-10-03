// scripts/compare-acuity-fetch.ts
//
// READ-ONLY check of the adaptive Acuity fetch against real data. For one barber it
// fetches the same months two ways and compares them:
//   - old: one request per day (what the sync used to do)
//   - new: lib/booking/adapters/acuityRangeFetch (week chunks, split when full)
// It never writes to the database and never refreshes tokens.
//
// Usage (from shearwork-web/):
//   npx vite-node --config vitest.config.mts scripts/compare-acuity-fetch.ts -- --user <uuid> [--months 2026-08,2026-09] [--probe-max]
//
// --probe-max also checks whether Acuity honors max > 100 (safe to raise ACUITY_PAGE_LIMIT?).

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import {
  addDays,
  fetchAppointmentRange,
  fetchJsonWithRetry,
  type AcuityRawAppointment,
} from '@/lib/booking/adapters/acuityRangeFetch'

const API = 'https://acuityscheduling.com/api/v1'

function loadEnv(path = '.env.local') {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  } catch {
    // rely on the existing environment
  }
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function monthRange(ym: string): [string, string] {
  const [y, m] = ym.split('-').map(Number)
  const start = `${ym}-01`
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  return [start, end < today ? end : today]
}

async function main() {
  loadEnv()
  const userId = arg('user')
  if (!userId) throw new Error('Pass --user <barber user_id>')

  const now = new Date()
  const defaultMonths = [1, 0].map(back => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
    return d.toISOString().slice(0, 7)
  })
  const months = (arg('months') ?? defaultMonths.join(',')).split(',').map(s => s.trim()).filter(Boolean)

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: token } = await supabase.from('acuity_tokens').select('access_token').eq('user_id', userId).maybeSingle()
  if (!token?.access_token) throw new Error('No Acuity token for that user')
  const { data: profile } = await supabase.from('profiles').select('calendar').eq('user_id', userId).maybeSingle()

  const headers = { Authorization: `Bearer ${token.access_token}` }
  const calendars = await fetchJsonWithRetry<Array<{ id: number; name: string }>>(`${API}/calendars`, { headers })
  const target = profile?.calendar?.trim().toLowerCase()
  const calendar = calendars.find(c => c.name?.trim().toLowerCase() === target) ?? calendars[0]
  if (!calendar) throw new Error('No Acuity calendar found')
  console.log(`Calendar: ${calendar.name} (${calendar.id})\n`)

  const pageLimit = Number(process.env.ACUITY_PAGE_LIMIT) || 100
  const page = (start: string, end: string, direction: 'ASC' | 'DESC', max = pageLimit) => {
    const url = new URL(`${API}/appointments`)
    url.searchParams.set('showall', 'true')
    url.searchParams.set('minDate', start)
    url.searchParams.set('maxDate', end)
    url.searchParams.set('max', String(max))
    url.searchParams.set('direction', direction)
    url.searchParams.set('calendarID', String(calendar.id))
    return fetchJsonWithRetry<AcuityRawAppointment[]>(url.toString(), { headers })
  }

  let allMatch = true
  for (const ym of months) {
    const [start, end] = monthRange(ym)

    // Old way: one request per day
    let oldRequests = 0
    const oldIds = new Set<string>()
    let fullDays = 0
    const t0 = Date.now()
    for (let day = start; day <= end; day = addDays(day, 1)) {
      oldRequests++
      const items = await page(day, day, 'DESC')
      if (items.length >= pageLimit) fullDays++
      items.forEach(i => oldIds.add(String(i.id)))
    }
    const oldMs = Date.now() - t0

    // New way
    const t1 = Date.now()
    const result = await fetchAppointmentRange((s, e, dir) => page(s, e, dir), start, end, { pageLimit })
    const newMs = Date.now() - t1
    const newIds = new Set(result.appointments.map(i => String(i.id)))

    const missing = [...oldIds].filter(id => !newIds.has(id))
    const extra = [...newIds].filter(id => !oldIds.has(id))
    const match = missing.length === 0 && extra.length === 0
    allMatch &&= match

    console.log(`${ym}: ${match ? 'MATCH' : 'MISMATCH'}`)
    console.log(`  old: ${oldIds.size} appointments, ${oldRequests} requests, ${oldMs} ms${fullDays ? ` (${fullDays} full days - old method may have truncated them)` : ''}`)
    console.log(`  new: ${newIds.size} appointments, ${result.requests} requests, ${newMs} ms`)
    if (result.saturatedDays.length) console.log(`  saturated days (>${pageLimit * 2}): ${result.saturatedDays.join(', ')}`)
    if (missing.length) console.log(`  missing from new: ${missing.slice(0, 20).join(', ')}`)
    if (extra.length) console.log(`  only in new (old per-day fetch truncated?): ${extra.slice(0, 20).join(', ')}`)
  }

  if (process.argv.includes('--probe-max')) {
    const [start, end] = [addDays(new Date().toISOString().slice(0, 10), -120), new Date().toISOString().slice(0, 10)]
    const big = await page(start, end, 'DESC', 1000)
    const small = await page(start, end, 'DESC', 100)
    console.log(`\nmax probe over ${start}..${end}: max=100 returned ${small.length}, max=1000 returned ${big.length}`)
    if (big.length > 100) console.log(`  Acuity honors max above 100 (returned ${big.length}). Raising ACUITY_PAGE_LIMIT is possible.`)
    else if (small.length < 100) console.log('  Inconclusive: fewer than 100 appointments in range. Try a busier barber.')
    else console.log('  Acuity capped the response at 100: keep ACUITY_PAGE_LIMIT=100.')
  }

  console.log(`\n${allMatch ? '✅ All months match' : '❌ Mismatch found - do not deploy until explained'}`)
  process.exit(allMatch ? 0 : 1)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
