import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { memorySupabase } from './helpers/memorySupabase'

const events: string[] = []
const enqueued: Array<{ queue: string; url: string; headers: Record<string, string>; retries?: number }> = []
let failUrls = new Set<string>()

vi.mock('@/lib/qstashClient', () => ({
  qstashClient: {
    queue: ({ queueName }: { queueName: string }) => ({
      upsert: async () => { events.push(`upsert-queue:${queueName}`) },
      enqueue: async (req: { url: string; headers: Record<string, string>; retries?: number }) => {
        if ([...failUrls].some(f => req.url.includes(f))) throw new Error('qstash down')
        events.push(`enqueue:${decodeURIComponent(req.url.split('month=')[1])}`)
        enqueued.push({ queue: queueName, ...req })
        return { messageId: 'm' }
      },
    }),
  },
}))

let db = memorySupabase()
const state: { user: User | null; pullResult: unknown; pullThrows: boolean } = { user: null, pullResult: null, pullThrows: false }

// Routes may create their client once at import time, so always delegate to the
// current test's database
const currentDb = { from: (name: string) => db.from(name) }
vi.mock('@/lib/supabaseServer', () => ({
  createSupabaseAdminClient: () => currentDb,
  createSupabaseServerClient: async () => currentDb,
}))
vi.mock('@/utils/api-auth', () => ({
  getAuthenticatedUser: async () => ({ user: state.user, supabase: currentDb, isService: false }),
}))
vi.mock('@/lib/booking/orchestrator', () => ({
  pull: async () => {
    if (state.pullThrows) throw new Error('boom')
    return state.pullResult
  },
}))

const USER = '11111111-1111-4111-8111-111111111111'
const okResult = { success: true, appointmentCount: 3, errors: undefined }

beforeEach(() => {
  events.length = 0
  enqueued.length = 0
  failUrls = new Set()
  state.user = { id: USER } as User
  state.pullResult = okResult
  state.pullThrows = false
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.corva.ca'
})

const statusRow = (month: string, year: number, status: string, sync_phase = 'background') => ({
  id: `${month}-${year}`, user_id: USER, month, year, status, sync_phase, updated_at: new Date().toISOString(),
})

describe('queueMonthsForSync', () => {
  it('queues the priority month first, then newest to oldest, one queue per barber', async () => {
    db = memorySupabase({
      sync_status: [
        statusRow('January', 2025, 'pending'),
        statusRow('October', 2026, 'pending', 'priority'),
        statusRow('March', 2026, 'pending'),
        statusRow('December', 2025, 'pending'),
      ],
    })
    const { queueMonthsForSync } = await import('@/lib/booking/syncQueue')
    const count = await queueMonthsForSync(db as unknown as SupabaseClient, USER, db.tables.sync_status as never)

    expect(count).toBe(4)
    expect(enqueued.map(e => e.url.split('month=')[1])).toEqual([
      'October&year=2026', 'March&year=2026', 'December&year=2025', 'January&year=2025',
    ])
    expect(new Set(enqueued.map(e => e.queue))).toEqual(new Set([`sync-${USER}`]))
    expect(enqueued[0].headers).toMatchObject({ Authorization: 'Bearer service-key', 'X-User-Id': USER })
    expect(enqueued[0].retries).toBe(3)
    expect(db.tables.sync_status.every(r => r.status === 'queued')).toBe(true)
  })

  it('marks rows queued before enqueueing (a fast month must not be overwritten after it completes)', async () => {
    db = memorySupabase({ sync_status: [statusRow('May', 2026, 'pending')] })
    const original = db.from.bind(db)
    db.from = ((name: string) => {
      events.push(`db:${name}`)
      return original(name)
    }) as typeof db.from
    const { queueMonthsForSync } = await import('@/lib/booking/syncQueue')
    await queueMonthsForSync(db as unknown as SupabaseClient, USER, db.tables.sync_status as never)
    expect(events.indexOf('db:sync_status')).toBeLessThan(events.findIndex(e => e.startsWith('enqueue:')))
  })

  it('months that fail to enqueue go back to pending for the hourly dispatcher', async () => {
    db = memorySupabase({ sync_status: [statusRow('May', 2026, 'pending'), statusRow('June', 2026, 'pending')] })
    failUrls = new Set(['month=May'])
    const { queueMonthsForSync } = await import('@/lib/booking/syncQueue')
    const count = await queueMonthsForSync(db as unknown as SupabaseClient, USER, db.tables.sync_status as never)
    expect(count).toBe(1)
    const byMonth = Object.fromEntries(db.tables.sync_status.map(r => [r.month, r.status]))
    expect(byMonth).toEqual({ May: 'pending', June: 'queued' })
  })
})

describe('/api/pull sync_status handling', () => {
  const call = async (headers: Record<string, string> = {}) => {
    const { GET } = await import('@/app/(api)/api/pull/route')
    return GET(new Request(`https://x/api/pull?granularity=month&month=May&year=2026`, { headers }))
  }

  it('queued -> completed, and notifies once the whole history is done', async () => {
    db = memorySupabase({ sync_status: [statusRow('May', 2026, 'queued'), statusRow('April', 2026, 'completed')], notifications: [] })
    const res = await call({ 'upstash-message-id': 'msg' })
    expect(res.status).toBe(200)
    expect(db.tables.sync_status.find(r => r.month === 'May')?.status).toBe('completed')
    expect(db.tables.notifications).toHaveLength(1)
  })

  it('does not notify while other months are still pending', async () => {
    db = memorySupabase({ sync_status: [statusRow('May', 2026, 'queued'), statusRow('April', 2026, 'queued')], notifications: [] })
    await call()
    expect(db.tables.notifications).toHaveLength(0)
  })

  it('daily re-syncs of an already completed month do not send notifications', async () => {
    db = memorySupabase({ sync_status: [statusRow('May', 2026, 'completed')], notifications: [] })
    await call()
    expect(db.tables.notifications).toHaveLength(0)
  })

  it('a failed source returns 502 so QStash retries, and records retrying', async () => {
    db = memorySupabase({ sync_status: [statusRow('May', 2026, 'queued')], notifications: [] })
    state.pullResult = { success: false, errors: ['Acuity: Acuity responded 503'] }
    const res = await call({ 'upstash-message-id': 'msg', 'upstash-retried': '0' })
    expect(res.status).toBe(502)
    const row = db.tables.sync_status[0]
    expect(row.status).toBe('retrying')
    expect(row.error_message).toContain('503')
  })

  it('the last QStash attempt records failed', async () => {
    db = memorySupabase({ sync_status: [statusRow('May', 2026, 'retrying')], notifications: [] })
    state.pullThrows = true
    const res = await call({ 'upstash-message-id': 'msg', 'upstash-retried': '3' })
    expect(res.status).toBe(500)
    expect(db.tables.sync_status[0].status).toBe('failed')
  })

  it('a barber with no booking connection is not retried', async () => {
    db = memorySupabase({ sync_status: [statusRow('May', 2026, 'queued')], notifications: [] })
    state.pullResult = { success: false, errors: ['No booking sources connected'] }
    const res = await call({ 'upstash-message-id': 'msg' })
    expect(res.status).toBe(200)
  })
})
