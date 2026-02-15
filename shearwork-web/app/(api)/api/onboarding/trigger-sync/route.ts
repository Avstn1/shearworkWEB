import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { userId, startMonth, startYear } = await request.json()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!userId || !startYear) {
      return NextResponse.json(
        { error: 'Missing userId or startYear' },
        { status: 400 }
      )
    }

    // Verify the authenticated user matches the userId
    if (user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Verify user has Acuity token
    const { data: acuityToken } = await supabase
      .from('acuity_tokens')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!acuityToken) {
      return NextResponse.json(
        { error: 'No Acuity integration found for this user' },
        { status: 404 }
      )
    }

    // Calculate months to sync
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-11

    let startDate: Date
    if (startMonth) {
      const startMonthIndex = MONTHS.indexOf(startMonth)
      startDate = new Date(startYear, startMonthIndex, 1)
    } else {
      startDate = new Date(startYear, 0, 1) // January
    }

    const monthsToSync: { month: string; year: number }[] = []
    let iterDate = new Date(startDate)

    while (
      iterDate.getFullYear() < currentYear ||
      (iterDate.getFullYear() === currentYear && iterDate.getMonth() <= currentMonth)
    ) {
      monthsToSync.push({
        month: MONTHS[iterDate.getMonth()],
        year: iterDate.getFullYear(),
      })
      iterDate.setMonth(iterDate.getMonth() + 1)
    }

    // Create sync_status rows
    const syncStatusRows = monthsToSync.map(({ month, year }) => ({
      user_id: userId,
      month,
      year,
      status: 'pending',
    }))

    const { error: insertError } = await supabase
      .from('sync_status')
      .upsert(syncStatusRows, {
        onConflict: 'user_id,month,year',
        ignoreDuplicates: false,
      })

    if (insertError) {
      console.error('Error inserting sync_status:', insertError)
      throw insertError
    }

    // Process months with concurrency limit of 6
    const CONCURRENCY_LIMIT = 6
    const BYPASS_TOKEN = process.env.BYPASS_TOKEN!
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Function to process a single month
    const processMonth = async (month: string, year: number) => {
      try {
        console.log(`🚀 Starting sync: ${userId} - ${month} ${year}`)
        
        // Update status to processing
        await supabase
          .from('sync_status')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('month', month)
          .eq('year', year)

        // Call the pull endpoint
        const targetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/pull?granularity=month&month=${encodeURIComponent(month)}&year=${year}`
        
        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'X-User-Id': userId,
            'x-vercel-protection-bypass': BYPASS_TOKEN,
          },
        })

        const status = response.ok ? 'completed' : 'failed'
        
        // Update sync_status
        await supabase
          .from('sync_status')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('month', month)
          .eq('year', year)

        console.log(`✓ Completed: ${userId} - ${month} ${year} → ${status}`)
        
        return { month, year, status }
      } catch (error) {
        console.error(`✗ Failed: ${userId} - ${month} ${year}`, error)
        
        // Mark as failed
        await supabase
          .from('sync_status')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('month', month)
          .eq('year', year)

        return { month, year, status: 'failed', error }
      }
    }

    // Process months with concurrency limit
    const processWithConcurrency = async () => {
      const results: any[] = []
      const executing: Promise<any>[] = []

      for (const { month, year } of monthsToSync) {
        const promise = processMonth(month, year).then(result => {
          executing.splice(executing.indexOf(promise), 1)
          return result
        })

        results.push(promise)
        executing.push(promise)

        if (executing.length >= CONCURRENCY_LIMIT) {
          await Promise.race(executing)
        }
      }

      return Promise.all(results)
    }

    // Start processing in the background (don't await)
    processWithConcurrency().catch(err => {
      console.error('Background sync error:', err)
    })

    return NextResponse.json({
      success: true,
      message: 'Sync started',
      totalMonths: monthsToSync.length,
      concurrencyLimit: CONCURRENCY_LIMIT,
    })
  } catch (error) {
    console.error('trigger-sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}