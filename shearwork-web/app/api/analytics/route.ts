/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';

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

    // -----------------------
    // 1. Fetch all aggregations via RPC
    // -----------------------
    const [hourlyData, dailyData, weeklyData] = await Promise.all([
      supabase.rpc('hourly_summary', { target_date: targetDate }),
      supabase.rpc('daily_summary', { target_date: targetDate }),
      supabase.rpc('weekly_summary', { target_date: targetDate }),
    ]);

    if (hourlyData.error || dailyData.error || weeklyData.error) {
      throw new Error(
        `RPC Error: ${hourlyData.error?.message || dailyData.error?.message || weeklyData.error?.message}`
      );
    }

    // -----------------------
    // 2. Transform into arrays
    // -----------------------
    function transformHourly(data: any[]) {
      const result: Record<string, any> = {};
      for (const row of data) {
        const action = row.action;
        if (!result[action]) result[action] = { log: Array(24).fill(0), success: Array(24).fill(0), pending: Array(24).fill(0), failed: Array(24).fill(0) };
        const h = Number(row.hour);
        const count = Number(row.count);
        result[action].log[h] += count;
        if (row.status === 'success') result[action].success[h] += count;
        else if (row.status === 'pending') result[action].pending[h] += count;
        else if (row.status === 'failed') result[action].failed[h] += count;
      }
      return result;
    }

    function transformDaily(data: any[], daysInMonth: number) {
      const result: Record<string, any> = {};
      for (const row of data) {
        const action = row.action;
        if (!result[action]) result[action] = { log: Array(daysInMonth).fill(0), success: Array(daysInMonth).fill(0), pending: Array(daysInMonth).fill(0), failed: Array(daysInMonth).fill(0) };
        const d = Number(row.day) - 1;
        const count = Number(row.count);
        result[action].log[d] += count;
        if (row.status === 'success') result[action].success[d] += count;
        else if (row.status === 'pending') result[action].pending[d] += count;
        else if (row.status === 'failed') result[action].failed[d] += count;
      }
      return result;
    }

    function transformWeekly(data: any[]) {
      const result: Record<string, any> = {};
      for (const row of data) {
        const action = row.action;
        if (!result[action]) result[action] = { log: Array(7).fill(0), success: Array(7).fill(0), pending: Array(7).fill(0), failed: Array(7).fill(0) };
        const dayIndex = (Number(row.dow) + 6) % 7; // Sunday=0 → Monday=0
        const count = Number(row.count);
        result[action].log[dayIndex] += count;
        if (row.status === 'success') result[action].success[dayIndex] += count;
        else if (row.status === 'pending') result[action].pending[dayIndex] += count;
        else if (row.status === 'failed') result[action].failed[dayIndex] += count;
      }
      return result;
    }

    const hourlyAggregates = transformHourly(hourlyData.data as any[]);
    const daysInMonth = new Date(targetDate).getMonth() + 1 === 2
      ? 28
      : [4, 6, 9, 11].includes(new Date(targetDate).getMonth() + 1)
        ? 30
        : 31;
    const dailyAggregates = transformDaily(dailyData.data as any[], daysInMonth);
    const weeklyAggregates = transformWeekly(weeklyData.data as any[]);

    // -----------------------
    // 3. Upsert summaries in bulk
    // -----------------------
    async function upsertAggregates(dimension: string, aggregates: Record<string, any>) {
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

    await Promise.all([
      upsertAggregates(`hourly|${targetDate}`, hourlyAggregates),
      upsertAggregates(`daily|${targetDate}`, dailyAggregates),
      upsertAggregates(`weekly|${targetDate}`, weeklyAggregates),
    ]);

    return NextResponse.json({ status: 'success' });
  } catch (err: any) {
    console.error('Aggregation error:', err);
    return NextResponse.json({ status: 'error', message: err.message });
  }
}
