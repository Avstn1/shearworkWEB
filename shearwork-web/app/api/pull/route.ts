// app/api/pull/route.ts

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { pull } from '@/lib/booking/orchestrator'
import { PullOptions, Month, MONTHS } from '@/lib/booking/types'

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

  // Run the pull
  try {
    const result = await pull(supabase, user.id, options, {
      dryRun,
      skipAggregations,
    })

    return NextResponse.json({
      endpoint: 'pull',
      options,
      dryRun,
      skipAggregations,
      result,
    })
  } catch (err) {
    console.error('Pull error:', err)
    return NextResponse.json({
      error: 'Pull failed',
      details: String(err),
    }, { status: 500 })
  }
}