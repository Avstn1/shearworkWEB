// lib/booking/types.ts

import { SupabaseClient } from '@supabase/supabase-js'

// ======================== CONSTANTS ========================

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

export type Month = typeof MONTHS[number]

// ======================== PULL OPTIONS ========================

export type PullGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year'

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

/**
 * Options for pulling appointment data.
 * 
 * @example
 * // Pull entire year
 * { granularity: 'year', year: 2025 }
 * 
 * // Pull Q1
 * { granularity: 'quarter', year: 2025, quarter: 'Q1' }
 * 
 * // Pull single month
 * { granularity: 'month', year: 2025, month: 'January' }
 * 
 * // Pull specific week
 * { granularity: 'week', year: 2025, month: 'January', weekNumber: 2 }
 * 
 * // Pull single day
 * { granularity: 'day', year: 2025, month: 'January', day: 15 }
 */
export interface PullOptions {
  granularity: PullGranularity
  year: number                          // e.g., 2025
  quarter?: Quarter                     // e.g., 'Q1', 'Q2', 'Q3', 'Q4'
  month?: Month                         // e.g., 'January', 'February'
  weekNumber?: number                   // e.g., 1, 2, 3, 4, 5
  day?: number                          // e.g., 1-31
}

/**
 * Date range for fetching appointments.
 * 
 * @example
 * { startISO: '2025-01-01', endISO: '2025-01-31' }
 */
export interface DateRange {
  startISO: string                      // e.g., '2025-01-01'
  endISO: string                        // e.g., '2025-01-31'
}

// ======================== NORMALIZED DATA ========================

/**
 * Canonical appointment shape produced by all booking adapters.
 * Processors only work with this type, never raw API responses.
 * 
 * @example
 * {
 *   externalId: '1390866002',
 *   datetime: '2025-01-03T19:00:00-0500',
 *   date: '2025-01-03',
 *   email: 'john@example.com',
 *   phone: '(416) 555-1234',
 *   phoneNormalized: '+14165551234',
 *   firstName: 'John',
 *   lastName: 'Smith',
 *   serviceType: 'Haircut & Beard',
 *   price: 55.00,
 *   tip: 10.00,
 *   notes: 'Prefers scissors over clippers',
 *   referralSource: 'Instagram',
 *   forms: [{ id: 123, values: [...] }]
 * }
 */
export interface NormalizedAppointment {
  externalId: string                    // e.g., '1390866002' (Acuity appointment ID)
  datetime: string                      // e.g., '2025-01-03T19:00:00-0500' (ISO with timezone)
  date: string                          // e.g., '2025-01-03' (YYYY-MM-DD)
  
  email: string | null                  // e.g., 'john@example.com' (lowercase, trimmed)
  phone: string | null                  // e.g., '(416) 555-1234' (raw from API)
  phoneNormalized: string | null        // e.g., '+14165551234' (E.164 format)
  firstName: string | null              // e.g., 'John'
  lastName: string | null               // e.g., 'Smith'
  
  serviceType: string | null            // e.g., 'Haircut & Beard'
  price: number                         // e.g., 55.00 (parsed from priceSold)
  tip: number                           // e.g., 10.00
  notes: string | null                  // e.g., 'Prefers scissors over clippers'
  
  referralSource: string | null         // e.g., 'Instagram', 'Google', 'Walk-in'
  forms?: any[]                         // Raw forms data for additional processing
}

/**
 * Canonical client shape after identity resolution.
 * 
 * @example
 * {
 *   clientId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
 *   email: 'john@example.com',
 *   phoneNormalized: '+14165551234',
 *   firstName: 'John',
 *   lastName: 'Smith',
 *   firstAppt: '2024-06-15',
 *   secondAppt: '2024-07-20',
 *   lastAppt: '2025-01-03',
 *   firstSource: 'Instagram'
 * }
 */
export interface NormalizedClient {
  clientId: string                      // e.g., 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' (UUID)
  email: string | null                  // e.g., 'john@example.com' (lowercase)
  phoneNormalized: string | null        // e.g., '+14165551234' (E.164 format)
  firstName: string | null              // e.g., 'John' (trimmed)
  lastName: string | null               // e.g., 'Smith' (trimmed)
  firstAppt: string                     // e.g., '2024-06-15' (YYYY-MM-DD, earliest appointment)
  secondAppt: string | null             // e.g., '2024-07-20' (YYYY-MM-DD, second chronological appointment, used for marketing funnels)
  lastAppt: string                      // e.g., '2025-01-03' (YYYY-MM-DD, most recent appointment)
  firstSource: string | null            // e.g., 'Instagram' (from first appointment)
}

// ======================== CONTEXT ========================

/**
 * Context passed through the orchestrator to all processors.
 * 
 * @example
 * {
 *   userId: 'user-uuid-here',
 *   supabase: supabaseClient,
 *   options: { granularity: 'month', year: 2025, month: 'January' }
 * }
 */
export interface PullContext {
  userId: string                        // e.g., 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  supabase: SupabaseClient
  options: PullOptions
}

// ======================== PROCESSOR RESULTS ========================

/**
 * Result from client identity resolution.
 * Maps appointments to clients and tracks new vs existing.
 * 
 * @example
 * {
 *   appointmentToClient: Map { '1390866002' => 'client-uuid-1', '1390866003' => 'client-uuid-1' },
 *   clients: Map { 'client-uuid-1' => { clientId: '...', email: '...', ... } },
 *   newClientIds: Set { 'client-uuid-2', 'client-uuid-3' }
 * }
 */
export interface ClientResolutionResult {
  appointmentToClient: Map<string, string>        // externalAppointmentId → clientId
  clients: Map<string, NormalizedClient>          // clientId → NormalizedClient
  newClientIds: Set<string>                       // clientIds that are brand new
}

/**
 * Statistics from client processor.
 * 
 * @example
 * { totalProcessed: 45, newClients: 12, existingClients: 33, mergedClients: 2 }
 */
export interface ClientProcessorResult {
  totalProcessed: number                // e.g., 45 (total unique clients)
  newClients: number                    // e.g., 12 (first-time clients)
  existingClients: number               // e.g., 33 (returning clients)
  mergedClients: number                 // e.g., 2 (duplicates that were unified)
}

/**
 * Statistics from appointment processor.
 * 
 * @example
 * { totalProcessed: 150, inserted: 25, updated: 120, skipped: 5 }
 */
export interface AppointmentProcessorResult {
  totalProcessed: number                // e.g., 150 (total appointments)
  inserted: number                      // e.g., 25 (new appointments)
  updated: number                       // e.g., 120 (existing appointments updated)
  skipped: number                       // e.g., 5 (filtered out, e.g., cancelled)
}

/**
 * Result from a single aggregation processor.
 * 
 * @example
 * { table: 'daily_data', rowsUpserted: 31 }
 */
export interface AggregationResult {
  table: string                         // e.g., 'daily_data', 'weekly_data', 'monthly_data'
  rowsUpserted: number                  // e.g., 31
}

/**
 * Final result from the entire pull operation.
 * 
 * @example
 * {
 *   success: true,
 *   fetchedAt: '2025-01-07T15:30:00.000Z',
 *   appointmentCount: 150,
 *   clients: { totalProcessed: 45, newClients: 12, existingClients: 33, mergedClients: 2 },
 *   appointments: { totalProcessed: 150, inserted: 25, updated: 120, skipped: 5 },
 *   aggregations: [
 *     { table: 'daily_data', rowsUpserted: 31 },
 *     { table: 'weekly_data', rowsUpserted: 5 },
 *     { table: 'monthly_data', rowsUpserted: 1 }
 *   ]
 * }
 */
export interface PullResult {
  success: boolean                      // e.g., true
  fetchedAt: string                     // e.g., '2025-01-07T15:30:00.000Z' (ISO timestamp)
  appointmentCount: number              // e.g., 150 (total fetched from API)
  clients: ClientProcessorResult
  appointments: AppointmentProcessorResult
  aggregations: AggregationResult[]
  errors?: string[]                     // e.g., ['Failed to upsert daily_data']
}