// lib/booking/processors/aggregations/shared/types.ts

import { SupabaseClient } from '@supabase/supabase-js'
import { PullContext, AggregationResult } from '../../../types'
import { OrchestratorOptions } from '../../../orchestrator'

/**
 * Context passed to all aggregation functions
 */
export interface AggregationContext {
  supabase: SupabaseClient
  userId: string
  dateRange: {
    startISO: string
    endISO: string
  }
  tablePrefix: string
}

/**
 * Configuration for aggregation processors
 */
export interface AggregationConfig {
  tableName: string
  conflictColumns: string[]
}

/**
 * Result from SQL execution
 */
export interface SQLExecutionResult {
  error: any
  data?: any
  count?: number
}

/**
 * Week metadata for calculations
 */
export interface WeekMetadata {
  weekStart: string        // ISO date (Monday)
  weekEnd: string          // ISO date (Sunday)
  weekNumber: number       // Week number within month
  month: string            // Month name
  year: number             // Year
}

/**
 * Client classification for funnels
 */
export type ClientClassification = 'new' | 'returning'

/**
 * Aggregation processor function signature
 */
export type AggregationProcessor = (
  context: PullContext,
  orchestratorOptions?: OrchestratorOptions
) => Promise<AggregationResult | AggregationResult[]>