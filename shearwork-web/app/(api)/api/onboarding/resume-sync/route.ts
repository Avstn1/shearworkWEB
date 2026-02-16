import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// Same retry configuration as trigger-sync
const PRIORITY_RETRY_DELAY = 6000 // 6 seconds for priority months
const BACKGROUND_RETRY_DELAY_BASE = 2000 // Base 2 seconds for background
const BACKGROUND_RETRY_DELAY_MAX = 30000 // Max 30 seconds
const REQUEST_TIMEOUT = 120000 // 2 minutes

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

    // Get all incomplete syncs (pending, processing, retrying, or failed)
    const { data: incompleteSyncs, error: fetchError } = await supabase
      .from('sync_status')
      .select('month, year, sync_phase, status, retry_count')
      .eq('user_id', userId)
      .in('status', ['pending', 'processing', 'retrying', 'failed'])
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (fetchError) {
      throw fetchError
    }

    if (!incompleteSyncs || incompleteSyncs.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No incomplete syncs to resume',
        resumedCount: 0
      })
    }

    console.log(`🔄 Resuming ${incompleteSyncs.length} incomplete syncs for user ${userId}`)

    // Reset failed syncs to pending
    const { error: resetError } = await supabase
      .from('sync_status')
      .update({ 
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'failed')

    if (resetError) {
      console.error('Error resetting failed syncs:', resetError)
    }

    const BYPASS_TOKEN = process.env.BYPASS_TOKEN!
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // Calculate retry delay with exponential backoff
    const getRetryDelay = (phase: 'priority' | 'background', retryCount: number): number => {
      if (phase === 'priority') {
        return PRIORITY_RETRY_DELAY
      }
      
      const delay = BACKGROUND_RETRY_DELAY_BASE * Math.pow(2, retryCount)
      return Math.min(delay, BACKGROUND_RETRY_DELAY_MAX)
    }

    // Function to process a single month with INFINITE retry logic
    const processMonth = async (
      month: string, 
      year: number, 
      phase: 'priority' | 'background',
      initialRetryCount = 0
    ): Promise<any> => {
      let retryCount = initialRetryCount
      
      try {
        const attemptLabel = retryCount === 0 ? 'resume attempt' : `retry #${retryCount}`
        console.log(`🔄 Resuming sync [${phase}]: ${userId} - ${month} ${year} (${attemptLabel})`)
        
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
        
        // Check response body for errors
        const data = await response.json()
        if (data.error || !data.success) {
          // Extract error details if available
          let errorDetail = 'Unknown error from pull endpoint'
          
          if (data.error) {
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
          }
          
          console.error(`Pull endpoint error for ${month} ${year}:`, data.error)
          throw new Error(errorDetail)
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

        console.log(`✓ Resume completed [${phase}]: ${userId} - ${month} ${year}`)
        
        return { month, year, phase, status: 'completed' }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`✗ Resume failed [${phase}]: ${userId} - ${month} ${year}`, errorMessage)
        
        const isTimeout = errorMessage.includes('aborted') || 
                         errorMessage.includes('timeout') ||
                         errorMessage.includes('57014') || 
                         errorMessage.includes('canceling statement due to statement timeout') ||
                         (typeof error === 'object' && error !== null && 'code' in error && error.code === '57014')
        
        const isDeadlock = errorMessage.includes('40P01') || 
                          errorMessage.includes('deadlock detected') ||
                          (typeof error === 'object' && error !== null && 'code' in error && error.code === '40P01')
        
        const isServerError = errorMessage.includes('500')
        
        // INFINITE RETRY
        if (isTimeout || isDeadlock || isServerError) {
          const retryReason = isDeadlock ? 'deadlock' : isTimeout ? 'timeout' : 'server error'
          const retryDelay = getRetryDelay(phase, retryCount)
          
          console.log(`⏳ Re-retrying [${phase}] ${month} ${year} due to ${retryReason} in ${retryDelay}ms...`)
          
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
        
        // Mark as failed for non-retryable errors
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

    // Separate priority and background syncs
    const prioritySyncs = incompleteSyncs.filter(s => s.sync_phase === 'priority')
    const backgroundSyncs = incompleteSyncs.filter(s => s.sync_phase === 'background')

    // Process priority syncs first
    const processPrioritySyncs = async () => {
      if (prioritySyncs.length === 0) return []

      console.log(`🎯 Resuming PRIORITY syncs: ${prioritySyncs.length} months`)

      const results: any[] = []
      const executing: Promise<any>[] = []
      const PRIORITY_CONCURRENCY = 3

      for (const sync of prioritySyncs) {
        const promise = processMonth(
          sync.month, 
          sync.year, 
          'priority',
          sync.retry_count || 0
        ).then(result => {
          executing.splice(executing.indexOf(promise), 1)
          return result
        })

        results.push(promise)
        executing.push(promise)

        if (executing.length >= PRIORITY_CONCURRENCY) {
          await Promise.race(executing)
        }
      }

      return Promise.all(results)
    }

    // Process background syncs
    const processBackgroundSyncs = async () => {
      if (backgroundSyncs.length === 0) return []

      console.log(`📦 Resuming BACKGROUND syncs: ${backgroundSyncs.length} months`)

      const results: any[] = []
      const executing: Promise<any>[] = []
      const BACKGROUND_CONCURRENCY = 4

      for (const sync of backgroundSyncs) {
        const promise = processMonth(
          sync.month, 
          sync.year, 
          'background',
          sync.retry_count || 0
        ).then(result => {
          executing.splice(executing.indexOf(promise), 1)
          return result
        })

        results.push(promise)
        executing.push(promise)

        if (executing.length >= BACKGROUND_CONCURRENCY) {
          await Promise.race(executing)
        }
      }

      return Promise.all(results)
    }

    // Start both phases in sequence
    const resumeSyncSequence = async () => {
      try {
        await processPrioritySyncs()
        console.log('✅ PRIORITY resume complete')

        const backgroundResults = await processBackgroundSyncs()
        console.log('✅ BACKGROUND resume complete')

        // Check if ALL syncs are now complete (not just resumed ones)
        const { data: allSyncs } = await supabase
          .from('sync_status')
          .select('status')
          .eq('user_id', userId)

        const allComplete = allSyncs?.every(s => s.status === 'completed') || false

        if (allComplete) {
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
        console.error('Resume sequence error:', err)
      }
    }

    // Start processing in the background
    resumeSyncSequence().catch(err => {
      console.error('Background resume error:', err)
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Resuming incomplete syncs',
      resumedCount: incompleteSyncs.length,
      priorityCount: prioritySyncs.length,
      backgroundCount: backgroundSyncs.length,
    })
  } catch (error) {
    console.error('resume-sync error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}