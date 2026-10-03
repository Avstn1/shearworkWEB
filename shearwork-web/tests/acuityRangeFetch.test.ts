import { describe, expect, it, vi } from 'vitest'
import {
  addDays,
  daysBetween,
  fetchAppointmentRange,
  fetchJsonWithRetry,
  splitIntoChunks,
  AcuityRequestError,
  type AcuityRawAppointment,
  type FetchPage,
} from '@/lib/booking/adapters/acuityRangeFetch'

// ---- a simulated Acuity /appointments endpoint ----------------------------------
// Returns appointments in [minDate, maxDate], sorted by datetime in `direction`,
// truncated to `max` - exactly the behaviour that makes naive large ranges lossy.

type Appt = AcuityRawAppointment & { date: string; datetime: string }

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

function buildDataset(startISO: string, days: number, perDay: (day: number, rand: () => number) => number, seed = 1): Appt[] {
  const rand = seededRandom(seed)
  const appts: Appt[] = []
  let id = 1
  for (let i = 0; i < days; i++) {
    const date = addDays(startISO, i)
    const count = perDay(i, rand)
    for (let n = 0; n < count; n++) {
      const minutes = Math.floor((n / Math.max(count, 1)) * 600) // spread 9:00-19:00
      const hh = String(9 + Math.floor(minutes / 60)).padStart(2, '0')
      const mm = String(minutes % 60).padStart(2, '0')
      appts.push({ id: id++, date, datetime: `${date}T${hh}:${mm}:00-0500` })
    }
  }
  return appts
}

function simulatedAcuity(data: Appt[], max: number, opts: { honorDirection?: boolean } = {}) {
  const honorDirection = opts.honorDirection ?? true
  const calls: Array<{ start: string; end: string; direction: string }> = []
  let inFlight = 0
  let maxInFlight = 0
  const fetchPage: FetchPage = async (start, end, direction) => {
    calls.push({ start, end, direction })
    inFlight++
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise(r => setTimeout(r, 1))
    inFlight--
    const inRange = data.filter(a => a.date >= start && a.date <= end)
    const sorted = [...inRange].sort((a, b) => a.datetime.localeCompare(b.datetime))
    const ordered = honorDirection && direction === 'ASC' ? sorted : sorted.reverse()
    return ordered.slice(0, max)
  }
  return { fetchPage, calls, maxInFlight: () => maxInFlight }
}

const ids = (items: AcuityRawAppointment[]) => new Set(items.map(i => String(i.id)))

// ---- date helpers ---------------------------------------------------------------
describe('date helpers', () => {
  it('addDays crosses month/year/leap boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01')
    expect(addDays('2025-03-09', 1)).toBe('2025-03-10') // DST change in North America
  })

  it('splitIntoChunks covers the range exactly, with no gaps or overlaps', () => {
    const chunks = splitIntoChunks('2025-01-01', '2025-01-31', 7)
    expect(chunks[0]).toEqual(['2025-01-01', '2025-01-07'])
    expect(chunks.at(-1)).toEqual(['2025-01-29', '2025-01-31'])
    for (let i = 1; i < chunks.length; i++) expect(addDays(chunks[i - 1][1], 1)).toBe(chunks[i][0])
    expect(splitIntoChunks('2025-01-05', '2025-01-05', 7)).toEqual([['2025-01-05', '2025-01-05']])
    expect(daysBetween('2025-01-01', '2025-12-31')).toBe(364)
  })
})

// ---- correctness ----------------------------------------------------------------
describe('fetchAppointmentRange returns every appointment', () => {
  const scenarios: Array<[string, (day: number, rand: () => number) => number]> = [
    ['quiet barber (0-6/day)', (_d, r) => Math.floor(r() * 7)],
    ['typical barber (5-15/day, closed Sundays)', (d, r) => (d % 7 === 6 ? 0 : 5 + Math.floor(r() * 11))],
    ['busy shop calendar (20-45/day)', (_d, r) => 20 + Math.floor(r() * 26)],
    ['spiky: empty weeks then 90-99 on single days', (d, r) => (d % 13 === 0 ? 90 + Math.floor(r() * 10) : r() < 0.1 ? 3 : 0)],
    ['days with exactly the page limit', (d) => (d % 5 === 0 ? 100 : 2)],
    ['days just over the page limit (101-180)', (d, r) => (d % 9 === 0 ? 101 + Math.floor(r() * 80) : 4)],
  ]

  it.each(scenarios)('%s, full year', async (_name, perDay) => {
    const data = buildDataset('2025-01-01', 365, perDay, 42)
    const api = simulatedAcuity(data, 100)
    const result = await fetchAppointmentRange(api.fetchPage, '2025-01-01', '2025-12-31', { pageLimit: 100 })

    expect(ids(result.appointments)).toEqual(ids(data))
    expect(result.appointments).toHaveLength(data.length) // no duplicates
    expect(result.saturatedDays).toEqual([])
  })

  it('single month, multiple page limits and chunk sizes', async () => {
    const data = buildDataset('2025-03-01', 31, (_d, r) => Math.floor(r() * 30), 7)
    for (const pageLimit of [25, 50, 100]) {
      for (const initialChunkDays of [1, 3, 7, 14, 31]) {
        const api = simulatedAcuity(data, pageLimit)
        const result = await fetchAppointmentRange(api.fetchPage, '2025-03-01', '2025-03-31', { pageLimit, initialChunkDays })
        expect(ids(result.appointments), `limit ${pageLimit}, chunk ${initialChunkDays}`).toEqual(ids(data))
      }
    }
  })

  it('every requested range is inside the requested window', async () => {
    const data = buildDataset('2025-01-01', 365, () => 30)
    const api = simulatedAcuity(data, 100)
    await fetchAppointmentRange(api.fetchPage, '2025-02-10', '2025-04-03')
    for (const call of api.calls) {
      expect(call.start >= '2025-02-10' && call.end <= '2025-04-03' && call.start <= call.end).toBe(true)
    }
  })
})

// ---- days beyond 2x the limit ---------------------------------------------------
describe('days that cannot be fully read', () => {
  it('reports a day with more than 2x pageLimit appointments instead of silently truncating', async () => {
    const data = buildDataset('2025-06-01', 7, d => (d === 3 ? 250 : 5))
    const api = simulatedAcuity(data, 100)
    const result = await fetchAppointmentRange(api.fetchPage, '2025-06-01', '2025-06-07')
    expect(result.saturatedDays).toEqual(['2025-06-04'])
    expect(result.appointments).toHaveLength(6 * 5 + 200) // both ends of the busy day
  })

  it('does not claim completeness when Acuity ignores the direction parameter', async () => {
    const data = buildDataset('2025-06-01', 3, d => (d === 1 ? 140 : 2))
    const api = simulatedAcuity(data, 100, { honorDirection: false })
    const result = await fetchAppointmentRange(api.fetchPage, '2025-06-01', '2025-06-03')
    expect(result.saturatedDays).toEqual(['2025-06-02'])
  })
})

// ---- efficiency -----------------------------------------------------------------
describe('request count vs. one request per day', () => {
  const cases: Array<[string, (day: number, rand: () => number) => number, number]> = [
    // [name, density, max requests allowed for a 365-day year]
    ['typical barber', (d, r) => (d % 7 === 6 ? 0 : 5 + Math.floor(r() * 11)), 80],
    ['quiet barber', (_d, r) => Math.floor(r() * 7), 60],
  ]

  it.each(cases)('%s: far fewer than 365 requests', async (_name, perDay, maxRequests) => {
    const data = buildDataset('2025-01-01', 365, perDay, 3)
    const api = simulatedAcuity(data, 100)
    const result = await fetchAppointmentRange(api.fetchPage, '2025-01-01', '2025-12-31')
    expect(result.requests).toBe(api.calls.length)
    expect(result.requests).toBeLessThanOrEqual(maxRequests)
    console.log(`[efficiency] ${_name}: ${data.length} appointments, ${result.requests} requests (per-day approach: 365)`)
  })

  it('respects the concurrency limit', async () => {
    const data = buildDataset('2025-01-01', 120, () => 10)
    const api = simulatedAcuity(data, 100)
    await fetchAppointmentRange(api.fetchPage, '2025-01-01', '2025-04-30', { concurrency: 3 })
    expect(api.maxInFlight()).toBeLessThanOrEqual(3)
    expect(api.maxInFlight()).toBeGreaterThan(1)
  })
})

// ---- failures -------------------------------------------------------------------
describe('failure handling', () => {
  it('rejects (instead of skipping the range) when a page ultimately fails', async () => {
    const fetchPage: FetchPage = async start => {
      if (start === '2025-01-08') throw new AcuityRequestError('Acuity responded 500', 500)
      return []
    }
    await expect(fetchAppointmentRange(fetchPage, '2025-01-01', '2025-01-31')).rejects.toThrow('500')
  })

  it('empty or inverted ranges make no requests', async () => {
    const fetchPage = vi.fn(async () => [])
    expect((await fetchAppointmentRange(fetchPage, '2025-02-01', '2025-01-31')).requests).toBe(0)
    expect(fetchPage).not.toHaveBeenCalled()
  })
})

describe('fetchJsonWithRetry', () => {
  const noSleep = { sleep: async () => {}, baseDelayMs: 1 }
  const res = (status: number, body: unknown = [], headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers })

  it('retries 429 and 5xx, then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(429, {}, { 'retry-after': '2' }))
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200, [{ id: 1 }]))
    const sleep = vi.fn(async () => {})
    const data = await fetchJsonWithRetry('u', {}, { sleep, baseDelayMs: 1 }, fetchImpl as unknown as typeof fetch)
    expect(data).toEqual([{ id: 1 }])
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenNthCalledWith(1, 2000) // honored Retry-After
  })

  it('retries network errors', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(res(200, []))
    await expect(fetchJsonWithRetry('u', {}, noSleep, fetchImpl as unknown as typeof fetch)).resolves.toEqual([])
  })

  it('fails fast on 401 (expired token) without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(401))
    await expect(fetchJsonWithRetry('u', {}, noSleep, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ status: 401 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('gives up after the retry budget', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(500))
    await expect(fetchJsonWithRetry('u', {}, { ...noSleep, retries: 2 }, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ status: 500 })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})

// ---- the real adapter's HTTP requests --------------------------------------------
describe('AcuityAdapter.fetchAppointments', () => {
  it('requests week ranges with max/direction/calendar, stops at today and drops future appointments', async () => {
    const { AcuityAdapter } = await import('@/lib/booking/adapters/acuity')
    const urls: URL[] = []
    const today = new Date().toISOString().slice(0, 10)
    const future = new Date(Date.now() + 3 * 3600_000).toISOString().replace('Z', '+0000')

    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const url = new URL(input)
      urls.push(url)
      const body = url.searchParams.get('maxDate') === today
        ? [
            { id: 1, datetime: `${today}T00:00:01+0000`, firstName: 'Ann', lastName: 'Lee', phone: '4165550101' },
            { id: 2, datetime: future, firstName: 'Bob', lastName: 'Ray', phone: '4165550102' },
          ]
        : []
      return new Response(JSON.stringify(body), { status: 200 })
    }))

    try {
      const start = addDays(today, -20)
      const adapter = new AcuityAdapter()
      const result = await adapter.fetchAppointments('token', 'cal-9', { startISO: start, endISO: addDays(today, 30) })

      expect(result.map(a => a.externalId)).toEqual(['1']) // future appointment dropped
      expect(urls.length).toBe(3) // 21 days -> 3 week-sized requests instead of 21
      for (const url of urls) {
        expect(url.pathname).toBe('/api/v1/appointments')
        expect(url.searchParams.get('max')).toBe('100')
        expect(url.searchParams.get('direction')).toBe('DESC')
        expect(url.searchParams.get('calendarID')).toBe('cal-9')
        expect(url.searchParams.get('showall')).toBe('true')
        expect(url.searchParams.get('maxDate')! <= today).toBe(true)
        expect(url.searchParams.has('offset')).toBe(false)
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
