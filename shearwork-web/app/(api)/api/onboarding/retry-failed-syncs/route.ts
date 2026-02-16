import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Retry configuration (same as trigger-sync)
const MAX_RETRIES = 3
const RETRY_DELAY = 2000
const REQUEST_TIMEOUT = 120000

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { userId } = await request.json()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
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

    // Get all failed syncs
    const { data: failedSyncs, error: fetchError } = await supabase
      .from('sync_status')
      .select('month, year')
      .eq('user_id', userId)
      .eq('status', 'failed')

    if (fetchError) {
      throw fetchError
    }

    if (!failedSyncs || failedSyncs.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No failed syncs to retry',
        retriedCount: 0
      })
    }

    // Reset them to pending
    const { error: updateError } = await supabase
      .from('sync_status')
      .update({ 
        status: 'pending', 
        retry_count: 0,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'failed')

    if (updateError) {
      throw updateError
    }

    const CONCURRENCY_LIMIT = 6
    const BYPASS_TOKEN = process.env.BYPASS_TOKEN!
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Function to process a single month with retry logic
    const processMonth = async (month: string, year: number, retryCount = 0): Promise<any> => {
      try {
        console.log(`🔄 Retrying sync: ${userId} - ${month} ${year} (attempt ${retryCount + 1}/${MAX_RETRIES + 1})`)
        
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

        console.log(`✓ Retry completed: ${userId} - ${month} ${year}`)
        
        return { month, year, status: 'completed' }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`✗ Retry failed: ${userId} - ${month} ${year} (attempt ${retryCount + 1})`, errorMessage)
        
        // Check error types that should trigger retry
        const isTimeout = errorMessage.includes('aborted') || 
                         errorMessage.includes('timeout') ||
                         errorMessage.includes('57014') // PostgreSQL statement timeout
        
        const isDeadlock = errorMessage.includes('40P01') || // PostgreSQL deadlock
                          errorMessage.includes('deadlock detected')
        
        const isServerError = errorMessage.includes('500')
        
        // Retry logic - retry on timeouts, deadlocks, or server errors
        if (retryCount < MAX_RETRIES && (isTimeout || isDeadlock || isServerError)) {
          const retryReason = isDeadlock ? 'deadlock' : isTimeout ? 'timeout' : 'server error'
          console.log(`⏳ Re-retrying ${month} ${year} due to ${retryReason} in ${RETRY_DELAY}ms...`)
          
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
    const processWithConcurrency = async () => {
      const results: any[] = []
      const executing: Promise<any>[] = []

      for (const { month, year } of failedSyncs) {
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

    // Start processing in the background
    processWithConcurrency().catch(err => {
      console.error('Background retry error:', err)
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Retrying failed syncs',
      retriedCount: failedSyncs.length,
      concurrencyLimit: CONCURRENCY_LIMIT,
      maxRetries: MAX_RETRIES,
    })
  } catch (error) {
    console.error('retry-failed-syncs error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}