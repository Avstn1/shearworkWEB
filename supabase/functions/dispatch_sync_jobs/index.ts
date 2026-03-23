// @ts-nocheck
// supabase/functions/dispatch_sync_jobs/index.ts
//
// Cron job: runs every 3 hours.
// Fetches all pending sync_status rows and fires a /api/pull request for
// each one WITHOUT awaiting the response (fire-and-forget).
// This function returns in milliseconds — Vercel handles the actual work.
//
// /api/pull is responsible for marking sync_status complete/failed when done.
//
// pg_cron schedule: 0 */3 * * *

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const PENDING_STATUSES = ["pending", "retrying"]
const MAX_RETRIES = 3

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? "",
  Deno.env.get("SERVICE_ROLE_KEY") ?? "",
)

Deno.serve(async (_req) => {
  try {
    const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL") ?? ""
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? ""
    const bypassToken = Deno.env.get("BYPASS_TOKEN") ?? ""

    console.log("[dispatch_sync_jobs] Starting.")

    // 1. Fetch all eligible rows
    const { data: rows, error } = await supabase
      .from("sync_status")
      .select("id, user_id, month, year")
      .in("status", PENDING_STATUSES)
      .lt("retry_count", MAX_RETRIES)

    if (error) throw error

    if (!rows || rows.length === 0) {
      console.log("[dispatch_sync_jobs] No pending rows.")
      return new Response(JSON.stringify({ message: "Nothing to dispatch", dispatched: 0 }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    console.log(`[dispatch_sync_jobs] Dispatching ${rows.length} jobs...`)

    // 2. Mark all as "queued" so the next cron run doesn't re-dispatch them
    //    before /api/pull has had a chance to finish
    const ids = rows.map((r) => r.id)
    const { error: updateError } = await supabase
      .from("sync_status")
      .update({ status: "queued", updated_at: new Date().toISOString() })
      .in("id", ids)

    if (updateError) throw updateError

    // 3. Fire all requests — no await on the fetch itself
    //    Each one is an independent Vercel function invocation
    for (const row of rows) {
      const url = new URL(`${siteUrl}/api/pull`)
      url.searchParams.set("granularity", "month")
      url.searchParams.set("month", row.month)
      url.searchParams.set("year", String(row.year))
      url.searchParams.set("sync_status_id", row.id) // so /api/pull can mark it done

      // Intentionally not awaited. Fire and forget
      fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          "X-User-Id": row.user_id,
          "x-vercel-protection-bypass": bypassToken,
        },
      }).catch((err) => {
        // Network-level failure (rare) — /api/pull will mark it failed via sync_status_id
        // Log for visibility but don't block the response
        console.error(`[dispatch_sync_jobs] Fetch failed for ${row.user_id} ${row.month} ${row.year}:`, err)
      })
    }

    console.log(`[dispatch_sync_jobs] All ${rows.length} jobs dispatched. Returning now.`)

    return new Response(
      JSON.stringify({ message: "Jobs dispatched", dispatched: rows.length }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[dispatch_sync_jobs] Error:", message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})