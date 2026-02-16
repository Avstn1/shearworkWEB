import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Retry configuration
const MAX_RETRIES = 3
const RETRY_DELAY = 2000 // 2 seconds
const REQUEST_TIMEOUT = 120000 // 2 minutes

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

    // Reverse order - most recent months first (more relevant)
    monthsToSync.reverse()

    // Create sync_status rows
    const syncStatusRows = monthsToSync.map(({ month, year }) => ({
      user_id: userId,
      month,
      year,
      status: 'pending',
      retry_count: 0,
      error_message: null,
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

    // Function to process a single month with retry logic
    const processMonth = async (month: string, year: number, retryCount = 0): Promise<any> => {
      try {
        console.log(`🚀 Starting sync: ${userId} - ${month} ${year} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`)
        
        // Update status to processing
        await supabase
          .from('sync_status')
          .update({ 
            status: 'processing', 
            updated_at: new Date().toISOString(),
            retry_count: retryCount 
          })
          .eq('user_id', userId)
          .eq('month', month)
          .eq('year', year)

        // Call the pull endpoint with timeout
        const targetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/pull?granularity=month&month=${encodeURIComponent(month)}&year=${year}`
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
        
        const response = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'X-User-Id': userId,
            'x-vercel-protection-bypass': BYPASS_TOKEN,
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }
        
        // Check response body for errors (API may return 200 with error in body)
        const data = await response.json()
        if (data.error || !data.success) {
          // Extract error details if available
          const errorDetail = typeof data.error === 'object' 
            ? JSON.stringify(data.error) 
            : data.error || 'Unknown error from pull endpoint'
          throw new Error(errorDetail)
        }
        
        // Only mark as completed if both HTTP status and response body indicate success
        await supabase
          .from('sync_status')
          .update({ 
            status: 'completed', 
            updated_at: new Date().toISOString(),
            retry_count: retryCount,
            error_message: null
          })
          .eq('user_id', userId)
          .eq('month', month)
          .eq('year', year)

        console.log(`✓ Completed: ${userId} - ${month} ${year} (attempt ${retryCount + 1})`)
        
        return { month, year, status: 'completed' }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`✗ Failed: ${userId} - ${month} ${year} (attempt ${retryCount + 1})`, errorMessage)
        
        // Check error types that should trigger retry
        // Timeout can be in message or in error object code
        const isTimeout = errorMessage.includes('aborted') || 
                         errorMessage.includes('timeout') ||
                         errorMessage.includes('57014') || // PostgreSQL statement timeout
                         errorMessage.includes('canceling statement due to statement timeout') ||
                         (typeof error === 'object' && error !== null && 'code' in error && error.code === '57014')
        
        // Deadlock can be in message or in error object code
        const isDeadlock = errorMessage.includes('40P01') || // PostgreSQL deadlock code
                          errorMessage.includes('deadlock detected') ||
                          (typeof error === 'object' && error !== null && 'code' in error && error.code === '40P01')
        
        const isServerError = errorMessage.includes('500')
        
        // Retry logic - retry on timeouts, deadlocks, or server errors
        if (retryCount < MAX_RETRIES && (isTimeout || isDeadlock || isServerError)) {
          const retryReason = isDeadlock ? 'deadlock' : isTimeout ? 'timeout' : 'server error'
          console.log(`⏳ Retrying ${month} ${year} due to ${retryReason} in ${RETRY_DELAY}ms... (${MAX_RETRIES - retryCount} retries left)`)
          
          // Update status to show retry pending
          await supabase
            .from('sync_status')
            .update({ 
              status: 'retrying',
              retry_count: retryCount + 1,
              error_message: `Retry ${retryCount + 1} (${retryReason}): ${errorMessage}`
            })
            .eq('user_id', userId)
            .eq('month', month)
            .eq('year', year)
          
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          return processMonth(month, year, retryCount + 1)
        }
        
        // Mark as failed after all retries exhausted
        await supabase
          .from('sync_status')
          .update({ 
            status: 'failed', 
            updated_at: new Date().toISOString(),
            retry_count: retryCount,
            error_message: errorMessage
          })
          .eq('user_id', userId)
          .eq('month', month)
          .eq('year', year)

        return { month, year, status: 'failed', error: errorMessage }
      }
    }

    // Process months with concurrency limit
    // Note: Months are processed in reverse chronological order (newest first)
    // This ensures most relevant/recent data is synced first
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
      maxRetries: MAX_RETRIES,
    })
  } catch (error) {
    console.error('trigger-sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}