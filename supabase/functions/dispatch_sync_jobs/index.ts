// @ts-nocheck
// supabase/functions/queue_pending_syncs/index.ts
//
// Cron job: runs every hour.
// Finds all pending rows in sync_status and enqueues one /api/pull
// job per row to a per-user QStash queue (parallelism 1), so months for the
// same user never overlap. /api/pull records processing / completed /
// retrying / failed in sync_status.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Client } from 'npm:@upstash/qstash'

const supabase = createClient(
  Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? '',
)

Deno.serve(async (_req) => {
  try {
    const QSTASH_TOKEN = Deno.env.get('QSTASH_TOKEN') ?? ''
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    const BYPASS_TOKEN = Deno.env.get('BYPASS_TOKEN') ?? ''
    const siteUrl = 'https://www.corva.ca'

    const qstash = new Client({
      baseUrl: 'https://qstash-us-east-1.upstash.io',
      token: QSTASH_TOKEN,
    })

    // Fetch all pending rows across all users
    const { data: rows, error } = await supabase
      .from('sync_status')
      .select('user_id, month, year')
      .eq('status', 'pending')
      .order('year', { ascending: true })

    if (error) throw error

    if (!rows || rows.length === 0) {
      console.log('[queue_pending_syncs] No pending rows.')
      return new Response(JSON.stringify({ message: 'Nothing to queue', queued: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`[queue_pending_syncs] Enqueueing ${rows.length} rows...`)

    // One queue per barber (same name as lib/booking/syncQueue.ts) so a barber's months
    // never run in parallel. Rows are marked 'queued' first so the next hourly run
    // doesn't enqueue them again; failed enqueues go back to 'pending'.
    const setStatus = (row: { user_id: string; month: string; year: number }, status: string) =>
      supabase
        .from('sync_status')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('user_id', row.user_id)
        .eq('month', row.month)
        .eq('year', row.year)

    // Newest months first: that's the data barbers look at
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const rank = (r: { month: string; year: number }) => r.year * 12 + MONTHS.indexOf(r.month)
    const byUser = new Map<string, typeof rows>()
    for (const row of [...rows].sort((a, b) => rank(b) - rank(a))) {
      byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row])
    }

    let enqueued = 0
    const failures: string[] = []

    // Users in parallel; each user's months in order so their queue keeps that order
    await Promise.all(Array.from(byUser.entries()).map(async ([userId, userRows]) => {
      const queue = qstash.queue({ queueName: `sync-${userId}` })
      try {
        await queue.upsert({ parallelism: 1 })
      } catch (err) {
        console.error(`[queue_pending_syncs] ✗ Could not create queue for ${userId}:`, err)
        failures.push(userId)
        return
      }

      for (const row of userRows) {
        await setStatus(row, 'queued')
        try {
          await queue.enqueue({
            url: `${siteUrl}/api/pull?granularity=month&month=${encodeURIComponent(row.month)}&year=${row.year}`,
            method: 'GET',
            retries: 3,
            headers: {
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'X-User-Id': row.user_id,
              'x-vercel-protection-bypass': BYPASS_TOKEN,
            },
          })
          enqueued++
          console.log(`[queue_pending_syncs] ✓ Enqueued ${row.month} ${row.year} for ${row.user_id}`)
        } catch (err) {
          await setStatus(row, 'pending')
          failures.push(`${row.user_id}:${row.month}-${row.year}`)
          console.error(`[queue_pending_syncs] ✗ Failed ${row.month} ${row.year} for ${row.user_id}:`, err)
        }
      }
    }))

    return new Response(JSON.stringify({ message: 'Enqueued', count: enqueued, failed: failures.length }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[queue_pending_syncs] Fatal error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})