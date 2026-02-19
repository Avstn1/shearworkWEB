import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'
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
    const allMonths: { month: string; year: number }[] = []
    let iterDate = new Date(startDate)
    while (
      iterDate.getFullYear() < currentYear ||
      (iterDate.getFullYear() === currentYear && iterDate.getMonth() <= currentMonth)
    ) {
      allMonths.push({ month: MONTHS[iterDate.getMonth()], year: iterDate.getFullYear() })
      iterDate.setMonth(iterDate.getMonth() + 1)
    }
    allMonths.reverse() // most recent first

    if (allMonths.length === 0) {
      console.error('[trigger-sync] No months to sync!')
      return NextResponse.json({ error: 'No months to sync' }, { status: 400 })
    }

    // Priority = current year, background = everything older
    const priorityMonths = allMonths.filter(m => m.year === currentYear)
    const backgroundMonths = allMonths.filter(m => m.year !== currentYear)
    const orderedMonths = [...priorityMonths, ...backgroundMonths]

    console.log(`[trigger-sync] ${priorityMonths.length} priority, ${backgroundMonths.length} background`)

    // Upsert all months as pending
    await supabase
      .from('sync_status')
      .upsert(
        [
          ...priorityMonths.map(({ month, year }) => ({
            user_id: userId, month, year, status: 'pending', sync_phase: 'priority', retry_count: 0, error_message: null,
          })),
          ...backgroundMonths.map(({ month, year }) => ({
            user_id: userId, month, year, status: 'pending', sync_phase: 'background', retry_count: 0, error_message: null,
          })),
        ],
        { onConflict: 'user_id,month,year', ignoreDuplicates: false }
      )

    const BYPASS_TOKEN = process.env.BYPASS_TOKEN!
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

    const runSync = async () => {
      // Fresh admin client — request-scoped client dies after response is returned on Vercel
      const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      for (const { month, year } of orderedMonths) {
        const phase = year === currentYear ? 'priority' : 'background'
        let attempt = 0

        while (true) {
          attempt++
          console.log(`[${phase}][${month} ${year}] attempt ${attempt}`)

          try {
            await adminSupabase
              .from('sync_status')
              .update({ status: 'processing', retry_count: attempt - 1, updated_at: new Date().toISOString() })
              .eq('user_id', userId).eq('month', month).eq('year', year)

            const url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/pull?granularity=month&month=${encodeURIComponent(month)}&year=${year}`
            console.log(`[${phase}][${month} ${year}] fetching...`)

            const res = await fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'X-User-Id': userId,
                'x-vercel-protection-bypass': BYPASS_TOKEN,
              },
            })

            console.log(`[${phase}][${month} ${year}] response: ${res.status}`)
            const text = await res.text()
            console.log(`[${phase}][${month} ${year}] body: ${text.substring(0, 200)}`)

            let data: any
            try { data = JSON.parse(text) } catch { throw new Error(`Bad JSON: ${text.substring(0, 100)}`) }

            if (!res.ok || data.error) {
              throw new Error(data.error?.message || data.error || `HTTP ${res.status}`)
            }

            await adminSupabase
              .from('sync_status')
              .update({ status: 'completed', retry_count: attempt - 1, error_message: null, updated_at: new Date().toISOString() })
              .eq('user_id', userId).eq('month', month).eq('year', year)

            console.log(`[${phase}][${month} ${year}] done on attempt ${attempt}`)
            break // move to next month

          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`[${phase}][${month} ${year}] attempt ${attempt} failed: ${msg}`)

            await adminSupabase
              .from('sync_status')
              .update({ status: 'retrying', retry_count: attempt, error_message: msg })
              .eq('user_id', userId).eq('month', month).eq('year', year)

            const delay = Math.min(5000 * attempt, 30000)
            console.log(`[${phase}][${month} ${year}] retrying in ${delay}ms...`)
            await new Promise(r => setTimeout(r, delay))
          }
        }
      }

      console.log('[trigger-sync] All months synced!')

      await adminSupabase
        .from('notifications')
        .insert({
          user_id: userId,
          header: 'Acuity data fully synced',
          message: "Your data from Acuity has been completely synced. Please refresh to see the latest data.",
          reference_type: 'sync_completed',
        })

      console.log('[trigger-sync] Notification sent')
    }

    // Fire and forget
    waitUntil(runSync())

    return NextResponse.json({
      success: true,
      message: 'Sync started',
      totalMonths: allMonths.length,
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