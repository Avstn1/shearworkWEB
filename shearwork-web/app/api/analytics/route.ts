/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  getHours,
  getDate,
  getDaysInMonth,
  getISOWeek,
  parseISO
} from 'date-fns';

interface RequestBody {
  targetDate: string; // expected format: 'YYYY-MM-DD'
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { targetDate } = body;

    if (!targetDate) {
      return NextResponse.json({ status: 'error', message: 'targetDate is required' });
    }

    const supabase = createRouteHandlerClient({ cookies: async () => cookies() });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.warn('No logged-in user found.');
      return NextResponse.json({ data: [] });
    }

    // -------------------------------
    // Target date adjusted -5 hours
    // -------------------------------
    const rawDate = parseISO(targetDate);
    const now = new Date(rawDate.getTime() - 5 * 60 * 60 * 1000);

    const currentHour = getHours(now);
    const currentDay = getDate(now);
    const currentMonthDays = getDaysInMonth(now);
    const currentWeekNumber = getISOWeek(now);

    const generateEmptyArray = (length: number) => Array.from({ length }, () => 0);

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
    const hourlyLength = 24;

    const { data: hourlyLogs } = await supabase
      .from('system_logs')
      .select('*')
      .gte('timestamp', startOfDay(now).toISOString())
      .lte('timestamp', new Date(startOfDay(now).getTime() + 23 * 60 * 60 + 59 * 60 + 59).toISOString()); // full day

    const hourlyAggregates: Record<string, { log: number[]; success: number[]; pending: number[]; failed: number[] }> = {};

    for (const log of (hourlyLogs as any[]) || []) {
      if (!hourlyAggregates[log.action]) {
        hourlyAggregates[log.action] = {
          log: generateEmptyArray(hourlyLength),
          success: generateEmptyArray(hourlyLength),
          pending: generateEmptyArray(hourlyLength),
          failed: generateEmptyArray(hourlyLength),
        };
      }
      const hour = new Date(log.timestamp).getHours();
      hourlyAggregates[log.action].log[hour]++;
      if (log.status === 'success') hourlyAggregates[log.action].success[hour]++;
      else if (log.status === 'pending') hourlyAggregates[log.action].pending[hour]++;
      else if (log.status === 'failed') hourlyAggregates[log.action].failed[hour]++;
    }

    // If no logs for an action, still create 0-filled arrays
    if (Object.keys(hourlyAggregates).length === 0) {
      hourlyAggregates['no_logs'] = {
        log: generateEmptyArray(hourlyLength),
        success: generateEmptyArray(hourlyLength),
        pending: generateEmptyArray(hourlyLength),
        failed: generateEmptyArray(hourlyLength),
      };
    }

    for (const [action, counts] of Object.entries(hourlyAggregates)) {
      await upsertSummary(hourlyDimension, action, hourlyLength, counts.log, counts.success, counts.pending, counts.failed);
    }

    // -------------------------------
    // 2. Daily summary for the month of targetDate
    // -------------------------------
    const dailyDimension = `daily|${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    const dailyLength = currentMonthDays;

    const { data: dailyLogs } = await supabase
      .from('system_logs')
      .select('*')
      .gte('timestamp', startOfMonth(now).toISOString())
      .lte('timestamp', new Date(startOfMonth(now).getTime() + (currentMonthDays - 1) * 24 * 60 * 60 * 1000 + 23*60*60 + 59*60 +59).toISOString());

    const dailyAggregates: Record<string, { log: number[]; success: number[]; pending: number[]; failed: number[] }> = {};

    for (const log of (dailyLogs as any[]) || []) {
      if (!dailyAggregates[log.action]) {
        dailyAggregates[log.action] = {
          log: generateEmptyArray(dailyLength),
          success: generateEmptyArray(dailyLength),
          pending: generateEmptyArray(dailyLength),
          failed: generateEmptyArray(dailyLength),
        };
      }
      const dayIndex = new Date(log.timestamp).getDate() - 1;
      dailyAggregates[log.action].log[dayIndex]++;
      if (log.status === 'success') dailyAggregates[log.action].success[dayIndex]++;
      else if (log.status === 'pending') dailyAggregates[log.action].pending[dayIndex]++;
      else if (log.status === 'failed') dailyAggregates[log.action].failed[dayIndex]++;
    }

    if (Object.keys(dailyAggregates).length === 0) {
      dailyAggregates['no_logs'] = {
        log: generateEmptyArray(dailyLength),
        success: generateEmptyArray(dailyLength),
        pending: generateEmptyArray(dailyLength),
        failed: generateEmptyArray(dailyLength),
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
    const weeklyLength = 7;

    const { data: weeklyLogs } = await supabase
      .from('system_logs')
      .select('*')
      .gte('timestamp', weekStart.toISOString())
      .lte('timestamp', new Date(weekStart.getTime() + 6 * 24*60*60*1000 + 23*60*60 + 59*60 +59).toISOString());

    const weeklyAggregates: Record<string, { log: number[]; success: number[]; pending: number[]; failed: number[] }> = {};

    for (const log of (weeklyLogs as any[]) || []) {
      if (!weeklyAggregates[log.action]) {
        weeklyAggregates[log.action] = {
          log: generateEmptyArray(weeklyLength),
          success: generateEmptyArray(weeklyLength),
          pending: generateEmptyArray(weeklyLength),
          failed: generateEmptyArray(weeklyLength),
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
        log: generateEmptyArray(weeklyLength),
        success: generateEmptyArray(weeklyLength),
        pending: generateEmptyArray(weeklyLength),
        failed: generateEmptyArray(weeklyLength),
      };
    }

    for (const [action, counts] of Object.entries(weeklyAggregates)) {
      await upsertSummary(weeklyDimension, action, weeklyLength, counts.log, counts.success, counts.pending, counts.failed);
    }

    return NextResponse.json({ status: 'success' });
  } catch (err: any) {
    console.error('Unexpected error in appointments route:', err);
    return NextResponse.json({ status: 'error', message: err.message });
  }
}
