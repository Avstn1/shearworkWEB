import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = [
  "http://localhost:3000",
  "https://shearwork-web.vercel.app",
]

function buildCors(origin: string | null) {
  const isAllowed = origin && allowedOrigins.includes(origin)
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin")
  const corsHeaders = buildCors(origin)

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  try {
    const { startDate, endDate, targetDate, summaryType } = await req.json()
    if (!summaryType) throw new Error("Missing summaryType")
    if (!targetDate && (!startDate || !endDate)) {
      return new Response(JSON.stringify({ error: "Missing dates" }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const start = targetDate ?? startDate
    const end = targetDate ?? endDate

    const { data, error } = await supabase
      .from("system_logs_summary")
      .select("*")
      .gte("dimension", `${summaryType}|${start}`)
      .lte("dimension", `${summaryType}|${end}`)
      .eq("action", "user_login")

    if (error) throw error

    let aggregated: any[] = []

    if (summaryType === "hourly") {
      aggregated = Array.from({ length: 24 }, (_, i) => ({ hour: i, log: 0, success: 0, pending: 0, failed: 0 }))
      for (const row of data ?? []) {
        for (let i = 0; i < 24; i++) {
          aggregated[i].log += row.log_count?.[i] ?? 0
          aggregated[i].success += row.success_count?.[i] ?? 0
          aggregated[i].pending += row.pending_count?.[i] ?? 0
          aggregated[i].failed += row.failed_count?.[i] ?? 0
        }
      }
    } else if (summaryType === "weekly") {
      aggregated = Array.from({ length: 7 }, (_, i) => ({ day: i, log: 0, success: 0, pending: 0, failed: 0 }))
      for (const row of data ?? []) {
        for (let i = 0; i < 7; i++) {
          aggregated[i].log += row.log_count?.[i] ?? 0
          aggregated[i].success += row.success_count?.[i] ?? 0
          aggregated[i].pending += row.pending_count?.[i] ?? 0
          aggregated[i].failed += row.failed_count?.[i] ?? 0
        }
      }
    } else if (summaryType === "daily") {
      // assume 1 data point per day in the range
      aggregated = (data ?? []).map((row: any, idx: number) => ({
        day: idx,
        log: row.log_count?.[0] ?? 0,
        success: row.success_count?.[0] ?? 0,
        pending: row.pending_count?.[0] ?? 0,
        failed: row.failed_count?.[0] ?? 0,
      }))
    }

    return new Response(JSON.stringify({ summary: aggregated }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
