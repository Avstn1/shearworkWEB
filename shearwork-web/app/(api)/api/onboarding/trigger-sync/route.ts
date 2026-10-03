import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { NextRequest, NextResponse } from 'next/server'
import { queueMonthsForSync } from '@/lib/booking/syncQueue'
import { getAuthenticatedUser } from '@/utils/api-auth'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { userId, startMonth, startYear: startYearRaw } = await request.json()
    const startYear = Number(startYearRaw)

    console.log('[trigger-sync] received:', { userId, startMonth, startYear })

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!userId || !startYear) return NextResponse.json({ error: 'Missing userId or startYear' }, { status: 400 })
    if (user.id !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { data: acuityToken } = await supabase
      .from('acuity_tokens')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!acuityToken) {
      return NextResponse.json({ error: 'No Acuity integration found' }, { status: 404 })
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    let startDate: Date
    if (startMonth) {
      startDate = new Date(startYear, MONTHS.indexOf(startMonth), 1)
    } else {
      startDate = new Date(startYear, 0, 1)
    }

    // Build full list of months, most recent first
    const allMonths: { month: number; year: number }[] = []
    let iterDate = new Date(startDate)
    while (
      iterDate.getFullYear() < currentYear ||
      (iterDate.getFullYear() === currentYear && iterDate.getMonth() <= currentMonth)
    ) {
      allMonths.push({ month: iterDate.getMonth(), year: iterDate.getFullYear() })
      iterDate.setMonth(iterDate.getMonth() + 1)
    }
    allMonths.reverse() // most recent first

    if (allMonths.length === 0) {
      console.error('[trigger-sync] No months to sync!')
      return NextResponse.json({ error: 'No months to sync' }, { status: 400 })
    }

    // Priority = current month only, background = everything else
    const priorityMonths = allMonths.filter(m => m.year === currentYear && m.month === currentMonth)
    console.log("These are the priority months: ", priorityMonths)
    const backgroundMonths = allMonths.filter(m => !(m.year === currentYear && m.month === currentMonth))
    const orderedMonths = [...priorityMonths, ...backgroundMonths]

    console.log(`[trigger-sync] ${priorityMonths.length} priority, ${backgroundMonths.length} background`)

    // Upsert all months as pending
    await supabase
      .from('sync_status')
      .upsert(
        [
          ...priorityMonths.map(({ month, year }) => ({
            user_id: userId, month: MONTHS[month], year, status: 'pending', sync_phase: 'priority', retry_count: 0, error_message: null,
          })),
          ...backgroundMonths.map(({ month, year }) => ({
            user_id: userId, month: MONTHS[month], year, status: 'pending', sync_phase: 'background', retry_count: 0, error_message: null,
          })),
        ],
        { onConflict: 'user_id,month,year', ignoreDuplicates: false }
      )

    // One QStash message per month on this barber's queue: current month first, one
    // month at a time, retried by QStash on failure (see lib/booking/syncQueue.ts)
    const queued = await queueMonthsForSync(
      createSupabaseAdminClient(),
      userId,
      orderedMonths.map(({ month, year }) => ({
        month: MONTHS[month],
        year,
        sync_phase: year === currentYear && month === currentMonth ? 'priority' : 'background',
      }))
    )
    console.log(`[trigger-sync] queued ${queued}/${orderedMonths.length} months for ${userId}`)

    return NextResponse.json({
      success: true,
      message: 'Sync started',
      totalMonths: allMonths.length,
      queuedMonths: queued,
      priorityMonths: priorityMonths.length,
      backgroundMonths: backgroundMonths.length,
    })

  } catch (error) {
    console.error('[trigger-sync] top-level error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}