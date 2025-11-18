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

function getISOWeek(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  if (isNaN(date.getTime())) return 'Invalid-W00'
  const target = new Date(date)
  const day = target.getDay()
  const diff = (day === 0 ? 6 : day - 1)
  target.setDate(target.getDate() - diff + 3)
  const yearStart = new Date(target.getFullYear(), 0, 4)
  const weekNo = Math.floor(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7) + 1
  return `${target.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
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
    console.log('📥 NAV_SUMMARY received:', JSON.stringify(body, null, 2))
    
    const { startDate, endDate, targetDate, summaryType, isoWeek } = body

    if (!summaryType) {
      throw new Error("Missing summaryType")
    }
    
    if (!targetDate && !startDate && !endDate && !isoWeek) {
      return new Response(JSON.stringify({ error: "Missing date information" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const actions = ['opened_monthly_report', 'opened_weekly_report', 'opened_wkComparison_report']
    
    if (summaryType === 'hourly') {
      const start = targetDate ?? startDate
      const end = targetDate ?? endDate
      
      console.log(`🔍 Querying HOURLY nav data from ${start} to ${end}`)

      // Query by date range - dimension format is "hourly|YYYY-MM-DD"
      const { data, error } = await supabase
        .from("system_logs_summary")
        .select("dimension, action, log_count")
        .gte("dimension", `hourly|${start}`)
        .lte("dimension", `hourly|${end}`)
        .in("action", actions)

      if (error) {
        console.error('❌ Database error:', error)
        throw error
      }

      console.log(`✅ Fetched ${data?.length || 0} hourly nav rows`)
      if (data && data.length > 0) {
        console.log('📋 Sample row:', data[0])
      }

      // Initialize 24 hours with zeros
      const aggregated = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        opened_monthly_report: 0,
        opened_weekly_report: 0,
        opened_wkComparison_report: 0,
      }))

      // Aggregate across all matching rows
      for (const row of data ?? []) {
        if (!actions.includes(row.action)) continue
        
        // log_count is an array of 24 elements (one per hour)
        const counts = Array.isArray(row.log_count) ? row.log_count : []
        
        console.log(`Processing ${row.action} for ${row.dimension}:`, counts)
        
        // Add each hour's count to the aggregated data
        counts.forEach((count, hourIndex) => {
          if (hourIndex >= 0 && hourIndex < 24) {
            const numCount = Number(count) || 0
            aggregated[hourIndex][row.action as keyof typeof aggregated[0]] += numCount
          }
        })
      }

      const totalLogs = aggregated.reduce((sum, h) => 
        sum + h.opened_monthly_report + h.opened_weekly_report + h.opened_wkComparison_report, 0
      )
      console.log(`📊 Total nav logs aggregated: ${totalLogs}`)

      return new Response(JSON.stringify({ summary: aggregated }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
      
    } else if (summaryType === 'weekly') {
      const week = isoWeek ?? getISOWeek(targetDate ?? startDate!)
      
      console.log(`🔍 Querying WEEKLY nav data for ${week}`)

      // Query for specific week - dimension format is "weekly|YYYY-WWW"
      const { data, error } = await supabase
        .from("system_logs_summary")
        .select("dimension, action, log_count")
        .eq("dimension", `weekly|${week}`)
        .in("action", actions)

      if (error) {
        console.error('❌ Database error:', error)
        throw error
      }

      console.log(`✅ Fetched ${data?.length || 0} weekly nav rows`)
      if (data && data.length > 0) {
        console.log('📋 Sample row:', data[0])
      }

      // Initialize 7 days with zeros
      const aggregated = Array.from({ length: 7 }, (_, i) => ({
        day: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
        opened_monthly_report: 0,
        opened_weekly_report: 0,
        opened_wkComparison_report: 0,
      }))

      // Aggregate the week's data
      for (const row of data ?? []) {
        if (!actions.includes(row.action)) continue
        
        // log_count is an array of 7 elements (one per day, Mon-Sun)
        const counts = Array.isArray(row.log_count) ? row.log_count : []
        
        console.log(`Processing ${row.action} for ${row.dimension}:`, counts)
        
        // Add each day's count to the aggregated data
        counts.forEach((count, dayIndex) => {
          if (dayIndex >= 0 && dayIndex < 7) {
            const numCount = Number(count) || 0
            aggregated[dayIndex][row.action as keyof typeof aggregated[0]] += numCount
          }
        })
      }

      const totalLogs = aggregated.reduce((sum, d) => 
        sum + d.opened_monthly_report + d.opened_weekly_report + d.opened_wkComparison_report, 0
      )
      console.log(`📊 Total nav logs aggregated: ${totalLogs}`)
      console.log('📊 Weekly breakdown:', aggregated)

      return new Response(JSON.stringify({ summary: aggregated }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    } else {
      throw new Error(`Unsupported summaryType: ${summaryType}`)
    }
  } catch (err: any) {
    console.error('💥 NAV_SUMMARY Error:', err)
    return new Response(
      JSON.stringify({ 
        error: err.message || 'Unknown error',
        stack: err.stack 
      }), 
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    )
  }
})