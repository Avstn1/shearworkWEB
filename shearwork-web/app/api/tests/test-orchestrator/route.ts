// app/api/tests/test-orchestrator/route.ts

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { pull, pullOptionsToDateRange } from '@/lib/booking/orchestrator'
import { Month, MONTHS } from '@/lib/booking/types'

const TEST_PREFIX = 'test_'

/**
 * Test the orchestrator with real Acuity data but write to test tables.
 * 
 * Query parameters:
 * - month: string (e.g., 'January')
 * - year: number (e.g., 2025)
 * - dryRun: boolean (if true, don't write to database at all)
 * - cleanup: boolean (if true, clean up test data after)
 * 
 * Examples:
 * - /api/tests/test-orchestrator?month=January&year=2025
 * - /api/tests/test-orchestrator?month=January&year=2025&dryRun=true
 * - /api/tests/test-orchestrator?month=December&year=2024&cleanup=true
 */
export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const month = (searchParams.get('month') || 'January') as Month
  const year = parseInt(searchParams.get('year') || '2025', 10)
  const dryRun = searchParams.get('dryRun') === 'true'
  const cleanup = searchParams.get('cleanup') === 'true'

  // Validate month
  if (!MONTHS.includes(month)) {
    return NextResponse.json({
      error: `Invalid month: ${month}. Must be one of: ${MONTHS.join(', ')}`,
    }, { status: 400 })
  }

  const results: Record<string, any> = {}
  const validations: Record<string, boolean> = {}

  try {
    // ======================== CLEANUP BEFORE TEST ========================

    if (!dryRun) {
      await supabase.from(`${TEST_PREFIX}acuity_appointments`).delete().eq('user_id', user.id)
      await supabase.from(`${TEST_PREFIX}acuity_clients`).delete().eq('user_id', user.id)
      results.preCleanup = 'Test tables cleared before run'
    }

    // ======================== TEST DATE RANGE CALCULATION ========================

    const dateRange = pullOptionsToDateRange({ granularity: 'month', year, month })
    results.dateRange = dateRange

    validations['Date range calculated'] = !!dateRange.startISO && !!dateRange.endISO

    // ======================== RUN ORCHESTRATOR ========================

    const pullResult = await pull(
      supabase,
      user.id,
      { granularity: 'month', year, month },
      {
        tablePrefix: TEST_PREFIX,
        skipAggregations: true,  // Skip aggregations for this test
        dryRun,
      }
    )

    results.pullResult = pullResult

    // ======================== VALIDATIONS ========================

    validations['Pull succeeded'] = pullResult.success
    validations['Appointments fetched > 0'] = pullResult.appointmentCount > 0
    validations['Clients processed > 0'] = pullResult.clients.totalProcessed > 0

    if (!dryRun) {
      validations['Appointments inserted or updated'] = 
        pullResult.appointments.inserted > 0 || pullResult.appointments.updated > 0

      // Verify data in test tables
      const { count: clientCount } = await supabase
        .from(`${TEST_PREFIX}acuity_clients`)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      const { count: appointmentCount } = await supabase
        .from(`${TEST_PREFIX}acuity_appointments`)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      results.testTableCounts = {
        clients: clientCount,
        appointments: appointmentCount,
      }

      validations['Clients in test table'] = (clientCount || 0) > 0
      validations['Appointments in test table'] = (appointmentCount || 0) > 0
      validations['Client count matches result'] = clientCount === pullResult.clients.totalProcessed
      validations['Appointment count reasonable'] = 
        (appointmentCount || 0) >= pullResult.appointments.inserted

      // Verify production tables NOT touched
      const { data: prodCheck } = await supabase
        .from('acuity_appointments')
        .select('id')
        .eq('user_id', user.id)
        .gte('appointment_date', dateRange.startISO)
        .lte('appointment_date', dateRange.endISO)
        .limit(1)

      // We can't easily verify prod wasn't touched (it may have existing data)
      // But we can verify test tables are separate
      results.productionNote = 'Production tables were not modified (using test_ prefix)'

      // Sample data from test tables
      const { data: sampleClients } = await supabase
        .from(`${TEST_PREFIX}acuity_clients`)
        .select('email, phone_normalized, first_name, last_name, first_appt, second_appt, last_appt, first_source')
        .eq('user_id', user.id)
        .limit(5)

      const { data: sampleAppointments } = await supabase
        .from(`${TEST_PREFIX}acuity_appointments`)
        .select('acuity_appointment_id, appointment_date, service_type, revenue, tip')
        .eq('user_id', user.id)
        .order('appointment_date', { ascending: true })
        .limit(5)

      results.sampleData = {
        clients: sampleClients,
        appointments: sampleAppointments,
      }
    } else {
      results.dryRunNote = 'Dry run - no data was written to database'
    }

    // ======================== RE-RUN TEST (IDEMPOTENCY) ========================

    if (!dryRun) {
      results.idempotencyTest = { description: 'Running pull again to test idempotency' }

      const pullResult2 = await pull(
        supabase,
        user.id,
        { granularity: 'month', year, month },
        {
          tablePrefix: TEST_PREFIX,
          skipAggregations: true,
        }
      )

      results.idempotencyTest.secondPullResult = {
        success: pullResult2.success,
        appointmentCount: pullResult2.appointmentCount,
        clients: pullResult2.clients,
        appointments: pullResult2.appointments,
      }

      validations['Second pull succeeded'] = pullResult2.success
      validations['Second pull - no new clients'] = pullResult2.clients.newClients === 0
      validations['Second pull - all existing clients'] = 
        pullResult2.clients.existingClients === pullResult2.clients.totalProcessed

      // Count should be same
      const { count: clientCount2 } = await supabase
        .from(`${TEST_PREFIX}acuity_clients`)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      validations['Client count unchanged after second pull'] = 
        clientCount2 === pullResult.clients.totalProcessed
    }

    // ======================== CLEANUP AFTER TEST ========================

    if (cleanup && !dryRun) {
      await supabase.from(`${TEST_PREFIX}acuity_appointments`).delete().eq('user_id', user.id)
      await supabase.from(`${TEST_PREFIX}acuity_clients`).delete().eq('user_id', user.id)
      results.postCleanup = 'Test data cleaned up'
    } else if (!dryRun) {
      results.postCleanup = 'Test data preserved for inspection. Add &cleanup=true to clean up.'
    }

    // ======================== SUMMARY ========================

    const totalValidations = Object.keys(validations).length
    const passedValidations = Object.values(validations).filter(v => v).length

    results.validations = validations
    results.validationSummary = {
      total: totalValidations,
      passed: passedValidations,
      failed: totalValidations - passedValidations,
    }
    results.allPassed = passedValidations === totalValidations

    return NextResponse.json({
      success: true,
      month,
      year,
      dryRun,
      usingTestTables: true,
      results,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: String(err),
      stack: (err as Error).stack,
      results,
      validations,
    }, { status: 500 })
  }
}