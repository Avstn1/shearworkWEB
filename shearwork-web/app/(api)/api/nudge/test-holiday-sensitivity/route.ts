// app/(api)/api/nudge/test-holiday-sensitivity/route.ts
// Test endpoint for holiday sensitivity calculation
// Usage: GET /api/nudge/test-holiday-sensitivity?userId=XXX
'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  HOLIDAYS,
  getActiveHolidayForBoosting,
  getHolidayDateRange,
  getPreviousYearHoliday,
} from '@/lib/nudge/holidayCalendar'
import {
  calculateHolidaySensitivityBatch,
  HOLIDAY_BOOST_AMOUNT,
  DEFAULT_BUFFER_DAYS,
} from '@/lib/nudge/calculateHolidaySensitivity'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const forceHolidayId = searchParams.get('forceHoliday') // Optional: force a specific holiday
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 20

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId query parameter is required',
      }, { status: 400 })
    }

    const today = new Date()
    
    // Get active holiday (or forced one for testing)
    const activeHoliday = forceHolidayId 
      ? HOLIDAYS.find(h => h.id === forceHolidayId)
      : getActiveHolidayForBoosting(today)

    // Diagnostic info
    const diagnostics = {
      today: today.toISOString(),
      todayLocal: today.toLocaleDateString('en-CA'),
      allHolidays: HOLIDAYS.map(h => ({
        id: h.id,
        startDate: h.startDate,
        endDate: h.endDate,
        activationDaysBefore: h.activationDaysBefore,
        activationStartDate: (() => {
          const start = new Date(h.startDate)
          start.setDate(start.getDate() - h.activationDaysBefore)
          return start.toISOString().split('T')[0]
        })(),
      })),
      activeHoliday: activeHoliday ? {
        id: activeHoliday.id,
        name: activeHoliday.name,
        year: activeHoliday.year,
        startDate: activeHoliday.startDate,
        endDate: activeHoliday.endDate,
      } : null,
      boostAmount: HOLIDAY_BOOST_AMOUNT,
      bufferDays: DEFAULT_BUFFER_DAYS,
    }

    if (!activeHoliday) {
      return NextResponse.json({
        success: true,
        message: 'No active holiday found for boosting',
        diagnostics,
        results: null,
      })
    }

    // Get previous year's holiday for comparison
    const previousHoliday = getPreviousYearHoliday(activeHoliday)
    const lookbackRange = previousHoliday 
      ? getHolidayDateRange(previousHoliday, DEFAULT_BUFFER_DAYS)
      : null

    // Fetch some clients to test with
    const { data: clients, error: clientsError } = await supabase
      .from('acuity_clients')
      .select('client_id, first_name, last_name, visiting_type')
      .eq('user_id', userId)
      .not('phone_normalized', 'is', null)
      .limit(limit)

    if (clientsError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch clients: ${clientsError.message}`,
        diagnostics,
      }, { status: 500 })
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No clients found for this user',
        diagnostics,
        results: null,
      })
    }

    // Calculate sensitivity for these clients
    const clientIds = clients.map(c => c.client_id)
    const sensitivityMap = await calculateHolidaySensitivityBatch(
      supabase,
      clientIds,
      userId,
      activeHoliday
    )

    // Build results
    const results = clients.map(client => {
      const sensitivity = sensitivityMap.get(client.client_id)
      return {
        client_id: client.client_id,
        name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
        visiting_type: client.visiting_type,
        boost: sensitivity?.boost || 0,
        matchedLastYear: sensitivity?.matchedLastYear || false,
        holidayCohort: sensitivity?.holidayCohort || null,
      }
    })

    const boostedClients = results.filter(r => r.boost > 0)

    return NextResponse.json({
      success: true,
      diagnostics: {
        ...diagnostics,
        previousHoliday: previousHoliday ? {
          id: previousHoliday.id,
          startDate: previousHoliday.startDate,
          endDate: previousHoliday.endDate,
        } : null,
        lookbackRange,
      },
      summary: {
        totalClients: results.length,
        boostedClients: boostedClients.length,
        boostPercentage: ((boostedClients.length / results.length) * 100).toFixed(1) + '%',
      },
      results,
    })

  } catch (err) {
    console.error('Error in test-holiday-sensitivity:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 })
  }
}
