import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Retry configuration - NO MAX RETRIES, infinite retries until success
const PRIORITY_RETRY_DELAY = 6000 // 6 seconds for priority months
const BACKGROUND_RETRY_DELAY_BASE = 2000 // Base 2 seconds for background, exponential backoff
const BACKGROUND_RETRY_DELAY_MAX = 30000 // Max 30 seconds for background
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

    const monthsToSync: { month: string; year: number; phase: 'priority' | 'background' }[] = []
    let iterDate = new Date(startDate)

    while (
      iterDate.getFullYear() < currentYear ||
      (iterDate.getFullYear() === currentYear && iterDate.getMonth() <= currentMonth)
    ) {
      monthsToSync.push({
        month: MONTHS[iterDate.getMonth()],
        year: iterDate.getFullYear(),
        phase: 'background', // Will be updated below
      })
      iterDate.setMonth(iterDate.getMonth() + 1)
    }

    // Reverse order - most recent months first
    monthsToSync.reverse()

    // Determine priority vs background phases
    // Priority = last 12 months (or all months if < 12 months of data)
    const priorityCount = Math.min(12, monthsToSync.length)
    for (let i = 0; i < priorityCount; i++) {
      monthsToSync[i].phase = 'priority'
    }

    console.log(`📊 Sync plan: ${priorityCount} priority months, ${monthsToSync.length - priorityCount} background months`)

    // Create sync_status rows with phase information
    const syncStatusRows = monthsToSync.map(({ month, year, phase }) => ({
      user_id: userId,
      month,
      year,
      status: 'pending',
      sync_phase: phase,
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

    const BYPASS_TOKEN = process.env.BYPASS_TOKEN!
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Calculate retry delay with exponential backoff for background syncs
    const getRetryDelay = (phase: 'priority' | 'background', retryCount: number): number => {
      if (phase === 'priority') {
        return PRIORITY_RETRY_DELAY // Fixed 6 seconds
      }

      // Background: exponential backoff starting at 2s, max 30s
      const delay = BACKGROUND_RETRY_DELAY_BASE * Math.pow(2, retryCount)
      return Math.min(delay, BACKGROUND_RETRY_DELAY_MAX)
    }

    // Function to process a single month with INFINITE retry logic
    const processMonth = async (
      month: string,
      year: number,
      phase: 'priority' | 'background',
      retryCount = 0
    ): Promise<any> => {
      try {
        const attemptLabel = retryCount === 0 ? 'initial attempt' : `retry #${retryCount}`
        console.log(`🚀 Starting sync [${phase}]: ${userId} - ${month} ${year} (${attemptLabel})`)

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

        console.log(`[${phase}] Response status for ${month} ${year}: ${response.status} ${response.statusText}`)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[${phase}] HTTP error ${response.status} for ${month} ${year}:`, errorText)
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        // Clone response to read it twice (for debugging)
        const responseClone = response.clone()
        const rawText = await responseClone.text()
        console.log(`[${phase}] Raw response length for ${month} ${year}:`, rawText.length, 'chars')
        console.log(`[${phase}] Raw response preview:`, rawText.substring(0, 300))

        // Check response body for errors (API may return 200 with error in body)
        let data
        try {
          data = await response.json()
        } catch (parseError) {
          console.error(`[${phase}] JSON parse error for ${month} ${year}:`, parseError)
          console.error(`[${phase}] Raw response was:`, rawText)
          throw new Error('Failed to parse response from pull endpoint')
        }

        console.log(`[${phase}] Pull response for ${month} ${year}:`, { success: data.success, hasError: !!data.error, errorType: typeof data.error })

        // Only fail if there's an explicit error, not just missing success field
        if (data.error) {
          // Extract error details if available
          let errorDetail = 'Unknown error from pull endpoint'

          if (typeof data.error === 'string') {
            errorDetail = data.error
          } else if (typeof data.error === 'object') {
            // Handle PostgreSQL error objects
            if (data.error.message) {
              errorDetail = data.error.message
            } else if (data.error.code) {
              errorDetail = `DB Error ${data.error.code}: ${data.error.details || data.error.hint || 'Database error'}`
            } else {
              errorDetail = JSON.stringify(data.error)
            }
          }

          console.error(`[${phase}] Pull endpoint error for ${month} ${year}:`, data.error)
          throw new Error(errorDetail)
        }

        // If no error and success is explicitly false, that's also an error
        if (data.success === false) {
          console.error(`[${phase}] Pull endpoint returned success=false for ${month} ${year}`)
          throw new Error('Pull endpoint returned success: false')
        }

        // If we get here, consider it successful (even if success field is missing)
        console.log(`✓ Pull successful for ${month} ${year} (success: ${data.success})`)

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

        console.log(`✓ Completed [${phase}]: ${userId} - ${month} ${year} (after ${retryCount} retries)`)

        return { month, year, phase, status: 'completed' }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`✗ Failed [${phase}]: ${userId} - ${month} ${year} (attempt ${retryCount + 1})`, errorMessage)

        // Check error types
        const isTimeout = errorMessage.includes('aborted') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('57014') ||
          errorMessage.includes('canceling statement due to statement timeout') ||
          (typeof error === 'object' && error !== null && 'code' in error && error.code === '57014')

        const isDeadlock = errorMessage.includes('40P01') ||
          errorMessage.includes('deadlock detected') ||
          (typeof error === 'object' && error !== null && 'code' in error && error.code === '40P01')

        const isServerError = errorMessage.includes('500')

        // INFINITE RETRY - Always retry on timeout, deadlock, or server errors
        if (isTimeout || isDeadlock || isServerError) {
          const retryReason = isDeadlock ? 'deadlock' : isTimeout ? 'timeout' : 'server error'
          const retryDelay = getRetryDelay(phase, retryCount)

          console.log(`⏳ Retrying [${phase}] ${month} ${year} due to ${retryReason} in ${retryDelay}ms... (retry #${retryCount + 1})`)

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

          await new Promise(resolve => setTimeout(resolve, retryDelay))
          return processMonth(month, year, phase, retryCount + 1)
        }

        // For non-retryable errors, mark as failed
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

        return { month, year, phase, status: 'failed', error: errorMessage }
      }
    }

    // PHASE 1: Process priority months first (concurrency = 6)
    const processPriorityMonths = async () => {
      const priorityMonths = monthsToSync.filter(m => m.phase === 'priority')
      if (priorityMonths.length === 0) return []

      const PRIORITY_CONCURRENCY = 6
      console.log(`🎯 Starting PRIORITY phase: ${priorityMonths.length} months (concurrency = ${PRIORITY_CONCURRENCY})`)

      const results: any[] = []
      // Semaphore pattern: chain work onto fixed slots to avoid concurrency pool bugs
      const semaphore = new Array(PRIORITY_CONCURRENCY).fill(Promise.resolve())
      let slotIndex = 0

      for (const { month, year, phase } of priorityMonths) {
        const slot = slotIndex % PRIORITY_CONCURRENCY
        slotIndex++

        semaphore[slot] = semaphore[slot].then(() =>
          processMonth(month, year, phase).then(result => {
            results.push(result)
            return result
          })
        )
      }

      await Promise.all(semaphore)
      return results
    }

    // PHASE 2: Process background months after priority (concurrency = 4)
    const processBackgroundMonths = async () => {
      const backgroundMonths = monthsToSync.filter(m => m.phase === 'background')
      if (backgroundMonths.length === 0) return []

      const BACKGROUND_CONCURRENCY = 4
      console.log(`📦 Starting BACKGROUND phase: ${backgroundMonths.length} months (concurrency = ${BACKGROUND_CONCURRENCY})`)

      const results: any[] = []
      // Semaphore pattern: chain work onto fixed slots to avoid concurrency pool bugs
      const semaphore = new Array(BACKGROUND_CONCURRENCY).fill(Promise.resolve())
      let slotIndex = 0

      for (const { month, year, phase } of backgroundMonths) {
        const slot = slotIndex % BACKGROUND_CONCURRENCY
        slotIndex++

        semaphore[slot] = semaphore[slot].then(() =>
          processMonth(month, year, phase).then(result => {
            results.push(result)
            return result
          })
        )
      }

      await Promise.all(semaphore)
      return results
    }

    // Start both phases in sequence (priority first, then background)
    const startSyncSequence = async () => {
      try {
        // Phase 1: Priority months (blocking)
        await processPriorityMonths()
        console.log('✅ PRIORITY phase complete')

        // Phase 2: Background months
        const backgroundResults = await processBackgroundMonths()
        console.log('✅ BACKGROUND phase complete')

        // Send notification when ALL data is synced
        const allSuccessful = backgroundResults.every(r => r.status === 'completed')
        if (allSuccessful) {
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              user_id: userId,
              header: 'Acuity data fully synced',
              message: "Your data from Acuity has been completely synced. Please refresh to ensure that you're seeing the latest data",
              reference_type: 'sync_completed',
            })

          if (notificationError) {
            console.error('Failed to create notification:', notificationError)
          } else {
            console.log('📬 Notification sent: Full sync complete')
          }
        }
      } catch (err) {
        console.error('Sync sequence error:', err)
      }
    }

    // Start processing in the background (don't await)
    startSyncSequence().catch(err => {
      console.error('Background sync error:', err)
    })

    const priorityMonthsCount = monthsToSync.filter(m => m.phase === 'priority').length
    const backgroundMonthsCount = monthsToSync.filter(m => m.phase === 'background').length

    return NextResponse.json({
      success: true,
      message: 'Sync started',
      totalMonths: monthsToSync.length,
      priorityMonths: priorityMonthsCount,
      backgroundMonths: backgroundMonthsCount,
      priorityConcurrency: 6,
      backgroundConcurrency: 4,
    })
  } catch (error) {
    console.error('trigger-sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}