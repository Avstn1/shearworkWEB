import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { startOfDay, startOfWeek, startOfMonth, getHours, getDate, getDay, getISOWeek } from "npm:date-fns";

// ============================================================================
// CONFIGURATION
// ============================================================================

const allowedOrigins = [
  "http://localhost:3000",
  "https://shearwork-web.vercel.app",
];

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ============================================================================
// UTILITIES
// ============================================================================

function buildCors(origin: string | null) {
  const isAllowed = origin && allowedOrigins.includes(origin);
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function generateProgressiveArray(length: number): number[] {
  return Array.from({ length }, () => 0);
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

async function upsertSummary(
  dimension: string,
  action: string,
  length: number,
  logCount: number[],
  successCount: number[],
  pendingCount: number[],
  failedCount: number[]
) {
  try {
    const { data: existing, error: selectError } = await supabase
      .from('system_logs_summary')
      .select('*')
      .eq('dimension', dimension)
      .eq('action', action)
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error(`Error selecting summary for ${dimension}/${action}:`, selectError);
      throw selectError;
    }

    if (!existing) {
      const { error: insertError } = await supabase
        .from('system_logs_summary')
        .insert({
          dimension,
          action,
          log_count: logCount,
          success_count: successCount,
          pending_count: pendingCount,
          failed_count: failedCount,
        });

      if (insertError) {
        console.error(`Error inserting summary for ${dimension}/${action}:`, insertError);
        throw insertError;
      }
      console.log(`Inserted new summary: ${dimension}/${action}`);
    } else {
      // Always update to ensure data is current
      const { error: updateError } = await supabase
        .from('system_logs_summary')
        .update({
          log_count: logCount,
          success_count: successCount,
          pending_count: pendingCount,
          failed_count: failedCount,
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error(`Error updating summary for ${dimension}/${action}:`, updateError);
        throw updateError;
      }
      console.log(`Updated summary: ${dimension}/${action}`);
    }
  } catch (error) {
    console.error(`Failed to upsert summary for ${dimension}/${action}:`, error);
    throw error;
  }
}

// ============================================================================
// AGGREGATION FUNCTIONS
// ============================================================================

async function processHourlySummary(targetDate: string, now: Date) {
  console.log(`Processing hourly summary for ${targetDate}...`);
  const hourlyDimension = `hourly|${targetDate}`;
  
  // If it's today, only process up to current hour; otherwise process full 24 hours
  const isToday = targetDate === new Date().toISOString().split('T')[0];
  const hourlyLength = isToday ? getHours(new Date()) : 24;

  const startTime = startOfDay(now);
  const endTime = isToday 
    ? new Date(startTime.getTime() + getHours(new Date()) * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000)
    : new Date(startTime.getTime() + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000);

  const { data: hourlyLogs, error: hourlyError } = await supabase
    .from('system_logs')
    .select('*')
    .gte('timestamp', startTime.toISOString())
    .lte('timestamp', endTime.toISOString());

  if (hourlyError) {
    console.error("Error fetching hourly logs:", hourlyError);
    throw hourlyError;
  }

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
  console.log(`Hourly summary completed for ${targetDate}`);
}

async function processDailySummary(now: Date, currentDay: number) {
  console.log("Processing daily summary...");
  const dailyDimension = `daily|${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const dailyLength = currentDay;

  const { data: dailyLogs, error: dailyError } = await supabase
    .from('system_logs')
    .select('*')
    .gte('timestamp', startOfMonth(now).toISOString())
    .lte('timestamp', new Date(startOfMonth(now).getTime() + (currentDay - 1) * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000).toISOString());

  if (dailyError) {
    console.error("Error fetching daily logs:", dailyError);
    throw dailyError;
  }

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
  console.log("Daily summary completed");
}

async function processWeeklySummary(weekStart: Date, weekEnd: Date, weekNumber: number, year: number) {
  console.log(`Processing weekly summary for ${year}-W${weekNumber}...`);
  const weeklyDimension = `weekly|${year}-W${weekNumber}`;

  const { data: weeklyLogs, error: weeklyError } = await supabase
    .from('system_logs')
    .select('*')
    .gte('timestamp', weekStart.toISOString())
    .lte('timestamp', weekEnd.toISOString());

  if (weeklyError) {
    console.error("Error fetching weekly logs:", weeklyError);
    throw weeklyError;
  }

  const weeklyAggregates: Record<string, { log: number[]; success: number[]; pending: number[]; failed: number[] }> = {};

  // Always create arrays of length 7 for a full week (Mon-Sun)
  for (const log of (weeklyLogs as any[]) || []) {
    if (!weeklyAggregates[log.action]) {
      weeklyAggregates[log.action] = {
        log: generateProgressiveArray(7),
        success: generateProgressiveArray(7),
        pending: generateProgressiveArray(7),
        failed: generateProgressiveArray(7),
      };
    }
    const dayIndex = (new Date(log.timestamp).getDay() + 6) % 7; // Monday=0
    weeklyAggregates[log.action].log[dayIndex]++;
    if (log.status === 'success') weeklyAggregates[log.action].success[dayIndex]++;
    else if (log.status === 'pending') weeklyAggregates[log.action].pending[dayIndex]++;
    else if (log.status === 'failed') weeklyAggregates[log.action].failed[dayIndex]++;
  }

  if (Object.keys(weeklyAggregates).length === 0) {
    weeklyAggregates['no_logs'] = {
      log: generateProgressiveArray(7),
      success: generateProgressiveArray(7),
      pending: generateProgressiveArray(7),
      failed: generateProgressiveArray(7),
    };
  }

  for (const [action, counts] of Object.entries(weeklyAggregates)) {
    await upsertSummary(weeklyDimension, action, 7, counts.log, counts.success, counts.pending, counts.failed);
  }
  console.log(`Weekly summary completed for ${year}-W${weekNumber}`);
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

console.log("Starting edge cron aggregation...");

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCors(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let targetDate: string;
    
    const contentType = req.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const body = await req.json();
      targetDate = body.targetDate;
    }
    
    if (!targetDate) {
      targetDate = new Date().toISOString().split('T')[0];
      console.log("No targetDate provided, using today's date:", targetDate);
    }

    const now = new Date(targetDate);

    if (isNaN(now.getTime())) {
      console.error("Invalid date format:", targetDate);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid date format" }), 
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const currentDay = getDate(now);
    const currentWeekDay = (now.getDay() + 6) % 7;
    const currentWeekNumber = getISOWeek(now);

    console.log(`Generating summaries for month up to ${now.toISOString()}`);

    // Process hourly summaries for each day of the month up to current day
    const year = now.getFullYear();
    const month = now.getMonth();
    const processedWeeks = new Map<string, { start: Date; end: Date; weekNum: number; year: number }>();
    
    for (let day = 1; day <= currentDay; day++) {
      const dayDate = new Date(year, month, day);
      const dayDateStr = dayDate.toISOString().split('T')[0];
      
      // Process hourly summary for this day
      await processHourlySummary(dayDateStr, dayDate);
      
      // Track which week this day belongs to
      const weekNumber = getISOWeek(dayDate);
      const weekYear = dayDate.getFullYear();
      const weekKey = `${weekYear}-W${weekNumber}`;
      
      if (!processedWeeks.has(weekKey)) {
        const weekStart = startOfWeek(dayDate, { weekStartsOn: 1 });
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000);
        processedWeeks.set(weekKey, { start: weekStart, end: weekEnd, weekNum: weekNumber, year: weekYear });
      }
    }

    // Process weekly summaries for all unique weeks encountered
    for (const [weekKey, { start, end, weekNum, year: weekYear }] of processedWeeks) {
      await processWeeklySummary(start, end, weekNum, weekYear);
    }

    // Process daily summary (once for the whole month)
    await processDailySummary(now, currentDay);

    console.log("Edge cron aggregation completed successfully.");
    return new Response(
      JSON.stringify({ 
        success: true, 
        timestamp: now.toISOString(),
        daysProcessed: currentDay
      }), 
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err.message || "Unknown error occurred",
        stack: err.stack 
      }), 
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});