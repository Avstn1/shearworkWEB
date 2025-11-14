/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { cookies } from 'next/headers';
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  getHours,
  getDate,
  getISOWeek,
  parseISO,
} from 'date-fns';

interface RequestBody {
  targetDate: string; // 'YYYY-MM-DD'
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const authHeader = req.headers.get('authorization');

    if (!authHeader || authHeader !== `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body: RequestBody = await req.json();
    const targetDate = body.targetDate;
    if (!targetDate) return NextResponse.json({ success: false, error: 'Missing targetDate' }, { status: 400 });

    const now = new Date()

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
    }

    return NextResponse.json({ status: 'success' });
  } catch (err: any) {
    console.error('Unexpected error in appointments route:', err);
    return NextResponse.json({ status: 'error', message: err.message });
  }
}
