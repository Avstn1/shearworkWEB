// Sync pipeline against an in-memory Supabase that enforces PostgREST's 1000-row cap.
// These are the cases that silently produced wrong data before: barbers with more
// than 1000 clients, loyal clients with many appointments, and year-sized pulls.
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { memorySupabase, MAX_ROWS } from './helpers/memorySupabase'
import { chunk, fetchAllRows, selectAll, selectAllIn } from '@/lib/booking/db'
import { mapWithConcurrency } from '@/lib/booking/concurrency'
import { ClientProcessor } from '@/lib/booking/processors/clients'
import { AppointmentProcessor } from '@/lib/booking/processors/appointments'
import { runAggregations } from '@/lib/booking/processors/aggregations'
import type { NormalizedAppointment } from '@/lib/booking/types'

const USER = 'barber-1'
const asClient = (db: ReturnType<typeof memorySupabase>) => db as unknown as SupabaseClient

const phone = (i: number) => `+1416${String(1000000 + i).slice(-7)}`

function existingClient(i: number) {
  return {
    user_id: USER,
    client_id: `client-${String(i).padStart(5, '0')}`,
    email: `client${i}@example.com`,
    phone_normalized: phone(i),
    first_name: `first${i}`,
    last_name: `last${i}`,
    first_appt: '2024-01-15',
    second_appt: null,
    last_appt: '2024-06-01',
    first_source: null,
  }
}

function appointment(n: number, clientIndex: number, date: string, price = 40): NormalizedAppointment {
  return {
    externalId: String(900000 + n),
    datetime: `${date}T10:00:00-0500`,
    date,
    datetimeCreated: null,
    email: `client${clientIndex}@example.com`,
    phone: phone(clientIndex),
    phoneNormalized: phone(clientIndex),
    firstName: `First${clientIndex}`,
    lastName: `Last${clientIndex}`,
    serviceType: 'Haircut',
    price,
    tip: 5,
    notes: null,
    referralSource: null,
    canceled: false,
  } as NormalizedAppointment
}

const dateOf = (dayOfYear: number, year = 2025) =>
  new Date(Date.UTC(year, 0, 1 + dayOfYear)).toISOString().slice(0, 10)

// ---------------------------------------------------------------------------------
describe('paging helpers', () => {
  const db = memorySupabase({
    items: Array.from({ length: 2500 }, (_, i) => ({ id: `i-${String(i).padStart(5, '0')}`, user_id: USER, n: i })),
  })

  it('a plain select is capped at 1000 rows (the original bug)', async () => {
    const { data } = await db.from('items').select('*').eq('user_id', USER)
    expect((data as unknown[]).length).toBe(MAX_ROWS)
  })

  it('fetchAllRows / selectAll read every row exactly once', async () => {
    const rows = await fetchAllRows<{ n: number }>((from, to) =>
      db.from('items').select('*').eq('user_id', USER).order('id').range(from, to) as never
    )
    expect(rows).toHaveLength(2500)
    expect(new Set(rows.map(r => r.n)).size).toBe(2500)

    const { data } = await selectAll(() => db.from('items').select('*').eq('user_id', USER) as never, 'id')
    expect(data).toHaveLength(2500)
  })

  it('selectAllIn chunks long id lists (no URL-length failures) and pages each chunk', async () => {
    const ids = Array.from({ length: 1800 }, (_, i) => `i-${String(i).padStart(5, '0')}`)
    const { data, error } = await selectAllIn(ids, idChunk => db.from('items').select('*').in('id', idChunk) as never, 'id')
    expect(error).toBeNull()
    expect(data).toHaveLength(1800)
  })

  it('chunk and mapWithConcurrency keep order', async () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    let inFlight = 0
    let peak = 0
    const out = await mapWithConcurrency([5, 1, 4, 2, 3], 2, async n => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise(r => setTimeout(r, n))
      inFlight--
      return n * 10
    })
    expect(out).toEqual([50, 10, 40, 20, 30])
    expect(peak).toBe(2)
  })
})

// ---------------------------------------------------------------------------------
describe('ClientProcessor with more than 1000 clients', () => {
  it('matches clients beyond the first 1000 instead of creating duplicates, with no per-appointment queries', async () => {
    const db = memorySupabase({
      acuity_clients: Array.from({ length: 2500 }, (_, i) => existingClient(i)),
      acuity_appointments: [],
    })
    const appts = [2400, 1999, 1500, 7, 2499].map((c, n) => appointment(n, c, '2025-03-10'))
    const processor = new ClientProcessor(asClient(db), USER)
    const result = await processor.resolve(appts)

    expect(result.newClientIds.size).toBe(0)
    expect(result.appointmentToClient.get('902400')).toBeUndefined()
    expect(result.appointmentToClient.get(appts[0].externalId)).toBe('client-02400')
    expect(result.appointmentToClient.get(appts[4].externalId)).toBe('client-02499')
    // 3 pages of clients + count queries; never one query per appointment
    expect(db.stats.byTable.acuity_clients).toBe(3)
  })

  it('creates genuinely new clients without any lookups', async () => {
    const db = memorySupabase({ acuity_clients: [existingClient(1)], acuity_appointments: [] })
    const appts = Array.from({ length: 50 }, (_, n) => appointment(n, 5000 + n, '2025-03-10'))
    const processor = new ClientProcessor(asClient(db), USER)
    const result = await processor.resolve(appts)
    expect(result.newClientIds.size).toBe(50)
    expect(db.stats.byTable.acuity_clients).toBe(1)
  })

  it('counts appointments correctly for loyal clients (more than 1000 rows in one batch)', async () => {
    const appointmentsRows = [
      ...Array.from({ length: 1200 }, (_, n) => ({ id: `a-${n}`, user_id: USER, client_id: 'client-00000', appointment_date: '2024-02-01' })),
      ...Array.from({ length: 99 * 5 }, (_, n) => ({ id: `b-${n}`, user_id: USER, client_id: `client-${String(1 + (n % 99)).padStart(5, '0')}`, appointment_date: '2024-02-01' })),
    ]
    const db = memorySupabase({
      acuity_clients: Array.from({ length: 100 }, (_, i) => existingClient(i)),
      acuity_appointments: appointmentsRows,
    })
    const processor = new ClientProcessor(asClient(db), USER)
    await processor.resolve([appointment(1, 0, '2025-03-10')])
    const payload = processor.getUpsertPayload()
    const loyal = payload.find(p => p.client_id === 'client-00000')
    const other = payload.find(p => p.client_id === 'client-00042')
    expect(loyal?.total_appointments).toBe(1200)
    expect(other?.total_appointments).toBe(5)
  })
})

// ---------------------------------------------------------------------------------
describe('AppointmentProcessor bulk writes', () => {
  it('upserts in chunks, fills revenue/tip in bulk, and preserves manual edits', async () => {
    const existing = Array.from({ length: 200 }, (_, n) => ({
      id: `acuity_appointments-existing-${n}`,
      user_id: USER,
      acuity_appointment_id: String(900000 + n),
      client_id: 'client-00001',
      appointment_date: '2025-03-10',
      revenue: 99, // manually edited
      tip: 11,
    }))
    const db = memorySupabase({ acuity_appointments: existing })
    const appts = Array.from({ length: 1200 }, (_, n) => appointment(n, 1, dateOf(n % 60), 40))
    const resolution = {
      appointmentToClient: new Map(appts.map(a => [a.externalId, 'client-00001'])),
      clients: new Map(),
      newClientIds: new Set<string>(),
    }

    const processor = new AppointmentProcessor(asClient(db), USER)
    processor.process(appts, resolution as never)
    const result = await processor.upsert()

    const rows = db.tables.acuity_appointments
    expect(rows).toHaveLength(1200)
    expect(result.inserted).toBe(1000)
    expect(result.revenuePreserved).toBe(200)
    expect(rows.filter(r => r.revenue === 99 && r.tip === 11)).toHaveLength(200) // manual edits kept
    expect(rows.filter(r => r.revenue === 40 && r.tip === 5)).toHaveLength(1000) // new rows filled
    // 3 chunked upserts + 2 bulk fills, instead of 1 upsert + 1000 single UPDATEs
    expect(db.stats.byTable.acuity_appointments).toBe(5)
  })
})

// ---------------------------------------------------------------------------------
describe('aggregations over more than 1000 appointments', () => {
  it('a year pull totals every appointment (used to stop at the first 1000)', async () => {
    const appointmentsRows = Array.from({ length: 3000 }, (_, n) => ({
      id: `a-${String(n).padStart(5, '0')}`,
      user_id: USER,
      client_id: `client-${String(n % 400).padStart(5, '0')}`,
      appointment_date: dateOf(n % 365),
      revenue: 40,
      tip: 5,
      service_type: 'Haircut',
    }))
    const db = memorySupabase({
      acuity_appointments: appointmentsRows,
      acuity_clients: Array.from({ length: 400 }, (_, i) => ({ ...existingClient(i), first_appt: '2024-01-01' })),
      square_appointments: [],
      square_payments: [],
      square_clients: [],
      square_tokens: [],
    })

    const results = await runAggregations({ supabase: asClient(db), userId: USER, options: { granularity: 'year', year: 2025 } })
    expect(results.filter(r => r.error)).toEqual([])

    const monthly = db.tables.monthly_data ?? []
    const totalAppointments = monthly.reduce((sum, r) => sum + Number(r.num_appointments), 0)
    const totalRevenue = monthly.reduce((sum, r) => sum + Number(r.total_revenue), 0)
    expect(monthly).toHaveLength(12)
    expect(totalAppointments).toBe(3000)
    expect(totalRevenue).toBe(3000 * 40)

    const daily = db.tables.daily_data ?? []
    expect(daily.reduce((sum, r) => sum + Number(r.num_appointments ?? 0), 0)).toBe(3000)
  })
})
