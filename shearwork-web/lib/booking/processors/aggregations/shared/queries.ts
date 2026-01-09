// lib/booking/processors/aggregations/shared/queries.ts

/**
 * SQL fragment for calculating week boundaries (Monday-Sunday)
 * Returns: week_start (Monday), week_end (Sunday)
 */
export function buildWeekBoundarySQL(dateColumn: string = 'appointment_date'): string {
  return `
    -- Calculate Monday of the week (ISO week: Monday = start)
    DATE_TRUNC('week', ${dateColumn}::date + INTERVAL '1 day')::date - INTERVAL '1 day' as week_start,
    -- Calculate Sunday (6 days after Monday)
    (DATE_TRUNC('week', ${dateColumn}::date + INTERVAL '1 day')::date + INTERVAL '5 days')::date as week_end
  `.trim()
}

/**
 * SQL fragment for calculating week number within a month
 * Note: This is a simplified approach. For exact match with your existing logic,
 * you may need to adjust or use a custom Postgres function.
 */
export function buildWeekNumberSQL(weekStartColumn: string = 'week_start'): string {
  return `
    -- Week number within the month (1-based)
    CEIL(EXTRACT(DAY FROM ${weekStartColumn}) / 7.0)::int as week_number
  `.trim()
}

/**
 * SQL fragment for classifying clients as new or returning
 * Requires join with acuity_clients table to access first_appt
 */
export function buildClientClassificationSQL(
  firstApptColumn: string = 'c.first_appt',
  appointmentDateColumn: string = 'a.appointment_date',
  granularity: 'day' | 'week' | 'month' = 'month'
): string {
  let truncateFunc: string
  
  switch (granularity) {
    case 'day':
      truncateFunc = 'DATE'
      break
    case 'week':
      truncateFunc = `DATE_TRUNC('week', {date}::date + INTERVAL '1 day')::date - INTERVAL '1 day'`
      break
    case 'month':
      truncateFunc = `DATE_TRUNC('month', {date}::date)::date`
      break
  }
  
  return `
    -- New clients: first_appt within same ${granularity}
    COUNT(DISTINCT CASE 
      WHEN ${truncateFunc.replace('{date}', firstApptColumn)} = ${truncateFunc.replace('{date}', appointmentDateColumn)}
      THEN client_id 
    END) as new_clients,
    
    -- Returning clients: first_appt before this ${granularity}
    COUNT(DISTINCT CASE 
      WHEN ${truncateFunc.replace('{date}', firstApptColumn)} < ${truncateFunc.replace('{date}', appointmentDateColumn)}
      THEN client_id 
    END) as returning_clients
  `.trim()
}

/**
 * SQL fragment for date range filtering
 */
export function buildDateRangeFilter(
  userIdParam: string = '$1',
  startDateParam: string = '$2',
  endDateParam: string = '$3',
  dateColumn: string = 'appointment_date',
  userIdColumn: string = 'user_id'
): string {
  return `
    WHERE ${userIdColumn} = ${userIdParam}
      AND ${dateColumn} >= ${startDateParam}
      AND ${dateColumn} <= ${endDateParam}
  `.trim()
}

/**
 * SQL fragment for basic appointment aggregations
 */
export function buildBasicAggregationsSQL(): string {
  return `
    COUNT(*) as num_appointments,
    SUM(revenue) as total_revenue,
    SUM(tip) as total_tips,
    COUNT(DISTINCT client_id) as unique_clients
  `.trim()
}

/**
 * SQL fragment for extracting date components
 */
export function buildDateComponentsSQL(dateColumn: string = 'appointment_date'): string {
  return `
    EXTRACT(YEAR FROM ${dateColumn}::date) as year,
    TO_CHAR(${dateColumn}::date, 'Month') as month
  `.trim()
}

/**
 * Build complete CTE for appointments with week metadata
 */
export function buildWeeklyAppointmentsCTE(
  tablePrefix: string = '',
  userIdParam: string = '$1',
  startDateParam: string = '$2',
  endDateParam: string = '$3'
): string {
  return `
    WITH weekly_appointments AS (
      SELECT 
        a.*,
        c.first_appt,
        ${buildWeekBoundarySQL('a.appointment_date')},
        ${buildDateComponentsSQL('a.appointment_date')}
      FROM ${tablePrefix}acuity_appointments a
      INNER JOIN ${tablePrefix}acuity_clients c 
        ON a.client_id = c.client_id 
        AND a.user_id = c.user_id
      ${buildDateRangeFilter(userIdParam, startDateParam, endDateParam, 'a.appointment_date', 'a.user_id')}
    )
  `.trim()
}

/**
 * Build UPSERT conflict resolution clause
 */
export function buildUpsertConflict(
  conflictColumns: string[],
  updateColumns: string[]
): string {
  const conflictList = conflictColumns.join(', ')
  const updates = updateColumns
    .map(col => `${col} = EXCLUDED.${col}`)
    .join(',\n      ')
  
  return `
    ON CONFLICT (${conflictList}) 
    DO UPDATE SET
      ${updates},
      updated_at = NOW()
  `.trim()
}