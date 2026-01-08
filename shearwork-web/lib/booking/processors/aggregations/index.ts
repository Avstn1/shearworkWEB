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
  const results: AggregationResult[] = []
  const { granularity } = context.options
  
  // ======================== DAILY AGGREGATION ========================
  // Always run daily aggregation (most granular level)
  
  try {
    const dailyResult = await runDailyAggregation(context, orchestratorOptions)
    results.push(dailyResult)
  } catch (err) {
    console.error('Daily aggregation failed:', err)
    results.push({
      table: 'daily_data',
      rowsUpserted: 0,
      error: err instanceof Error ? err.message : String(err)
    })
  }
  
  // ======================== WEEKLY AGGREGATION ========================
  // Run weekly for: week, month, quarter, year
  
  if (['week', 'month', 'quarter', 'year'].includes(granularity)) {
    try {
      const weeklyResults = await runWeeklyAggregation(context, orchestratorOptions)
      results.push(...weeklyResults)
    } catch (err) {
      console.error('Weekly aggregation failed:', err)
      results.push({
        table: 'weekly_data',
        rowsUpserted: 0,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
  
  // ======================== MONTHLY AGGREGATION ========================
  // Run monthly for: month, quarter, year
  
  if (['month', 'quarter', 'year'].includes(granularity)) {
    try {
      const monthlyResults = await runMonthlyAggregation(context, orchestratorOptions)
      results.push(...monthlyResults)
    } catch (err) {
      console.error('Monthly aggregation failed:', err)
      results.push({
        table: 'monthly_data',
        rowsUpserted: 0,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
  
  return results
}

// Export individual aggregation functions for direct use if needed
export { runDailyAggregation } from './daily'
export { runWeeklyAggregation } from './weekly'
export { runMonthlyAggregation } from './monthly'