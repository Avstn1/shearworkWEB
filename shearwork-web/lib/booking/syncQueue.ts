// lib/booking/syncQueue.ts
//
// Background month syncs go through one QStash queue per barber:
// - one month at a time per barber (parallel pulls for the same barber could each
//   create the same brand-new client twice), while different barbers run in parallel
// - QStash retries failed pulls (non-2xx) with backoff, so no request has to stay
//   alive for the whole history
// - /api/pull records progress in sync_status: queued -> processing -> completed |
//   retrying -> failed
import type { SupabaseClient } from '@supabase/supabase-js'
import { qstashClient } from '@/lib/qstashClient'

export const SYNC_RETRIES = 3

export interface MonthToSync {
  month: string
  year: number
}

export function syncQueueName(userId: string): string {
  return `sync-${userId}`
}

export function monthPullUrl({ month, year }: MonthToSync): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.corva.ca'
  return `${base}/api/pull?granularity=month&month=${encodeURIComponent(month)}&year=${year}`
}

/**
 * Enqueues month pulls for a barber, in the given order (put the month they need first
 * at the front). Returns the months that were enqueued successfully.
 */
export async function enqueueMonthSyncs(userId: string, months: MonthToSync[]): Promise<MonthToSync[]> {
  if (months.length === 0) return []

  const queue = qstashClient.queue({ queueName: syncQueueName(userId) })
  await queue.upsert({ parallelism: 1 })

  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'X-User-Id': userId,
  }
  if (process.env.BYPASS_TOKEN) headers['x-vercel-protection-bypass'] = process.env.BYPASS_TOKEN

  const enqueued: MonthToSync[] = []
  // Sequential so the queue keeps our order (current month first)
  for (const month of months) {
    try {
      await queue.enqueue({ url: monthPullUrl(month), method: 'GET', headers, retries: SYNC_RETRIES })
      enqueued.push(month)
    } catch (err) {
      console.error(`[sync-queue] failed to enqueue ${month.month} ${month.year} for ${userId}:`, err)
    }
  }
  return enqueued
}

/** QStash sends Upstash-Retried with the number of previous attempts. */
export function isFinalAttempt(request: Request): boolean {
  const retried = Number(request.headers.get('upstash-retried') ?? '0')
  return Number.isFinite(retried) && retried >= SYNC_RETRIES
}

export function isQStashDelivery(request: Request): boolean {
  return request.headers.has('upstash-message-id')
}

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type SyncStatusRow = { month: string; year: number; sync_phase?: string | null }

/** Priority months first, then most recent first. */
export function orderForSync<T extends SyncStatusRow>(rows: T[]): T[] {
  const rank = (r: T) => r.year * 12 + MONTH_ORDER.indexOf(r.month)
  return [...rows].sort((a, b) => {
    const pa = a.sync_phase === 'priority' ? 0 : 1
    const pb = b.sync_phase === 'priority' ? 0 : 1
    return pa - pb || rank(b) - rank(a)
  })
}

/**
 * Marks the months 'queued', then enqueues them in sync order. Marking first matters:
 * a quick month can finish before the next enqueue call returns, and marking afterwards
 * would overwrite its 'completed'. Months that fail to enqueue go back to 'pending'
 * for the hourly dispatcher to pick up.
 */
export async function queueMonthsForSync(
  supabase: SupabaseClient,
  userId: string,
  rows: SyncStatusRow[]
): Promise<number> {
  const ordered = orderForSync(rows)
  const setStatus = async (months: MonthToSync[], status: 'queued' | 'pending') => {
    const now = new Date().toISOString()
    for (const { month, year } of months) {
      await supabase
        .from('sync_status')
        .update({ status, error_message: null, updated_at: now })
        .eq('user_id', userId)
        .eq('month', month)
        .eq('year', year)
    }
  }

  const months = ordered.map(({ month, year }) => ({ month, year }))
  await setStatus(months, 'queued')
  const enqueued = await enqueueMonthSyncs(userId, months)
  const failed = months.filter(m => !enqueued.some(e => e.month === m.month && e.year === m.year))
  if (failed.length > 0) await setStatus(failed, 'pending')
  return enqueued.length
}
