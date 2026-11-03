import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/redis', () => ({ redis: {} }))

import { enterSyncGate, SYNC_POLICY, type GateStore } from '@/lib/booking/syncGate'

/** In-memory stand-in for Redis: plain keys + sorted sets, TTLs ignored. */
function memoryStore(): GateStore & { kv: Map<string, string> } {
  const kv = new Map<string, string>()
  const zsets = new Map<string, Map<string, number>>()
  const zset = (key: string) => zsets.get(key) ?? zsets.set(key, new Map()).get(key)!
  return {
    kv,
    async get(key) { return kv.get(key) ?? null },
    async set(key, value, opts) {
      if (opts.nx && kv.has(key)) return null
      kv.set(key, value)
      return 'OK'
    },
    async del(key) { kv.delete(key) },
    async addAndCount(key, member, score, minScore) {
      const z = zset(key)
      for (const [m, s] of z) if (s <= minScore) z.delete(m)
      z.set(member, score)
      return z.size
    },
    async oldest(key) {
      const scores = [...zset(key).values()]
      return scores.length ? Math.min(...scores) : null
    },
    async remove(key, member) { zset(key).delete(member) },
  }
}

const base = { userId: 'u1', kind: 'month' as const, scope: 'month:2026-11', isCurrentPeriod: true }
const T0 = Date.parse('2026-11-03T15:00:00Z')

async function syncOnce(store: GateStore, now: number, extra: Partial<Parameters<typeof enterSyncGate>[0]> = {}) {
  const gate = await enterSyncGate({ ...base, store, now, ...extra })
  if (gate.run) await gate.finish(true)
  return gate
}

describe('sync gate', () => {
  it('runs the first sync, then serves a fresh current month without re-syncing', async () => {
    const store = memoryStore()
    vi.setSystemTime(T0)
    expect((await syncOnce(store, T0)).run).toBe(true)

    const again = await enterSyncGate({ ...base, store, now: T0 + 5 * 60_000 })
    expect(again.run).toBe(false)
    expect(again.run === false && again.status).toBe(200)
    expect(again.run === false && again.body.skipped).toBe('fresh')
    vi.useRealTimers()
  })

  it('syncs the current month again once the freshness window has passed', async () => {
    const store = memoryStore()
    vi.setSystemTime(T0)
    await syncOnce(store, T0)
    const later = await enterSyncGate({ ...base, store, now: T0 + SYNC_POLICY.freshCurrentMs + 1 })
    expect(later.run).toBe(true)
    vi.useRealTimers()
  })

  it('keeps past months fresh for much longer', async () => {
    const store = memoryStore()
    const past = { ...base, scope: 'month:2026-09', isCurrentPeriod: false }
    vi.setSystemTime(T0)
    await syncOnce(store, T0, past)
    const anHourLater = await enterSyncGate({ ...past, store, now: T0 + 60 * 60_000 })
    expect(anHourLater.run).toBe(false)
    vi.useRealTimers()
  })

  it('force (manual "Sync now") bypasses freshness', async () => {
    const store = memoryStore()
    vi.setSystemTime(T0)
    await syncOnce(store, T0)
    expect((await enterSyncGate({ ...base, store, now: T0 + 60_000, force: true })).run).toBe(true)
    vi.useRealTimers()
  })

  it('a second request while one is running is told it is in progress', async () => {
    const store = memoryStore()
    const first = await enterSyncGate({ ...base, store, now: T0 })
    const second = await enterSyncGate({ ...base, store, now: T0 + 1000 })
    expect(first.run).toBe(true)
    expect(second.run === false && second.status).toBe(202)
  })

  it('caps real syncs per account per hour and says when to retry', async () => {
    const store = memoryStore()
    const limit = SYNC_POLICY.maxPerHour.month
    for (let i = 0; i < limit; i++) {
      const g = await enterSyncGate({ ...base, store, now: T0 + i * 60_000, force: true })
      expect(g.run).toBe(true)
      if (g.run) await g.finish(true)
    }
    const over = await enterSyncGate({ ...base, store, now: T0 + limit * 60_000, force: true })
    expect(over.run).toBe(false)
    expect(over.run === false && over.status).toBe(429)
    expect(over.run === false && Number(over.body.retryAfterSeconds)).toBeGreaterThan(0)

    // The oldest sync ages out after an hour, freeing a slot
    const nextHour = await enterSyncGate({ ...base, store, now: T0 + 60 * 60_000 + 1, force: true })
    expect(nextHour.run).toBe(true)
  })

  it('skips (fresh / in progress) do not count towards the hourly limit', async () => {
    const store = memoryStore()
    vi.setSystemTime(T0)
    await syncOnce(store, T0)
    for (let i = 1; i <= 50; i++) await enterSyncGate({ ...base, store, now: T0 + i * 1000 })
    const g = await enterSyncGate({ ...base, store, now: T0 + 60_000, force: true })
    expect(g.run).toBe(true)
    vi.useRealTimers()
  })

  it('lets the sync run if the store is unavailable', async () => {
    const broken = memoryStore()
    broken.get = async () => { throw new Error('redis down') }
    expect((await enterSyncGate({ ...base, store: broken, now: T0 })).run).toBe(true)
  })
})
