// lib/booking/processors/aggregations/shared/utils.ts

import { SupabaseClient } from '@supabase/supabase-js'
import { SQLExecutionResult } from './types'

/**
 * Execute raw SQL query via Supabase
 * 
 * This uses a workaround since Supabase doesn't support raw SQL directly.
 * We'll need to create the aggregation using multiple queries.
 */
export async function executeSQL(
  supabase: SupabaseClient,
  query: string,
  params: any[] = []
): Promise<SQLExecutionResult> {
  try {
    // Since we can't execute raw SQL directly, we need to use a custom RPC function
    // First, let's create it if it doesn't exist
    const { data, error } = await supabase.rpc('execute_sql_upsert', {
      query_text: query,
      query_params: params
    })

    if (error) {
      console.error('SQL execution error:', error)
      return {
        error,
        data: null,
        count: 0
      }
    }

    return {
      data,
      error: null,
      count: data?.count || 0
    }

  } catch (err) {
    console.error('SQL execution exception:', err)
    return {
      error: err,
      data: null,
      count: 0
    }
  }
}

/**
 * Format month name consistently (trim spaces, capitalize)
 */
export function formatMonthName(monthName: string): string {
  return monthName.trim().replace(/\s+/g, ' ')
}

/**
 * Calculate week number within a month
 * Monday-based weeks
 */
export function calculateWeekNumber(date: Date, monthStart: Date): number {
  // Find first Monday of the month
  const firstMonday = getFirstMondayOfMonth(monthStart)
  
  // Calculate days between first Monday and this date
  const diffMs = date.getTime() - firstMonday.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  // Week number is (days / 7) + 1
  return Math.floor(diffDays / 7) + 1
}

/**
 * Get the first Monday of a month
 */
export function getFirstMondayOfMonth(date: Date): Date {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
  const dayOfWeek = firstOfMonth.getDay()
  
  // If Sunday (0), add 1 day. If Monday (1), add 0. Otherwise, add days until Monday
  const daysToAdd = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : (8 - dayOfWeek)
  
  const monday = new Date(firstOfMonth)
  monday.setDate(firstOfMonth.getDate() + daysToAdd)
  monday.setHours(0, 0, 0, 0)
  
  return monday
}

/**
 * Get Monday of the week for any date (ISO week, Monday = start)
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Adjust when day is Sunday
  
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  
  return d
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 */
export function formatISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Get Sunday of the week for any date
 */
export function getSundayOfWeek(mondayDate: Date): Date {
  const sunday = new Date(mondayDate)
  sunday.setDate(mondayDate.getDate() + 6)
  return sunday
}

/**
 * Handle SQL errors with logging
 */
export function handleSQLError(
  tableName: string,
  error: any,
  context?: string
): never {
  const message = context 
    ? `${tableName} aggregation failed (${context}): ${error?.message || error}`
    : `${tableName} aggregation failed: ${error?.message || error}`
  
  console.error(message, error)
  throw new Error(message)
}

/**
 * Validate date range
 */
export function validateDateRange(startISO: string, endISO: string): void {
  const start = new Date(startISO)
  const end = new Date(endISO)
  
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid start date: ${startISO}`)
  }
  
  if (isNaN(end.getTime())) {
    throw new Error(`Invalid end date: ${endISO}`)
  }
  
  if (start > end) {
    throw new Error(`Start date (${startISO}) cannot be after end date (${endISO})`)
  }
}