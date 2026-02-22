// app/(api)/api/nudge/compare-scoring/route.ts
// Compare pre-holiday scoring vs holiday-boosted scoring
// Usage: GET /api/nudge/compare-scoring?userId=XXX&limit=20
'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
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

interface ClientScore {
  client_id: string
  name: string
  visiting_type: string | null
  baseScore: number
  holidayBoost: number
  finalScore: number
  hasHolidayHistory: boolean
  rankWithoutBoost: number
  rankWithBoost: number
  rankChange: number
}

/**
 * Calculate base score for a client (without holiday boost)
 * Mirrors the logic in clientSmsSelectionAlgorithm_AutoNudge.ts
 */
function calculateBaseScore(client: {
  visiting_type: string | null
  last_appt: string | null
  avg_weekly_visits: number | null
  date_last_sms_sent: string | null
}): number {
  const today = new Date()
  
  if (!client.last_appt) return 0
  
  const lastApptDate = new Date(client.last_appt)
  const lastSmsSentDate = client.date_last_sms_sent ? new Date(client.date_last_sms_sent) : null
  
  const daysSinceLastVisit = Math.floor((today.getTime() - lastApptDate.getTime()) / (1000 * 60 * 60 * 24))
  const daysSinceLastSms = lastSmsSentDate 
    ? Math.floor((today.getTime() - lastSmsSentDate.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity

  // Don't message if SMS sent in last 14 days
  if (daysSinceLastSms < 14) return 0

  const expectedVisitIntervalDays = client.avg_weekly_visits 
    ? Math.round(7 / client.avg_weekly_visits)
    : 0

  const daysOverdue = Math.max(0, daysSinceLastVisit - expectedVisitIntervalDays)

  // Must be at least 14 days overdue
  if (daysOverdue < 14) return 0

  // Calculate score based on visiting type
  switch (client.visiting_type) {
    case 'consistent':
      return 195 + (daysOverdue * 3)
    case 'semi-consistent':
      return 200 + (daysOverdue * 3)
    case 'easy-going':
      return 25 + Math.min(daysOverdue, 10)
    case 'rare':
      return 10
    default:
      return 0
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId query parameter is required',
      }, { status: 400 })
    }

    const today = new Date()
    const activeHoliday = getActiveHolidayForBoosting(today)

    // Fetch eligible clients
    const { data: clients, error: clientsError } = await supabase
      .from('acuity_clients')
      .select('client_id, first_name, last_name, visiting_type, last_appt, avg_weekly_visits, date_last_sms_sent, total_appointments')
      .eq('user_id', userId)
      .not('phone_normalized', 'is', null)
      .not('last_appt', 'is', null)
      .neq('sms_subscribed', false)
      .gt('total_appointments', 1)
      .gte('avg_weekly_visits', 0.01)
      .lte('avg_weekly_visits', 2.5)
      .order('last_appt', { ascending: false })
      .limit(limit)

    if (clientsError) {
      return NextResponse.json({
        success: false,
        error: `Failed to fetch clients: ${clientsError.message}`,
      }, { status: 500 })
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible clients found',
        clients: [],
      })
    }

    // Calculate holiday sensitivity for all clients
    let sensitivityMap = new Map<string, { boost: number; matchedLastYear: boolean }>()
    
    if (activeHoliday) {
      const clientIds = clients.map(c => c.client_id)
      sensitivityMap = await calculateHolidaySensitivityBatch(
        supabase,
        clientIds,
        userId,
        activeHoliday
      )
    }

    // Calculate scores for each client
    const scoredClients: ClientScore[] = clients.map(client => {
      const baseScore = calculateBaseScore(client)
      const sensitivity = sensitivityMap.get(client.client_id)
      const holidayBoost = sensitivity?.boost || 0
      const finalScore = baseScore + holidayBoost

      return {
        client_id: client.client_id,
        name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
        visiting_type: client.visiting_type,
        baseScore,
        holidayBoost,
        finalScore,
        hasHolidayHistory: sensitivity?.matchedLastYear || false,
        rankWithoutBoost: 0, // Will be calculated below
        rankWithBoost: 0,    // Will be calculated below
        rankChange: 0,       // Will be calculated below
      }
    })

    // Calculate ranks WITHOUT boost (by base score)
    const sortedByBase = [...scoredClients].sort((a, b) => b.baseScore - a.baseScore)
    sortedByBase.forEach((client, index) => {
      const original = scoredClients.find(c => c.client_id === client.client_id)
      if (original) original.rankWithoutBoost = index + 1
    })

    // Calculate ranks WITH boost (by final score)
    const sortedByFinal = [...scoredClients].sort((a, b) => b.finalScore - a.finalScore)
    sortedByFinal.forEach((client, index) => {
      const original = scoredClients.find(c => c.client_id === client.client_id)
      if (original) {
        original.rankWithBoost = index + 1
        original.rankChange = original.rankWithoutBoost - original.rankWithBoost
      }
    })

    // Sort final output by finalScore (highest first)
    scoredClients.sort((a, b) => b.finalScore - a.finalScore)

    // Calculate selection impact (top 10)
    const top10WithoutBoost = new Set(sortedByBase.slice(0, 10).map(c => c.client_id))
    const top10WithBoost = new Set(sortedByFinal.slice(0, 10).map(c => c.client_id))
    
    const movedIntoTop10 = scoredClients.filter(c => 
      top10WithBoost.has(c.client_id) && !top10WithoutBoost.has(c.client_id)
    )
    const displacedFromTop10 = scoredClients.filter(c => 
      top10WithoutBoost.has(c.client_id) && !top10WithBoost.has(c.client_id)
    )

    // Get previous year holiday info for display
    const previousHoliday = activeHoliday ? getPreviousYearHoliday(activeHoliday) : null
    const lookbackRange = previousHoliday ? getHolidayDateRange(previousHoliday, DEFAULT_BUFFER_DAYS) : null

    return NextResponse.json({
      success: true,
      holidayStatus: {
        active: !!activeHoliday,
        name: activeHoliday?.name || null,
        window: activeHoliday ? `${activeHoliday.startDate} to ${activeHoliday.endDate}` : null,
        lookbackWindow: lookbackRange ? `${lookbackRange.startDate} to ${lookbackRange.endDate}` : null,
        boostAmount: HOLIDAY_BOOST_AMOUNT,
      },
      summary: {
        totalClients: scoredClients.length,
        clientsWithScore: scoredClients.filter(c => c.baseScore > 0).length,
        clientsBoosted: scoredClients.filter(c => c.holidayBoost > 0).length,
        boostPercentage: ((scoredClients.filter(c => c.holidayBoost > 0).length / scoredClients.length) * 100).toFixed(1) + '%',
        selectionImpact: {
          movedIntoTop10: movedIntoTop10.map(c => ({ name: c.name, rankChange: `+${c.rankChange}` })),
          displacedFromTop10: displacedFromTop10.map(c => ({ name: c.name, rankChange: c.rankChange })),
        },
      },
      clients: scoredClients.map(c => ({
        ...c,
        rankChangeDisplay: c.rankChange > 0 ? `+${c.rankChange}` : c.rankChange === 0 ? '0' : `${c.rankChange}`,
      })),
      // Show top 10 comparison side by side
      top10Comparison: {
        withoutHolidayBoost: sortedByBase.slice(0, 10).map((c, i) => ({
          rank: i + 1,
          name: c.name,
          score: c.baseScore,
          visiting_type: c.visiting_type,
        })),
        withHolidayBoost: sortedByFinal.slice(0, 10).map((c, i) => ({
          rank: i + 1,
          name: c.name,
          score: c.finalScore,
          visiting_type: c.visiting_type,
          boosted: c.holidayBoost > 0,
        })),
      },
    })

  } catch (err) {
    console.error('Error in compare-scoring:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 })
  }
}
