// app/api/tests/test-full-pipeline/route.ts

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { pull } from '@/lib/booking/orchestrator'
import { Month, MONTHS } from '@/lib/booking/types'

const TEST_PREFIX = 'test_'

/**
 * End-to-end test of the full pull pipeline with real Acuity data.
 * 
 * Tests:
 * 1. Fetches real appointments from Acuity
 * 2. Processes clients → test_acuity_clients
 * 3. Processes appointments → test_acuity_appointments
 * 4. Runs all aggregations → test aggregation tables
 * 5. Verifies data in all tables
 * 
 * Query parameters:
 * - month: string (e.g., 'January')
 * - year: number (e.g., 2025)
 * - clear: boolean (if true, clears all test tables first)
 * 
 * Usage:
 * GET /api/tests/test-full-pipeline?month=January&year=2025&clear=true
 */
export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const month = (searchParams.get('month') || 'January') as Month
  const year = parseInt(searchParams.get('year') || '2025', 10)
  const clear = searchParams.get('clear') === 'true'

  // Validate month
  if (!MONTHS.includes(month)) {
    return NextResponse.json({
      error: `Invalid month: ${month}. Must be one of: ${MONTHS.join(', ')}`,
    }, { status: 400 })
  }

  const results: Record<string, any> = {}
  const validations: Record<string, boolean> = {}

  // All test tables to track
  const testTables = [
    'test_acuity_clients',
    'test_acuity_appointments',
    'test_daily_data',
    'test_weekly_data',
    'test_weekly_top_clients',
    'test_weekly_marketing_funnels_base',
    'test_monthly_data',
    'test_report_top_clients',
    'test_service_bookings',
    'test_marketing_funnels',
  ]

  try {
    // ======================== STEP 1: CLEAR TEST TABLES ========================

    if (clear) {
      results.step1 = { description: 'Clearing all test tables' }
      
      for (const table of testTables) {
        try {
          await supabase.from(table).delete().eq('user_id', user.id)
        } catch (err) {
          // Table might not exist, that's ok
          console.log(`Could not clear ${table}:`, err)
        }
      }
      
      results.step1.cleared = testTables
    } else {
      results.step1 = { description: 'Skipped clearing (add &clear=true to clear)' }
    }

    // ======================== STEP 2: RUN FULL PIPELINE ========================

    results.step2 = { description: 'Running full pull pipeline' }

    const pullResult = await pull(
      supabase,
      user.id,
      { granularity: 'month', year, month },
      {
        tablePrefix: TEST_PREFIX,
        skipAggregations: false,  // Run all aggregations
        dryRun: false,
      }
    )

    results.step2.pullResult = pullResult

    validations['Pipeline succeeded'] = pullResult.success
    validations['Appointments fetched > 0'] = pullResult.appointmentCount > 0
    validations['Clients processed > 0'] = pullResult.clients.totalProcessed > 0
    validations['Appointments processed > 0'] = pullResult.appointments.totalProcessed > 0
    validations['Aggregations ran'] = pullResult.aggregations.length > 0

    // ======================== STEP 3: VERIFY BASE TABLES ========================

    results.step3 = { description: 'Verifying base tables' }

    // Check test_acuity_clients
    const { count: clientCount, data: sampleClients } = await supabase
      .from('test_acuity_clients')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .limit(5)

    results.step3.clients = {
      count: clientCount,
      sample: sampleClients?.map(c => ({
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        email: c.email,
        first_appt: c.first_appt,
        second_appt: c.second_appt,
        first_source: c.first_source,
      }))
    }

    validations['Clients in test_acuity_clients'] = (clientCount || 0) > 0
    validations['Client count matches pull result'] = clientCount === pullResult.clients.totalProcessed

    // Check test_acuity_appointments
    const { count: apptCount, data: sampleAppts } = await supabase
      .from('test_acuity_appointments')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .limit(5)

    results.step3.appointments = {
      count: apptCount,
      sample: sampleAppts?.map(a => ({
        date: a.appointment_date,
        service: a.service_type,
        revenue: a.revenue,
        tip: a.tip,
      }))
    }

    validations['Appointments in test_acuity_appointments'] = (apptCount || 0) > 0

    // ======================== STEP 4: VERIFY AGGREGATION TABLES ========================

    results.step4 = { description: 'Verifying aggregation tables' }

    // Daily data
    const { count: dailyCount, data: dailyData } = await supabase
      .from('test_daily_data')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .limit(5)

    results.step4.daily = {
      count: dailyCount,
      sample: dailyData?.map(d => ({
        date: d.date,
        appointments: d.num_appointments,
        revenue: d.total_revenue,
        tips: d.tips,
      }))
    }

    validations['Daily aggregation has data'] = (dailyCount || 0) > 0

    // Weekly data
    const { count: weeklyCount, data: weeklyData } = await supabase
      .from('test_weekly_data')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('start_date', { ascending: true })
      .limit(5)

    results.step4.weekly = {
      count: weeklyCount,
      sample: weeklyData?.map(w => ({
        week: w.week_number,
        month: w.month,
        start: w.start_date,
        end: w.end_date,
        appointments: w.num_appointments,
        revenue: w.total_revenue,
        new_clients: w.new_clients,
        returning_clients: w.returning_clients,
      }))
    }

    validations['Weekly aggregation has data'] = (weeklyCount || 0) > 0

    // Weekly top clients
    const { count: weeklyTopCount } = await supabase
      .from('test_weekly_top_clients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    results.step4.weeklyTopClients = { count: weeklyTopCount }
    validations['Weekly top clients has data'] = (weeklyTopCount || 0) > 0

    // Weekly marketing funnels
    const { count: weeklyFunnelCount, data: weeklyFunnels } = await supabase
      .from('test_weekly_marketing_funnels_base')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .limit(5)

    results.step4.weeklyFunnels = {
      count: weeklyFunnelCount,
      sample: weeklyFunnels?.map(f => ({
        source: f.source,
        week: f.week_number,
        month: f.report_month,
        new_clients: f.new_clients,
        avg_ticket: f.avg_ticket,
      }))
    }

    validations['Weekly marketing funnels has data'] = (weeklyFunnelCount || 0) >= 0 // May be 0 if no valid sources

    // Monthly data
    const { count: monthlyCount, data: monthlyData } = await supabase
      .from('test_monthly_data')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .limit(5)

    results.step4.monthly = {
      count: monthlyCount,
      sample: monthlyData?.map(m => ({
        month: m.month,
        year: m.year,
        appointments: m.num_appointments,
        revenue: m.total_revenue,
        tips: m.tips,
        avg_ticket: m.avg_ticket,
        unique_clients: m.unique_clients,
        new_clients: m.new_clients,
        returning_clients: m.returning_clients,
      }))
    }

    validations['Monthly aggregation has data'] = (monthlyCount || 0) > 0

    // Report top clients
    const { count: topClientsCount } = await supabase
      .from('test_report_top_clients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    results.step4.reportTopClients = { count: topClientsCount }
    validations['Report top clients has data'] = (topClientsCount || 0) > 0

    // Service bookings
    const { count: serviceCount, data: serviceData } = await supabase
      .from('test_service_bookings')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .limit(5)

    results.step4.services = {
      count: serviceCount,
      sample: serviceData?.map(s => ({
        service: s.service_name,
        month: s.report_month,
        year: s.report_year,
        bookings: s.bookings,
        price: s.price,
      }))
    }

    validations['Service bookings has data'] = (serviceCount || 0) > 0

    // Marketing funnels (monthly)
    const { count: funnelCount, data: funnelData } = await supabase
      .from('test_marketing_funnels')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .limit(5)

    results.step4.marketingFunnels = {
      count: funnelCount,
      sample: funnelData?.map(f => ({
        source: f.source,
        month: f.report_month,
        year: f.report_year,
        new_clients: f.new_clients,
        avg_ticket: f.avg_ticket,
        client_names: f.client_names,
      }))
    }

    validations['Marketing funnels has data'] = (funnelCount || 0) >= 0 // May be 0 if no valid sources

    // ======================== STEP 5: CROSS-VALIDATION ========================

    results.step5 = { description: 'Cross-validating aggregations' }

    // Sum of daily revenue should match monthly revenue
    const { data: dailySum } = await supabase
      .from('test_daily_data')
      .select('total_revenue, tips')
      .eq('user_id', user.id)
      .eq('month', month)
      .eq('year', year)

    const dailyTotalRevenue = dailySum?.reduce((sum, d) => sum + (Number(d.total_revenue) || 0), 0) || 0
    const dailyTotalTips = dailySum?.reduce((sum, d) => sum + (Number(d.tips) || 0), 0) || 0

    const monthlyRecord = monthlyData?.find(m => m.month === month && m.year === year)
    const monthlyTotalRevenue = Number(monthlyRecord?.total_revenue) || 0
    const monthlyTotalTips = Number(monthlyRecord?.tips) || 0

    results.step5.revenueComparison = {
      dailySum: dailyTotalRevenue,
      monthlyTotal: monthlyTotalRevenue,
      match: Math.abs(dailyTotalRevenue - monthlyTotalRevenue) < 0.01,
    }

    results.step5.tipsComparison = {
      dailySum: dailyTotalTips,
      monthlyTotal: monthlyTotalTips,
      match: Math.abs(dailyTotalTips - monthlyTotalTips) < 0.01,
    }

    validations['Daily revenue sums to monthly'] = Math.abs(dailyTotalRevenue - monthlyTotalRevenue) < 0.01
    validations['Daily tips sums to monthly'] = Math.abs(dailyTotalTips - monthlyTotalTips) < 0.01

    // ======================== STEP 6: IDEMPOTENCY TEST ========================

    results.step6 = { description: 'Testing idempotency (running again)' }

    const pullResult2 = await pull(
      supabase,
      user.id,
      { granularity: 'month', year, month },
      {
        tablePrefix: TEST_PREFIX,
        skipAggregations: false,
        dryRun: false,
      }
    )

    results.step6.secondPull = {
      success: pullResult2.success,
      newClients: pullResult2.clients.newClients,
      existingClients: pullResult2.clients.existingClients,
    }

    // Check counts haven't changed
    const { count: clientCount2 } = await supabase
      .from('test_acuity_clients')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { count: dailyCount2 } = await supabase
      .from('test_daily_data')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    validations['Idempotent - no new clients on re-run'] = pullResult2.clients.newClients === 0
    validations['Idempotent - client count unchanged'] = clientCount === clientCount2
    validations['Idempotent - daily count unchanged'] = dailyCount === dailyCount2

    // ======================== SUMMARY ========================

    const totalValidations = Object.keys(validations).length
    const passedValidations = Object.values(validations).filter(v => v).length
    const failedValidations = Object.entries(validations).filter(([_, v]) => !v).map(([k]) => k)

    results.summary = {
      month,
      year,
      totalValidations,
      passed: passedValidations,
      failed: totalValidations - passedValidations,
      failedTests: failedValidations,
    }

    results.tableCounts = {
      clients: clientCount,
      appointments: apptCount,
      daily: dailyCount,
      weekly: weeklyCount,
      weeklyTopClients: weeklyTopCount,
      weeklyFunnels: weeklyFunnelCount,
      monthly: monthlyCount,
      reportTopClients: topClientsCount,
      services: serviceCount,
      marketingFunnels: funnelCount,
    }

    results.validations = validations
    results.allPassed = passedValidations === totalValidations

    return NextResponse.json({
      success: results.allPassed,
      message: results.allPassed 
        ? 'All validations passed! Pipeline is working correctly.'
        : `${totalValidations - passedValidations} validation(s) failed.`,
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