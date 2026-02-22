// lib/nudge/calculateHolidaySensitivity.ts
// Calculate holiday sensitivity scores for clients based on historical booking behavior

import { SupabaseClient } from '@supabase/supabase-js'
import {
  Holiday,
  getPreviousYearHoliday,
  getHolidayDateRange,
} from './holidayCalendar'

/**
 * Result of holiday sensitivity calculation for a single client.
 */
export interface HolidaySensitivityResult {
  boost: number              // Score boost (0 or HOLIDAY_BOOST_AMOUNT)
  matchedLastYear: boolean   // Whether client had bookings during last year's holiday
  holidayCohort: string | null  // Holiday ID for tracking (e.g., 'march_break_2026')
}

/**
 * The score boost applied to clients with holiday sensitivity.
 * +50 points keeps easy-going (35+50=85) below consistent (195+).
 */
export const HOLIDAY_BOOST_AMOUNT = 50

/**
 * Buffer days to extend the holiday window when checking historical bookings.
 * ±14 days captures clients who may have booked slightly before/after the holiday.
 */
export const DEFAULT_BUFFER_DAYS = 14

/**
 * Calculate holiday sensitivity for a batch of clients.
 * Uses a single database query for efficiency (avoids N+1).
 * 
 * Checks if clients booked OR had appointments during the same holiday period last year.
 * 
 * @param supabase - Supabase client
 * @param clientIds - Array of client IDs to check
 * @param userId - User ID (barber) to scope the query
 * @param currentHoliday - The upcoming holiday to check sensitivity for
 * @param bufferDays - Days to extend the holiday window (default: 14)
 * @returns Map of client_id to HolidaySensitivityResult
 * 
 * @example
 * const sensitivityMap = await calculateHolidaySensitivityBatch(
 *   supabase,
 *   ['client-1', 'client-2', 'client-3'],
 *   'barber-user-id',
 *   marchBreak2026,
 *   14
 * )
 * // sensitivityMap.get('client-1') => { boost: 50, matchedLastYear: true, holidayCohort: 'march_break_2026' }
 */
export async function calculateHolidaySensitivityBatch(
  supabase: SupabaseClient,
  clientIds: string[],
  userId: string,
  currentHoliday: Holiday,
  bufferDays: number = DEFAULT_BUFFER_DAYS
): Promise<Map<string, HolidaySensitivityResult>> {
  const results = new Map<string, HolidaySensitivityResult>()

  // Initialize all clients with no boost
  for (const clientId of clientIds) {
    results.set(clientId, {
      boost: 0,
      matchedLastYear: false,
      holidayCohort: null,
    })
  }

  // Get previous year's equivalent holiday
  const previousHoliday = getPreviousYearHoliday(currentHoliday)
  
  if (!previousHoliday) {
    // No previous year data to compare against
    console.log(`[HolidaySensitivity] No previous year holiday found for ${currentHoliday.id}`)
    return results
  }

  // Get the date range for last year's holiday with buffer
  const { startDate, endDate } = getHolidayDateRange(previousHoliday, bufferDays)

  console.log(`[HolidaySensitivity] Checking ${clientIds.length} clients for bookings during ${previousHoliday.id} (${startDate} to ${endDate})`)

  try {
    // Query appointments for all clients during last year's holiday window
    // Check BOTH appointment_datecreated (when booked) AND datetime (appointment date)
    // Using appointment_date for simpler date comparison (YYYY-MM-DD format)
    const { data: appointments, error } = await supabase
      .from('acuity_appointments')
      .select('client_id, appointment_date, appointment_datecreated')
      .eq('user_id', userId)
      .in('client_id', clientIds)
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate)

    if (error) {
      console.error('[HolidaySensitivity] Error querying appointments:', error)
      return results
    }

    // Also check appointments where the BOOKING was made during the holiday window
    // (even if the appointment itself was scheduled for later)
    const { data: bookedDuringHoliday, error: bookedError } = await supabase
      .from('acuity_appointments')
      .select('client_id, appointment_date, appointment_datecreated')
      .eq('user_id', userId)
      .in('client_id', clientIds)
      .gte('appointment_datecreated', `${startDate}T00:00:00`)
      .lte('appointment_datecreated', `${endDate}T23:59:59`)

    if (bookedError) {
      console.error('[HolidaySensitivity] Error querying booked appointments:', bookedError)
      // Continue with what we have from the first query
    }

    // Combine results and find unique client IDs with holiday activity
    const clientsWithHolidayActivity = new Set<string>()

    if (appointments) {
      for (const appt of appointments) {
        if (appt.client_id) {
          clientsWithHolidayActivity.add(appt.client_id)
        }
      }
    }

    if (bookedDuringHoliday) {
      for (const appt of bookedDuringHoliday) {
        if (appt.client_id) {
          clientsWithHolidayActivity.add(appt.client_id)
        }
      }
    }

    // Apply boost to clients with holiday activity
    for (const clientId of clientsWithHolidayActivity) {
      results.set(clientId, {
        boost: HOLIDAY_BOOST_AMOUNT,
        matchedLastYear: true,
        holidayCohort: currentHoliday.id,
      })
    }

    const boostedCount = clientsWithHolidayActivity.size
    console.log(`[HolidaySensitivity] Applied +${HOLIDAY_BOOST_AMOUNT} boost to ${boostedCount}/${clientIds.length} clients with ${previousHoliday.name} ${previousHoliday.year} activity`)

    return results

  } catch (err) {
    console.error('[HolidaySensitivity] Unexpected error:', err)
    return results
  }
}

/**
 * Calculate holiday sensitivity for a single client.
 * Prefer using calculateHolidaySensitivityBatch for multiple clients.
 * 
 * @param supabase - Supabase client
 * @param clientId - Client ID to check
 * @param userId - User ID (barber) to scope the query
 * @param currentHoliday - The upcoming holiday to check sensitivity for
 * @param bufferDays - Days to extend the holiday window (default: 14)
 * @returns HolidaySensitivityResult for the client
 */
export async function calculateHolidaySensitivity(
  supabase: SupabaseClient,
  clientId: string,
  userId: string,
  currentHoliday: Holiday,
  bufferDays: number = DEFAULT_BUFFER_DAYS
): Promise<HolidaySensitivityResult> {
  const results = await calculateHolidaySensitivityBatch(
    supabase,
    [clientId],
    userId,
    currentHoliday,
    bufferDays
  )

  return results.get(clientId) || {
    boost: 0,
    matchedLastYear: false,
    holidayCohort: null,
  }
}
