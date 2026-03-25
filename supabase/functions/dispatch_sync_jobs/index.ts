// @ts-nocheck
// supabase/functions/queue_pending_syncs/index.ts
//
// Cron job: runs every hour.
// Finds all pending rows in sync_status and enqueues one /api/pull
// job per row to a per-user QStash queue. QStash guarantees sequential
// delivery within a queue, so months for the same user never overlap.
// When each pull finishes, /api/pull upserts the result to sync_status.

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

    // Fire and forget — enqueue each month into a per-user named queue.
    // QStash processes each queue sequentially, so months never overlap per user.
    for (const row of rows) {
      const pullUrl = `${siteUrl}/api/pull?granularity=month&month=${encodeURIComponent(row.month)}&year=${row.year}`

      qstash
        .queue({ queueName: row.user_id })
        .enqueue({
          url: pullUrl,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'X-User-Id': row.user_id,
            'x-vercel-protection-bypass': BYPASS_TOKEN,
          },
        })
        .then(() => {
          console.log(`[queue_pending_syncs] ✓ Enqueued ${row.month} ${row.year} for ${row.user_id}`)
        })
        .catch((err) => {
          console.error(`[queue_pending_syncs] ✗ Failed ${row.month} ${row.year} for ${row.user_id}:`, err)
        })
    }

    return new Response(JSON.stringify({ message: 'Enqueued', count: rows.length }), {
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