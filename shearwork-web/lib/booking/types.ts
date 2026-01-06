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

export interface PullOptions {
  granularity: PullGranularity
  year: number
  quarter?: Quarter
  month?: Month
  weekNumber?: number
  day?: number
}

export interface DateRange {
  startISO: string
  endISO: string
}

// ======================== NORMALIZED DATA ========================

export interface NormalizedAppointment {
  externalId: string
  datetime: string
  date: string
  
  email: string | null
  phone: string | null
  phoneNormalized: string | null
  firstName: string | null
  lastName: string | null
  
  serviceType: string | null
  price: number
  tip: number
  notes: string | null
  
  referralSource: string | null
  forms?: any[]
}

export interface NormalizedClient {
  clientId: string
  email: string | null
  phoneNormalized: string | null
  firstName: string | null
  lastName: string | null
  firstAppt: string
  lastAppt: string
  firstSource: string | null
}

// ======================== CONTEXT ========================

export interface PullContext {
  userId: string
  supabase: SupabaseClient
  options: PullOptions
}

// ======================== PROCESSOR RESULTS ========================

export interface ClientResolutionResult {
  appointmentToClient: Map<string, string>
  clients: Map<string, NormalizedClient>
  newClientIds: Set<string>
}

export interface ClientProcessorResult {
  totalProcessed: number
  newClients: number
  existingClients: number
  mergedClients: number
}

export interface AppointmentProcessorResult {
  totalProcessed: number
  inserted: number
  updated: number
  skipped: number
}

export interface AggregationResult {
  table: string
  rowsUpserted: number
}

export interface PullResult {
  success: boolean
  fetchedAt: string
  appointmentCount: number
  clients: ClientProcessorResult
  appointments: AppointmentProcessorResult
  aggregations: AggregationResult[]
  errors?: string[]
}