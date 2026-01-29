/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

// ============================================================================
// TYPES
// ============================================================================

interface RequestBody {
  targetDate: string; // any date in the month you want to update
}

interface AggregateData {
  log: number[];
  success: number[];
  pending: number[];
  failed: number[];
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Compute ISO week string from a date, e.g., "2025-W46"
 */
function getISOWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const yearStart = new Date(thursday.getFullYear(), 0, 4);
  const weekNo = Math.round(
    ((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${thursday.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ============================================================================
// TRANSFORM FUNCTIONS
// ============================================================================

/**
 * Transform hourly RPC data into aggregated arrays by action (24 hours)
 */
function transformHourly(data: any[]): Record<string, AggregateData> {
  const result: Record<string, AggregateData> = {};
  
  for (const row of data) {
    const action = row.action;
    if (!result[action]) {
      result[action] = {
        log: Array(24).fill(0),
        success: Array(24).fill(0),
        pending: Array(24).fill(0),
        failed: Array(24).fill(0),
      };
    }
    
    const h = Number(row.hour);
    const count = Number(row.count);
    result[action].log[h] += count;
    
    if (row.status === 'success') result[action].success[h] += count;
    else if (row.status === 'pending') result[action].pending[h] += count;
    else if (row.status === 'failed') result[action].failed[h] += count;
  }
  
  return result;
}

/**
 * Transform daily RPC data into aggregated arrays by action (days in month)
 */
function transformDaily(data: any[], daysInMonth: number): Record<string, AggregateData> {
  const result: Record<string, AggregateData> = {};
  
  for (const row of data) {
    const action = row.action;
    if (!result[action]) {
      result[action] = {
        log: Array(daysInMonth).fill(0),
        success: Array(daysInMonth).fill(0),
        pending: Array(daysInMonth).fill(0),
        failed: Array(daysInMonth).fill(0),
      };
    }
    
    const d = Number(row.day) - 1;
    const count = Number(row.count);
    result[action].log[d] += count;
    
    if (row.status === 'success') result[action].success[d] += count;
    else if (row.status === 'pending') result[action].pending[d] += count;
    else if (row.status === 'failed') result[action].failed[d] += count;
  }
  
  return result;
}

/**
 * Transform weekly RPC data into aggregated arrays by action (7 days)
 */
function transformWeekly(data: any[]): Record<string, AggregateData> {
  const result: Record<string, AggregateData> = {};
  
  for (const row of data) {
    const action = row.action;
    if (!result[action]) {
      result[action] = {
        log: Array(7).fill(0),
        success: Array(7).fill(0),
        pending: Array(7).fill(0),
        failed: Array(7).fill(0),
      };
    }
    
    const dayIndex = (Number(row.dow) + 6) % 7; // Sunday=0 → Monday=0
    const count = Number(row.count);
    result[action].log[dayIndex] += count;
    
    if (row.status === 'success') result[action].success[dayIndex] += count;
    else if (row.status === 'pending') result[action].pending[dayIndex] += count;
    else if (row.status === 'failed') result[action].failed[dayIndex] += count;
  }
  
  return result;
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Upsert aggregates into system_logs_summary table
 */
async function upsertAggregates(
  supabase: any,
  dimension: string,
  aggregates: Record<string, AggregateData>
) {
  const rows = Object.entries(aggregates).map(([action, counts]) => ({
    dimension,
    action,
    log_count: counts.log,
    success_count: counts.success,
    pending_count: counts.pending,
    failed_count: counts.failed,
  }));

  for (const row of rows) {
    const { data: existing } = await supabase
      .from('system_logs_summary')
      .select('id')
      .eq('dimension', row.dimension)
      .eq('action', row.action)
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('system_logs_summary')
        .update({
          log_count: row.log_count,
          success_count: row.success_count,
          pending_count: row.pending_count,
          failed_count: row.failed_count,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('system_logs_summary').insert(row);
    }
  }
}

/**
 * Process a single day: fetch RPC summaries and upsert aggregates
 */
async function processDayAggregates(
  supabase: any,
  currentDateStr: string,
  daysInMonth: number
) {
  // Fetch RPC summaries for this day
  const [hourlyData, dailyData, weeklyData] = await Promise.all([
    supabase.rpc('hourly_summary', { target_date: currentDateStr }),
    supabase.rpc('daily_summary', { target_date: currentDateStr }),
    supabase.rpc('weekly_summary', { target_date: currentDateStr }),
  ]);

  if (hourlyData.error || dailyData.error || weeklyData.error) {
    console.warn(`RPC error for ${currentDateStr}`);
    return;
  }

  // Transform RPC results
  const hourlyAggregates = transformHourly(hourlyData.data as any[]);
  const dailyAggregates = transformDaily(dailyData.data as any[], daysInMonth);
  const weeklyAggregates = transformWeekly(weeklyData.data as any[]);

  // Upsert to database
  const isoWeek = getISOWeek(currentDateStr);
  await Promise.all([
    upsertAggregates(supabase, `hourly|${currentDateStr}`, hourlyAggregates),
    upsertAggregates(supabase, `daily|${currentDateStr}`, dailyAggregates),
    upsertAggregates(supabase, `weekly|${isoWeek}`, weeklyAggregates),
  ]);
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

export async function POST(req: Request) {
  try {
    // Authentication
    const supabase = await createSupabaseServerClient();
    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Validate request body
    const body: RequestBody = await req.json();
    const targetDate = body.targetDate;
    if (!targetDate) {
      return NextResponse.json({ success: false, error: 'Missing targetDate' }, { status: 400 });
    }

    // Calculate month boundaries
    const dateObj = new Date(targetDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Process each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      const currentDateStr = currentDate.toISOString().split('T')[0];
      await processDayAggregates(supabase, currentDateStr, daysInMonth);
    }

    return NextResponse.json({ 
      status: 'success', 
      message: 'Monthly aggregation completed.' 
    });
  } catch (err: any) {
    console.error('Aggregation error:', err);
    return NextResponse.json({ 
      status: 'error', 
      message: err.message 
    });
  }
}