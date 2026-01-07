import { SupabaseClient } from '@supabase/supabase-js'
import { NormalizedAppointment, DateRange } from '../types'

/**
 * Contract that all booking software integrations must implement.
 * 
 * Responsibilities:
 * - OAuth token management (refresh if expired)
 * - Fetching raw appointments from external API
 * - Normalizing responses into NormalizedAppointment shape
 * 
 * NOT responsible for:
 * - Database writes (processors handle that)
 * - Client identity resolution (processors/clients.ts)
 * - Aggregations
 */
export interface BookingAdapter {
  /**
   * Identifier matching profiles.booking_software column
   */
  readonly name: string

  /**
   * Ensures valid access token, refreshing if expired.
   * 
   * @returns Valid access token
   * @throws Error if no connection found or refresh fails
   */
  ensureValidToken(supabase: SupabaseClient, userId: string): Promise<string>

  /**
   * Resolves which calendar/resource to pull appointments from.
   * 
   * @returns Calendar or resource ID
   * @throws Error if no matching calendar found
   */
  getCalendarId(
    accessToken: string,
    supabase: SupabaseClient,
    userId: string
  ): Promise<string>

  /**
   * Fetches and normalizes appointments from external API.
   * 
   * @returns Normalized appointments (filtered to exclude future dates)
   */
  fetchAppointments(
    accessToken: string,
    calendarId: string,
    dateRange: DateRange
  ): Promise<NormalizedAppointment[]>
}