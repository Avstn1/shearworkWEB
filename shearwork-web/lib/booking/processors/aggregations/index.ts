// lib/booking/processors/aggregations/index.ts

import { PullContext, AggregationResult } from '../../types'
import { OrchestratorOptions } from '../../orchestrator'
import { runDailyAggregation } from './daily'
import { runWeeklyAggregation } from './weekly'
import { runMonthlyAggregation } from './monthly'

/**
 * Run all aggregations based on pull granularity
 * 
 * Aggregation strategy:
 * - Daily: Always runs (most granular)
 * - Weekly: Runs for week, month, quarter, year pulls
 * - Monthly: Runs for month, quarter, year pulls
 * 
 * Each aggregation is independent and can fail without affecting others.
 * Errors are collected and returned in the results.
 * 
 * @param context - Pull context with user info and date range
 * @param orchestratorOptions - Options like tablePrefix for testing
 * @returns Array of aggregation results with any errors
 */
export async function runAggregations(
  context: PullContext,
  orchestratorOptions: OrchestratorOptions = {}
): Promise<AggregationResult[]> {
  const { granularity } = context.options

  const failed = (table: string, err: unknown): AggregationResult[] => {
    console.error(`${table} aggregation failed:`, err)
    return [{ table, rowsUpserted: 0, error: err instanceof Error ? err.message : String(err) }]
  }

  // Daily always runs; weekly for week+ pulls; monthly for month+ pulls. They write
  // separate tables and only read appointments/clients, so they run in parallel.
  const runs: Array<Promise<AggregationResult[]>> = [
    runDailyAggregation(context, orchestratorOptions).then(r => [r], err => failed('daily_data', err)),
  ]

  if (['week', 'month', 'quarter', 'year'].includes(granularity)) {
    runs.push(runWeeklyAggregation(context, orchestratorOptions).catch(err => failed('weekly_data', err)))
  }

  if (['month', 'quarter', 'year'].includes(granularity)) {
    runs.push(runMonthlyAggregation(context, orchestratorOptions).catch(err => failed('monthly_data', err)))
  }

  return (await Promise.all(runs)).flat()
}

// Export individual aggregation functions for direct use if needed
export { runDailyAggregation } from './daily'
export { runWeeklyAggregation } from './weekly'
export { runMonthlyAggregation } from './monthly'