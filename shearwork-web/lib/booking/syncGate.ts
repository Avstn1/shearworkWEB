// /lib/booking/syncGate.ts
//
// Decides whether a user-triggered sync should actually run. Every page load in the web
// and mobile apps asks for a sync, so without this the same month is re-pulled from
// Acuity/Square many times an hour. Three rules, in order:
//
// 1. Fresh enough: if this period synced recently, skip and serve stored data
//    (bypassed with force=true, e.g. a "Sync now" button).
// 2. Hourly limit per account: caps real syncs (not skips) per rolling hour.
// 3. One at a time: a second request for the same period while one is running is
//    told it's in progress instead of starting a duplicate.
//
// Background callers (QStash queue, cron, service role) don't go through the gate.
// Redis errors fail open: the sync runs rather than the user being blocked.

import { redis } from '@/lib/redis'

export const SYNC_POLICY = {
  /** Skip automatic re-syncs of the current (or a future) period for this long */
  freshCurrentMs: 10 * 60 * 1000,
  /** Past periods rarely change; skip re-syncs for this long */
  freshPastMs: 6 * 60 * 60 * 1000,
  /** Real syncs allowed per account per rolling hour */
  maxPerHour: { month: 12, year: 2 },
  /** A sync holding the lock longer than this is assumed dead */
  lockTtlSeconds: 120,
} as const

export type SyncKind = 'month' | 'year'

/** Minimal store so tests can swap Redis out. */
export interface GateStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, opts: { ex: number; nx?: boolean }): Promise<unknown>
  del(key: string): Promise<unknown>
  /** Adds `member` at `score` to a sorted set, trims entries older than `minScore`, returns the count. */
  addAndCount(key: string, member: string, score: number, minScore: number, ttlSeconds: number): Promise<number>
  /** Oldest score in the sorted set, or null. */
  oldest(key: string): Promise<number | null>
  remove(key: string, member: string): Promise<unknown>
}

export const redisGateStore: GateStore = {
  get: key => redis.get<string>(key),
  set: (key, value, opts) => (opts.nx ? redis.set(key, value, { ex: opts.ex, nx: true }) : redis.set(key, value, { ex: opts.ex })),
  del: key => redis.del(key),
  async addAndCount(key, member, score, minScore, ttlSeconds) {
    const tx = redis.multi()
    tx.zremrangebyscore(key, 0, minScore)
    tx.zadd(key, { score, member })
    tx.zcard(key)
    tx.expire(key, ttlSeconds)
    const results = await tx.exec<[number, number, number, number]>()
    return Number(results[2] ?? 0)
  },
  async oldest(key) {
    const rows = await redis.zrange<string[]>(key, 0, 0, { withScores: true })
    return rows.length >= 2 ? Number(rows[1]) : null
  },
  remove: (key, member) => redis.zrem(key, member),
}

export type GateDecision =
  | { run: true; finish: (succeeded: boolean) => Promise<void> }
  | { run: false; status: 200 | 202 | 429; body: Record<string, unknown>; headers?: Record<string, string> }

const keys = (userId: string, scope: string, kind: SyncKind) => ({
  last: `sync:last:${userId}:${scope}`,
  lock: `sync:lock:${userId}:${scope}`,
  rate: `sync:rate:${userId}:${kind}`,
})

export async function enterSyncGate(params: {
  userId: string
  /** e.g. "month:2026-11" or "year:2026" */
  scope: string
  kind: SyncKind
  /** true when the period is the current one (or in the future) */
  isCurrentPeriod: boolean
  /** skip the freshness rule (manual "Sync now"); limits and locking still apply */
  force?: boolean
  now?: number
  store?: GateStore
}): Promise<GateDecision> {
  const { userId, scope, kind, isCurrentPeriod, force = false, store = redisGateStore } = params
  const now = params.now ?? Date.now()
  const k = keys(userId, scope, kind)
  const failOpen: GateDecision = { run: true, finish: async () => {} }

  try {
    // 1. Fresh enough?
    if (!force) {
      const last = Number(await store.get(k.last))
      const freshFor = isCurrentPeriod ? SYNC_POLICY.freshCurrentMs : SYNC_POLICY.freshPastMs
      if (last && now - last < freshFor) {
        return {
          run: false,
          status: 200,
          body: { skipped: 'fresh', lastSyncedAt: new Date(last).toISOString(), nextSyncAfter: new Date(last + freshFor).toISOString() },
        }
      }
    }

    // 3 (checked before counting, so a duplicate request doesn't use up the limit)
    const gotLock = await store.set(k.lock, String(now), { ex: SYNC_POLICY.lockTtlSeconds, nx: true })
    if (!gotLock) {
      return { run: false, status: 202, body: { skipped: 'in_progress' } }
    }

    // 2. Hourly limit
    const hourAgo = now - 60 * 60 * 1000
    const member = `${now}:${scope}`
    const count = await store.addAndCount(k.rate, member, now, hourAgo, 60 * 60)
    const limit = SYNC_POLICY.maxPerHour[kind]
    if (count > limit) {
      await store.remove(k.rate, member)
      await store.del(k.lock)
      const oldest = (await store.oldest(k.rate)) ?? now
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + 60 * 60 * 1000 - now) / 1000))
      return {
        run: false,
        status: 429,
        body: {
          error: `Sync limit reached (${limit} per hour). Try again in ${Math.ceil(retryAfterSeconds / 60)} min.`,
          retryAfterSeconds,
        },
        headers: { 'Retry-After': String(retryAfterSeconds) },
      }
    }

    return {
      run: true,
      finish: async (succeeded: boolean) => {
        try {
          if (succeeded) await store.set(k.last, String(Date.now()), { ex: 7 * 24 * 60 * 60 })
          await store.del(k.lock)
        } catch (err) {
          console.error('[syncGate] failed to record sync result:', err)
        }
      },
    }
  } catch (err) {
    console.error('[syncGate] unavailable, letting the sync run:', err)
    return failOpen
  }
}
