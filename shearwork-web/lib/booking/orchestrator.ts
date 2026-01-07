// lib/booking/orchestrator.ts

import { SupabaseClient } from '@supabase/supabase-js'
import {
  PullOptions,
  PullResult,
  DateRange,
  Month,
  MONTHS,
  AggregationResult,
} from './types'
import { getBookingAdapter } from './adapters'
import { ClientProcessor } from './processors/clients'
import { AppointmentProcessor } from './processors/appointments'

// ======================== DATE RANGE HELPERS ========================

/**
 * Converts PullOptions to a DateRange for fetching appointments.
 */
export function pullOptionsToDateRange(options: PullOptions): DateRange {
  const { granularity, year, quarter, month, weekNumber, day } = options

  switch (granularity) {
    case 'year': {
      return {
        startISO: `${year}-01-01`,
        endISO: `${year}-12-31`,
      }
    }

    case 'quarter': {
      const quarterMap: Record<string, { start: string; end: string }> = {
        Q1: { start: `${year}-01-01`, end: `${year}-03-31` },
        Q2: { start: `${year}-04-01`, end: `${year}-06-30` },
        Q3: { start: `${year}-07-01`, end: `${year}-09-30` },
        Q4: { start: `${year}-10-01`, end: `${year}-12-31` },
      }
      const q = quarterMap[quarter || 'Q1']
      return { startISO: q.start, endISO: q.end }
    }

    case 'month': {
      const monthIndex = MONTHS.indexOf(month as Month)
      if (monthIndex === -1) {
        throw new Error(`Invalid month: ${month}`)
      }
      const startDate = new Date(year, monthIndex, 1)
      const endDate = new Date(year, monthIndex + 1, 0) // Last day of month
      return {
        startISO: formatDate(startDate),
        endISO: formatDate(endDate),
      }
    }

    case 'week': {
      if (!month || !weekNumber) {
        throw new Error('Week granularity requires month and weekNumber')
      }
      const monthIndex = MONTHS.indexOf(month as Month)
      if (monthIndex === -1) {
        throw new Error(`Invalid month: ${month}`)
      }
      // Find the first Monday of the month
      const firstOfMonth = new Date(year, monthIndex, 1)
      const firstMonday = getFirstMondayOfMonth(firstOfMonth)
      
      // Calculate the start of the requested week
      const weekStart = new Date(firstMonday)
      weekStart.setDate(firstMonday.getDate() + (weekNumber - 1) * 7)
      
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      
      return {
        startISO: formatDate(weekStart),
        endISO: formatDate(weekEnd),
      }
    }

    case 'day': {
      if (!month || !day) {
        throw new Error('Day granularity requires month and day')
      }
      const monthIndex = MONTHS.indexOf(month as Month)
      if (monthIndex === -1) {
        throw new Error(`Invalid month: ${month}`)
      }
      const date = new Date(year, monthIndex, day)
      const dateStr = formatDate(date)
      return {
        startISO: dateStr,
        endISO: dateStr,
      }
    }

    default:
      throw new Error(`Unknown granularity: ${granularity}`)
  }
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getFirstMondayOfMonth(date: Date): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const dayOfWeek = first.getDay()
  // If Sunday (0), add 1 day. Otherwise, add days until Monday.
  const daysToAdd = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek
  const monday = new Date(first)
  monday.setDate(first.getDate() + daysToAdd)
  return monday
}

// ======================== ORCHESTRATOR OPTIONS ========================

export interface OrchestratorOptions {
  /** Table prefix for testing (e.g., 'test_' uses test tables) */
  tablePrefix?: string
  /** Skip aggregations (useful for testing) */
  skipAggregations?: boolean
  /** Dry run - don't write to database */
  dryRun?: boolean
}

// ======================== MAIN ORCHESTRATOR ========================

/**
 * Orchestrates the entire pull flow:
 * 1. Fetch appointments from booking software
 * 2. Resolve clients (identity matching)
 * 3. Upsert clients to database
 * 4. Upsert appointments to database
 * 5. Run aggregations (daily, weekly, monthly)
 */
export async function pull(
  supabase: SupabaseClient,
  userId: string,
  options: PullOptions,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<PullResult> {
  const { tablePrefix = '', skipAggregations = false, dryRun = false } = orchestratorOptions
  const errors: string[] = []
  const aggregations: AggregationResult[] = []

  const fetchedAt = new Date().toISOString()

  try {
    // ======================== STEP 1: GET ADAPTER ========================

    // Get the user's booking software from profile
    // Note: booking_software column may not exist in all deployments, default to 'acuity'
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('calendar')
      .eq('user_id', userId)
      .single()

    if (profileError || !profile) {
      throw new Error(`No profile found for user: ${profileError?.message || 'unknown error'}`)
    }

    // Default to 'acuity' - can be extended to support multiple booking providers
    const bookingSoftware = 'acuity'
    const adapter = getBookingAdapter(bookingSoftware)

    // ======================== STEP 2: FETCH APPOINTMENTS ========================

    const accessToken = await adapter.ensureValidToken(supabase, userId)
    const calendarId = await adapter.getCalendarId(accessToken, supabase, userId)
    const dateRange = pullOptionsToDateRange(options)

    const appointments = await adapter.fetchAppointments(accessToken, calendarId, dateRange)

    // ======================== STEP 3: PROCESS CLIENTS ========================

    const clientProcessor = new ClientProcessor(supabase, userId, { tablePrefix })
    const clientResolution = await clientProcessor.resolve(appointments)

    let clientResult = {
      totalProcessed: clientResolution.clients.size,
      newClients: clientResolution.newClientIds.size,
      existingClients: clientResolution.clients.size - clientResolution.newClientIds.size,
      mergedClients: 0,
    }

    if (!dryRun) {
      clientResult = await clientProcessor.upsert()
    }

    // ======================== STEP 4: PROCESS APPOINTMENTS ========================

    const appointmentProcessor = new AppointmentProcessor(supabase, userId, { tablePrefix })
    appointmentProcessor.process(appointments, clientResolution)

    let appointmentResult = {
      totalProcessed: appointmentProcessor.getUpsertPayload().length,
      inserted: 0,
      updated: 0,
      skippedNoClient: appointmentProcessor.getSkippedCount(),
      revenuePreserved: 0,
    }

    if (!dryRun) {
      appointmentResult = await appointmentProcessor.upsert()
    }

    // ======================== STEP 5: RUN AGGREGATIONS ========================

    if (!skipAggregations && !dryRun) {
      // TODO: Aggregations will be implemented by teammate
      // Example structure:
      // try {
      //   const dailyResult = await runDailyAggregation(supabase, userId, options, tablePrefix)
      //   aggregations.push(dailyResult)
      // } catch (err) {
      //   errors.push(`Daily aggregation failed: ${err}`)
      // }
      //
      // try {
      //   const weeklyResult = await runWeeklyAggregation(supabase, userId, options, tablePrefix)
      //   aggregations.push(weeklyResult)
      // } catch (err) {
      //   errors.push(`Weekly aggregation failed: ${err}`)
      // }
      //
      // try {
      //   const monthlyResult = await runMonthlyAggregation(supabase, userId, options, tablePrefix)
      //   aggregations.push(monthlyResult)
      // } catch (err) {
      //   errors.push(`Monthly aggregation failed: ${err}`)
      // }
    }

    // ======================== RETURN RESULT ========================

    return {
      success: errors.length === 0,
      fetchedAt,
      appointmentCount: appointments.length,
      clients: clientResult,
      appointments: {
        totalProcessed: appointmentResult.totalProcessed,
        inserted: appointmentResult.inserted,
        updated: appointmentResult.updated,
        skipped: appointmentResult.skippedNoClient,
      },
      aggregations,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (err) {
    return {
      success: false,
      fetchedAt,
      appointmentCount: 0,
      clients: {
        totalProcessed: 0,
        newClients: 0,
        existingClients: 0,
        mergedClients: 0,
      },
      appointments: {
        totalProcessed: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
      },
      aggregations: [],
      errors: [String(err)],
    }
  }
}

// ======================== CONVENIENCE FUNCTIONS ========================

/**
 * Pull a single month of data.
 */
export async function pullMonth(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: Month,
  orchestratorOptions?: OrchestratorOptions
): Promise<PullResult> {
  return pull(
    supabase,
    userId,
    { granularity: 'month', year, month },
    orchestratorOptions
  )
}

/**
 * Pull a single day of data.
 */
export async function pullDay(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: Month,
  day: number,
  orchestratorOptions?: OrchestratorOptions
): Promise<PullResult> {
  return pull(
    supabase,
    userId,
    { granularity: 'day', year, month, day },
    orchestratorOptions
  )
}

/**
 * Pull a quarter of data.
 */
export async function pullQuarter(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4',
  orchestratorOptions?: OrchestratorOptions
): Promise<PullResult> {
  return pull(
    supabase,
    userId,
    { granularity: 'quarter', year, quarter },
    orchestratorOptions
  )
}

/**
 * Pull an entire year of data.
 */
export async function pullYear(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  orchestratorOptions?: OrchestratorOptions
): Promise<PullResult> {
  return pull(
    supabase,
    userId,
    { granularity: 'year', year },
    orchestratorOptions
  )
}