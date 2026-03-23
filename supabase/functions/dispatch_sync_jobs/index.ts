// @ts-nocheck
// supabase/functions/queue_pending_syncs/index.ts
//
// Cron job: runs every hour.
// Finds all pending rows in sync_status and publishes one /api/pull
// job per row to QStash. QStash handles delivery and retries.
// When each pull finishes, /api/pull upserts the result to sync_status.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') ?? '',
  Deno.env.get('SERVICE_ROLE_KEY') ?? '',
)

Deno.serve(async (_req) => {
  try {
    const QSTASH_TOKEN = Deno.env.get('QSTASH_TOKEN') ?? ''
    const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    const BYPASS_TOKEN = Deno.env.get('BYPASS_TOKEN') ?? ''
    const siteUrl = Deno.env.get('NEXT_PUBLIC_SITE_URL') ?? ''

    // Fetch all pending rows across all users
    const { data: rows, error } = await supabase
      .from('sync_status')
      .select('user_id, month, year')
      .eq('status', 'pending')

    if (error) throw error

    if (!rows || rows.length === 0) {
      console.log('[queue_pending_syncs] No pending rows.')
      return new Response(JSON.stringify({ message: 'Nothing to queue', queued: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`[queue_pending_syncs] Queueing ${rows.length} rows...`)

    // Publish one /api/pull job per pending row to QStash
    const results = await Promise.allSettled(
      rows.map((row: { user_id: string; month: string; year: number }) => {
        const pullUrl = `${siteUrl}/api/pull?granularity=month&month=${encodeURIComponent(row.month)}&year=${row.year}`

        return fetch(
          `https://qstash.upstash.io/v2/publish/${encodeURIComponent(pullUrl)}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${QSTASH_TOKEN}`,
              'Content-Type': 'application/json',
              'Upstash-Forward-Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'Upstash-Forward-X-User-Id': row.user_id,
              'Upstash-Forward-x-vercel-protection-bypass': BYPASS_TOKEN,
            },
          }
        ).then(async (res) => {
          if (!res.ok) {
            const text = await res.text()
            throw new Error(`QStash error for ${row.user_id} ${row.month} ${row.year}: ${text}`)
          }
          console.log(`[queue_pending_syncs] ✓ Queued ${row.month} ${row.year} for ${row.user_id}`)
        })
      })
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    const errors = results
      .filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason?.message)

    console.log(`[queue_pending_syncs] Done. Queued: ${succeeded}, Failed: ${failed}`)

    return new Response(JSON.stringify({ message: 'Done', queued: succeeded, failed, errors }), {
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