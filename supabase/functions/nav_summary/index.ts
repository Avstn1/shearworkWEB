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

// Helper to get ISO week string, e.g., "2025-W46"
function getISOWeek(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  const target = new Date(date)
  const day = target.getDay()
  const diff = (day === 0 ? 6 : day - 1) // Monday=0
  target.setDate(target.getDate() - diff + 3) // Thursday of the week
  const yearStart = new Date(target.getFullYear(), 0, 4)
  const weekNo = Math.floor(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7) + 1
  return `${target.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// Helper to get Monday and Sunday of ISO week
function getWeekRange(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  const day = date.getDay()
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((day + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const format = (d: Date) => d.toISOString().split('T')[0]
  return { monday: format(monday), sunday: format(sunday) }
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
    const body = await req.json()
    const { startDate, endDate, targetDate, summaryType, isoWeek, isoWeekStart, isoWeekEnd } = body

    if (!summaryType) throw new Error("Missing summaryType")
    if (!targetDate && !startDate && !endDate && !isoWeek && !(isoWeekStart && isoWeekEnd)) {
      return new Response(JSON.stringify({ error: "Missing date information" }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    let gte: string, lte: string

    if (summaryType === 'weekly') {
      if (isoWeek) {
        gte = `${summaryType}|${isoWeek}`
        lte = gte
      } else if (isoWeekStart && isoWeekEnd) {
        gte = `${summaryType}|${isoWeekStart}`
        lte = `${summaryType}|${isoWeekEnd}`
      } else if (targetDate) {
        const weekIso = getISOWeek(targetDate)
        gte = `${summaryType}|${weekIso}`
        lte = gte
      } else {
        // fallback if startDate/endDate given
        gte = `${summaryType}|${startDate}`
        lte = `${summaryType}|${endDate}`
      }
    } else if (summaryType === 'daily' || summaryType === 'hourly') {
      const start = targetDate ?? startDate
      const end = targetDate ?? endDate
      gte = `${summaryType}|${start}`
      lte = `${summaryType}|${end}`
    } else {
      throw new Error(`Unsupported summaryType: ${summaryType}`)
    }

    const { data, error } = await supabase
      .from("system_logs_summary")
      .select("*")
      .gte("dimension", gte)
      .lte("dimension", lte)
      .in("action", ["clicked_expenses", "clicked_dashboard", "clicked_barberEditor"])

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
      aggregated = Array.from({ length: 7 }, (_, i) => ({ log: 0, success: 0, pending: 0, failed: 0 }))

      for (const row of data ?? []) {
        for (let i = 0; i < 7; i++) {
          aggregated[i].log += Array.isArray(row.log_count) ? row.log_count[i] ?? 0 : row.log_count ?? 0
          aggregated[i].success += Array.isArray(row.success_count) ? row.success_count[i] ?? 0 : row.success_count ?? 0
          aggregated[i].pending += Array.isArray(row.pending_count) ? row.pending_count[i] ?? 0 : row.pending_count ?? 0
          aggregated[i].failed += Array.isArray(row.failed_count) ? row.failed_count[i] ?? 0 : row.failed_count ?? 0
        }
      }
    } else if (summaryType === "daily") {
      aggregated = (data ?? []).map((row: any, idx: number) => ({
        day: idx,
        log: row.log_count ?? 0,
        success: row.success_count ?? 0,
        pending: row.pending_count ?? 0,
        failed: row.failed_count ?? 0,
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
