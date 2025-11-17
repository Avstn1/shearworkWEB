import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { startOfDay, startOfWeek, startOfMonth, getHours, getDate, getDay, getISOWeek } from "https://cdn.skypack.dev/date-fns?dts";

// Allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "https://shearwork-web.vercel.app",
]

// Dynamic CORS builder
function buildCors(origin: string | null) {
  const isAllowed = origin && allowedOrigins.includes(origin)

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  }
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

console.log("Starting edge cron aggregation...");

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const corsHeaders = buildCors(origin)

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }


  try {
    const { targetDate } = await req.json()
    if (!targetDate) return NextResponse.json({ success: false, error: 'Missing targetDate' }, { status: 400 });

    const now = new Date(targetDate);

    const currentHour = getHours(now); // 0-based
    const currentDay = getDate(now); // 1-based
    const currentWeekDay = (now.getDay() + 6) % 7; // Monday=0
    const currentWeekNumber = getISOWeek(now);

    console.log(`Generating summaries for target date: ${now.toISOString()}`);

    const generateProgressiveArray = (length: number) => Array.from({ length }, () => 0);

    // -------------------------------
    // Upsert helper
    // -------------------------------
    async function upsertSummary(
      dimension: string,
      action: string,
      length: number,
      logCount: number[],
      successCount: number[],
      pendingCount: number[],
      failedCount: number[]
    ) {
      const { data: existing } = await supabase
        .from('system_logs_summary')
        .select('*')
        .eq('dimension', dimension)
        .eq('action', action)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        await supabase.from('system_logs_summary').insert({
          dimension,
          action,
          log_count: logCount,
          success_count: successCount,
          pending_count: pendingCount,
          failed_count: failedCount,
        });
      } else if (existing.log_count.length < length) {
        await supabase
          .from('system_logs_summary')
          .update({
            log_count: logCount,
            success_count: successCount,
            pending_count: pendingCount,
            failed_count: failedCount,
          })
          .eq('id', existing.id);
      }
    }

    // -------------------------------
    // 1. Hourly summary for target day
    // -------------------------------
    const hourlyDimension = `hourly|${targetDate}`;
    const hourlyLength = currentHour; // only hours that have passed

    const { data: hourlyLogs } = await supabase
      .from('system_logs')
      .select('*')
      .gte('timestamp', startOfDay(now).toISOString())
      .lte('timestamp', new Date(startOfDay(now).getTime() + currentHour * 60 * 60 * 1000 + 59 * 60 + 59).toISOString());

    const hourlyAggregates: Record<string, { log: number[]; success: number[]; pending: number[]; failed: number[] }> = {};

    for (const log of (hourlyLogs as any[]) || []) {
      if (!hourlyAggregates[log.action]) {
        hourlyAggregates[log.action] = {
          log: generateProgressiveArray(hourlyLength),
          success: generateProgressiveArray(hourlyLength),
          pending: generateProgressiveArray(hourlyLength),
          failed: generateProgressiveArray(hourlyLength),
        };
      }
      const hour = new Date(log.timestamp).getHours();
      if (hour < hourlyLength) {
        hourlyAggregates[log.action].log[hour]++;
        if (log.status === 'success') hourlyAggregates[log.action].success[hour]++;
        else if (log.status === 'pending') hourlyAggregates[log.action].pending[hour]++;
        else if (log.status === 'failed') hourlyAggregates[log.action].failed[hour]++;
      }
    }

    if (Object.keys(hourlyAggregates).length === 0) {
      hourlyAggregates['no_logs'] = {
        log: generateProgressiveArray(hourlyLength),
        success: generateProgressiveArray(hourlyLength),
        pending: generateProgressiveArray(hourlyLength),
        failed: generateProgressiveArray(hourlyLength),
      };
    }

    for (const [action, counts] of Object.entries(hourlyAggregates)) {
      await upsertSummary(hourlyDimension, action, hourlyLength, counts.log, counts.success, counts.pending, counts.failed);
    }

    // -------------------------------
    // 2. Daily summary for the month of targetDate
    // -------------------------------
    const dailyDimension = `daily|${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const dailyLength = currentDay; // only days that have passed

    const { data: dailyLogs } = await supabase
      .from('system_logs')
      .select('*')
      .gte('timestamp', startOfMonth(now).toISOString())
      .lte('timestamp', new Date(startOfMonth(now).getTime() + (currentDay - 1) * 24 * 60 * 60 * 1000 + 23 * 60 * 60 + 59 * 60 + 59).toISOString());

    const dailyAggregates: Record<string, { log: number[]; success: number[]; pending: number[]; failed: number[] }> = {};

    for (const log of (dailyLogs as any[]) || []) {
      if (!dailyAggregates[log.action]) {
        dailyAggregates[log.action] = {
          log: generateProgressiveArray(dailyLength),
          success: generateProgressiveArray(dailyLength),
          pending: generateProgressiveArray(dailyLength),
          failed: generateProgressiveArray(dailyLength),
        };
      }
      const dayIndex = new Date(log.timestamp).getDate() - 1;
      if (dayIndex < dailyLength) {
        dailyAggregates[log.action].log[dayIndex]++;
        if (log.status === 'success') dailyAggregates[log.action].success[dayIndex]++;
        else if (log.status === 'pending') dailyAggregates[log.action].pending[dayIndex]++;
        else if (log.status === 'failed') dailyAggregates[log.action].failed[dayIndex]++;
      }
    }

    if (Object.keys(dailyAggregates).length === 0) {
      dailyAggregates['no_logs'] = {
        log: generateProgressiveArray(dailyLength),
        success: generateProgressiveArray(dailyLength),
        pending: generateProgressiveArray(dailyLength),
        failed: generateProgressiveArray(dailyLength),
      };
    }

    for (const [action, counts] of Object.entries(dailyAggregates)) {
      await upsertSummary(dailyDimension, action, dailyLength, counts.log, counts.success, counts.pending, counts.failed);
    }

    // -------------------------------
    // 3. Weekly summary for the week of targetDate
    // -------------------------------
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weeklyDimension = `weekly|${now.getFullYear()}-W${currentWeekNumber}`;
    const weeklyLength = currentWeekDay + 1; // only days that have passed

    const { data: weeklyLogs } = await supabase
      .from('system_logs')
      .select('*')
      .gte('timestamp', weekStart.toISOString())
      .lte('timestamp', new Date(weekStart.getTime() + currentWeekDay * 24 * 60 * 60 * 1000 + 23 * 60 * 60 + 59 * 60 + 59).toISOString());

    const weeklyAggregates: Record<string, { log: number[]; success: number[]; pending: number[]; failed: number[] }> = {};

    for (const log of (weeklyLogs as any[]) || []) {
      if (!weeklyAggregates[log.action]) {
        weeklyAggregates[log.action] = {
          log: generateProgressiveArray(weeklyLength),
          success: generateProgressiveArray(weeklyLength),
          pending: generateProgressiveArray(weeklyLength),
          failed: generateProgressiveArray(weeklyLength),
        };
      }
      const dayIndex = (new Date(log.timestamp).getDay() + 6) % 7; // Monday=0
      if (dayIndex < weeklyLength) {
        weeklyAggregates[log.action].log[dayIndex]++;
        if (log.status === 'success') weeklyAggregates[log.action].success[dayIndex]++;
        else if (log.status === 'pending') weeklyAggregates[log.action].pending[dayIndex]++;
        else if (log.status === 'failed') weeklyAggregates[log.action].failed[dayIndex]++;
      }
    }

    if (Object.keys(weeklyAggregates).length === 0) {
      weeklyAggregates['no_logs'] = {
        log: generateProgressiveArray(weeklyLength),
        success: generateProgressiveArray(weeklyLength),
        pending: generateProgressiveArray(weeklyLength),
        failed: generateProgressiveArray(weeklyLength),
      };
    }

    for (const [action, counts] of Object.entries(weeklyAggregates)) {
      await upsertSummary(weeklyDimension, action, weeklyLength, counts.log, counts.success, counts.pending, counts.failed);
    };

    console.log("Edge cron aggregation completed successfully.");
    return new Response(JSON.stringify({ now }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})

