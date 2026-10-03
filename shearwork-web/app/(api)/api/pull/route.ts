// app/api/pull/route.ts
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { pull } from '@/lib/booking/orchestrator'
import { PullOptions, Month, MONTHS } from '@/lib/booking/types'
import { isFinalAttempt, isQStashDelivery } from '@/lib/booking/syncQueue'

const serviceSupabase = createSupabaseAdminClient()

/**
 * New modular pull endpoint.
 * 
 * Query parameters:
 * - month: string (e.g., 'January', 'February')
 * - year: number (e.g., 2025)
 * - granularity: 'day' | 'week' | 'month' | 'quarter' | 'year' (default: 'month')
 * - quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' (for quarter granularity)
 * - weekNumber: number (for week granularity)
 * - day: number (for day granularity)
 * - dryRun: boolean (if true, don't write to database)
 * - skipAggregations: boolean (if true, skip aggregation processors)
 * 
 * Examples:
 * - /api/pull?month=January&year=2025
 * - /api/pull?granularity=quarter&year=2025&quarter=Q1
 * - /api/pull?granularity=day&month=January&year=2025&day=15
 * - /api/pull?month=January&year=2025&dryRun=true
 */
export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  // Parse parameters
  const granularity = (searchParams.get('granularity') || 'month') as PullOptions['granularity']
  const yearStr = searchParams.get('year')
  const month = searchParams.get('month') as Month | null
  const quarter = searchParams.get('quarter') as 'Q1' | 'Q2' | 'Q3' | 'Q4' | null
  const weekNumberStr = searchParams.get('weekNumber')
  const dayStr = searchParams.get('day')
  const dryRun = searchParams.get('dryRun') === 'true'
  const skipAggregations = searchParams.get('skipAggregations') === 'true'

  // Validate year
  if (!yearStr) {
    return NextResponse.json({ error: 'year parameter is required' }, { status: 400 })
  }
  const year = parseInt(yearStr, 10)
  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
  }

  // Validate month if provided
  if (month && !MONTHS.includes(month)) {
    return NextResponse.json({ 
      error: `Invalid month: ${month}. Must be one of: ${MONTHS.join(', ')}` 
    }, { status: 400 })
  }

  // Validate granularity-specific requirements
  if (granularity === 'month' && !month) {
    return NextResponse.json({ error: 'month parameter is required for month granularity' }, { status: 400 })
  }

  if (granularity === 'quarter' && !quarter) {
    return NextResponse.json({ error: 'quarter parameter is required for quarter granularity' }, { status: 400 })
  }

  if (granularity === 'week' && (!month || !weekNumberStr)) {
    return NextResponse.json({ error: 'month and weekNumber parameters are required for week granularity' }, { status: 400 })
  }

  if (granularity === 'day' && (!month || !dayStr)) {
    return NextResponse.json({ error: 'month and day parameters are required for day granularity' }, { status: 400 })
  }

  // Build PullOptions
  const options: PullOptions = {
    granularity,
    year,
  }

  if (month) options.month = month
  if (quarter) options.quarter = quarter
  if (weekNumberStr) options.weekNumber = parseInt(weekNumberStr, 10)
  if (dayStr) options.day = parseInt(dayStr, 10)

  // sync_status bookkeeping applies to real (non dry-run) single-month pulls
  const trackStatus = granularity === 'month' && Boolean(month) && !dryRun
  const statusKey = { user_id: user.id, month: month as string, year }
  const previousStatus = trackStatus ? await markProcessing(statusKey) : null

  // Run the pull
  try {
    const result = await pull(supabase, user.id, options, {
      tablePrefix: dryRun ? 'test_' : '',
      dryRun,
      skipAggregations,
    })

    // A source failed (Acuity/Square error after retries). Report a non-2xx so a
    // queued sync is retried by QStash instead of being marked complete with gaps.
    const sourceErrors = (result.errors ?? []).filter(e => e !== 'No booking sources connected')
    if (sourceErrors.length > 0) {
      if (trackStatus) {
        const final = !isQStashDelivery(request) || isFinalAttempt(request)
        await setStatus(statusKey, final ? 'failed' : 'retrying', sourceErrors.join('; '))
      }
      return NextResponse.json({ endpoint: 'pull', options, error: 'Pull failed', result }, { status: 502 })
    }

    if (trackStatus) {
      await setStatus(statusKey, 'completed', null)
      if (previousStatus !== 'completed') await notifyIfHistoryComplete(user.id)
    }

    return NextResponse.json({
      endpoint: 'pull',
      options,
      dryRun,
      skipAggregations,
      result,
    })
  } catch (err) {
    console.error('Pull error:', err)
    if (trackStatus) {
      const final = !isQStashDelivery(request) || isFinalAttempt(request)
      await setStatus(statusKey, final ? 'failed' : 'retrying', String(err))
    }
    return NextResponse.json({
      error: 'Pull failed',
      details: String(err),
    }, { status: 500 })
  }
}
type StatusKey = { user_id: string; month: string; year: number }

/** Marks the month as processing and returns the status it had before. */
async function markProcessing(key: StatusKey): Promise<string | null> {
  const { data } = await serviceSupabase
    .from('sync_status')
    .select('status')
    .eq('user_id', key.user_id)
    .eq('month', key.month)
    .eq('year', key.year)
    .maybeSingle()

  if (data && data.status !== 'completed') {
    await serviceSupabase
      .from('sync_status')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('user_id', key.user_id)
      .eq('month', key.month)
      .eq('year', key.year)
  }
  return data?.status ?? null
}

async function setStatus(key: StatusKey, status: 'completed' | 'retrying' | 'failed', errorMessage: string | null) {
  const { error } = await serviceSupabase
    .from('sync_status')
    .upsert(
      { ...key, status, error_message: errorMessage?.slice(0, 1000) ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,month,year' },
    )
  if (error) console.error('[pull] failed to update sync_status:', error)
}

/** After a backlog month finishes: tell the barber once every queued month is done. */
async function notifyIfHistoryComplete(userId: string) {
  const { count } = await serviceSupabase
    .from('sync_status')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'completed')

  if (count !== 0) return

  const { error } = await serviceSupabase.from('notifications').insert({
    user_id: userId,
    header: 'Acuity data fully synced',
    message: 'Your data from Acuity has been completely synced. Please refresh to see the latest data.',
    reference_type: 'sync_completed',
  })
  if (error) console.error('[pull] failed to send sync notification:', error)
}
