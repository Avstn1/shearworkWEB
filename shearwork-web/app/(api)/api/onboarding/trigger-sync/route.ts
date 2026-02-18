import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const PRIORITY_RETRY_DELAY = 6000
const BACKGROUND_RETRY_DELAY_BASE = 2000
const BACKGROUND_RETRY_DELAY_MAX = 30000
const REQUEST_TIMEOUT = 40000  // 40s — must be less than SLOT_TIMEOUT
const SLOT_TIMEOUT = 45000     // 45s — wraps the ENTIRE attempt including all Supabase calls

// Wraps any promise with a timeout. If the promise doesn't resolve in time,
// rejects with a descriptive error so we know exactly which operation hung.
const withTimeout = <T>(
  promiseLike: PromiseLike<T>,
  ms: number,
  label: string
): Promise<T> => {
  const promise = Promise.resolve(promiseLike) // Normalize PromiseLike → Promise
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`HUNG: ${label} did not resolve within ${ms}ms`))
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const { userId, startMonth, startYear } = await request.json()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!userId || !startYear) {
      return NextResponse.json({ error: 'Missing userId or startYear' }, { status: 400 })
    }

    if (user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { data: acuityToken } = await supabase
      .from('acuity_tokens')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!acuityToken) {
      return NextResponse.json({ error: 'No Acuity integration found for this user' }, { status: 404 })
    }

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    let startDate: Date
    if (startMonth) {
      const startMonthIndex = MONTHS.indexOf(startMonth)
      startDate = new Date(startYear, startMonthIndex, 1)
    } else {
      startDate = new Date(startYear, 0, 1)
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
        phase: 'background',
      })
      iterDate.setMonth(iterDate.getMonth() + 1)
    }

    monthsToSync.reverse()

    const priorityCount = Math.min(12, monthsToSync.length)
    for (let i = 0; i < priorityCount; i++) {
      monthsToSync[i].phase = 'priority'
    }

    console.log(`📊 [trigger-sync] Sync plan: ${priorityCount} priority, ${monthsToSync.length - priorityCount} background`)
    console.log(`📊 [trigger-sync] Priority months: ${monthsToSync.filter(m => m.phase === 'priority').map(m => `${m.month} ${m.year}`).join(', ')}`)

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
      .upsert(syncStatusRows, { onConflict: 'user_id,month,year', ignoreDuplicates: false })

    if (insertError) {
      console.error('[trigger-sync] Error inserting sync_status:', insertError)
      throw insertError
    }

    const BYPASS_TOKEN = process.env.BYPASS_TOKEN!
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const getRetryDelay = (phase: 'priority' | 'background', retryCount: number): number => {
      if (phase === 'priority') return PRIORITY_RETRY_DELAY
      return Math.min(BACKGROUND_RETRY_DELAY_BASE * Math.pow(2, retryCount), BACKGROUND_RETRY_DELAY_MAX)
    }

    const processMonth = async (
      month: string,
      year: number,
      phase: 'priority' | 'background',
      retryCount = 0
    ): Promise<any> => {
      const tag = `[${phase}][${month} ${year}][attempt ${retryCount + 1}]`
      console.log(`\n${'='.repeat(60)}`)
      console.log(`🚀 ${tag} START`)
      console.log(`${'='.repeat(60)}`)

      // Slot timeout wraps the ENTIRE attempt — Supabase calls, fetch, everything
      let slotTimeoutId!: ReturnType<typeof setTimeout>
      const slotTimeoutPromise = new Promise<never>((_, reject) => {
        slotTimeoutId = setTimeout(() => {
          console.error(`⏰ ${tag} SLOT TIMEOUT FIRED after ${SLOT_TIMEOUT}ms — something hung and never resolved`)
          reject(new Error('slot timeout after 45s'))
        }, SLOT_TIMEOUT)
      })

      const attempt = async (): Promise<any> => {
        try {
          // ── STEP 1: Mark as processing ──────────────────────────────────
          console.log(`📝 ${tag} STEP 1: Updating sync_status to 'processing'...`)
          await withTimeout(
            supabase
              .from('sync_status')
              .update({ status: 'processing', updated_at: new Date().toISOString(), retry_count: retryCount })
              .eq('user_id', userId)
              .eq('month', month)
              .eq('year', year)
              .then(),
            10000,
            `${tag} sync_status update to processing`
          )
          console.log(`✅ ${tag} STEP 1 done`)

          // ── STEP 2: Call pull endpoint ──────────────────────────────────
          const targetUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/pull?granularity=month&month=${encodeURIComponent(month)}&year=${year}`
          console.log(`🌐 ${tag} STEP 2: Fetching ${targetUrl}`)

          const controller = new AbortController()
          const fetchTimeoutId = setTimeout(() => {
            console.error(`⏰ ${tag} fetch AbortController fired after ${REQUEST_TIMEOUT}ms`)
            controller.abort()
          }, REQUEST_TIMEOUT)

          let response: Response
          try {
            response = await fetch(targetUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'X-User-Id': userId,
                'x-vercel-protection-bypass': BYPASS_TOKEN,
              },
              signal: controller.signal
            })
          } finally {
            clearTimeout(fetchTimeoutId)
          }

          console.log(`📡 ${tag} STEP 2: Response received — status ${response.status} ${response.statusText}`)

          if (!response.ok) {
            const errorText = await response.text()
            console.error(`❌ ${tag} STEP 2: HTTP error ${response.status}:`, errorText)
            throw new Error(`HTTP ${response.status}: ${errorText}`)
          }

          // ── STEP 3: Parse response ──────────────────────────────────────
          console.log(`🔍 ${tag} STEP 3: Reading response body...`)
          const rawText = await response.text()
          console.log(`📄 ${tag} STEP 3: Body length: ${rawText.length} chars`)
          console.log(`📄 ${tag} STEP 3: Body preview: ${rawText.substring(0, 300)}`)

          let data
          try {
            data = JSON.parse(rawText)
          } catch (parseError) {
            console.error(`❌ ${tag} STEP 3: JSON parse failed:`, parseError)
            throw new Error('Failed to parse response from pull endpoint')
          }
          console.log(`✅ ${tag} STEP 3: Parsed — success=${data.success}, hasError=${!!data.error}`)

          if (data.error) {
            let errorDetail = 'Unknown error from pull endpoint'
            if (typeof data.error === 'string') {
              errorDetail = data.error
            } else if (typeof data.error === 'object') {
              if (data.error.message) errorDetail = data.error.message
              else if (data.error.code) errorDetail = `DB Error ${data.error.code}: ${data.error.details || data.error.hint || 'Database error'}`
              else errorDetail = JSON.stringify(data.error)
            }
            console.error(`❌ ${tag} STEP 3: Pull endpoint returned error:`, errorDetail)
            throw new Error(errorDetail)
          }

          if (data.success === false) {
            console.error(`❌ ${tag} STEP 3: Pull endpoint returned success=false`)
            throw new Error('Pull endpoint returned success: false')
          }

          // ── STEP 4: Mark as completed ───────────────────────────────────
          console.log(`📝 ${tag} STEP 4: Updating sync_status to 'completed'...`)
          await withTimeout(
            supabase
              .from('sync_status')
              .update({ status: 'completed', updated_at: new Date().toISOString(), retry_count: retryCount, error_message: null })
              .eq('user_id', userId)
              .eq('month', month)
              .eq('year', year)
              .then(),
            10000,
            `${tag} sync_status update to completed`
          )
          console.log(`✅ ${tag} STEP 4 done`)

          console.log(`🎉 ${tag} FULLY COMPLETE after ${retryCount} retries`)
          return { month, year, phase, status: 'completed' }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error(`\n💥 ${tag} CAUGHT ERROR: ${errorMessage}`)
          console.error(`💥 ${tag} Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)

          const isTimeout = errorMessage.includes('aborted') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('HUNG') ||
            errorMessage.includes('57014') ||
            errorMessage.includes('canceling statement due to statement timeout') ||
            errorMessage.includes('slot timeout') ||
            (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === '57014')

          const isDeadlock = errorMessage.includes('40P01') ||
            errorMessage.includes('deadlock detected') ||
            (typeof error === 'object' && error !== null && 'code' in error && (error as any).code === '40P01')

          const isServerError = errorMessage.includes('500')

          console.log(`💥 ${tag} isTimeout=${isTimeout}, isDeadlock=${isDeadlock}, isServerError=${isServerError}`)

          if (isTimeout || isDeadlock || isServerError) {
            const retryReason = isDeadlock ? 'deadlock' : isTimeout ? 'timeout/hang' : 'server error'
            const retryDelay = getRetryDelay(phase, retryCount)
            console.log(`⏳ ${tag} Will retry in ${retryDelay}ms due to: ${retryReason}`)

            // Fire-and-forget the status update — don't await it, it might also hang
            Promise.resolve(supabase
              .from('sync_status')
              .update({ status: 'retrying', retry_count: retryCount + 1, error_message: `Retry ${retryCount + 1} (${retryReason}): ${errorMessage}` })
              .eq('user_id', userId)
              .eq('month', month)
              .eq('year', year))
              .then(() => console.log(`📝 ${tag} retry status update done`))
              .catch((e: Error) => console.error(`📝 ${tag} retry status update failed (non-blocking):`, e))

            console.log(`⏳ ${tag} Waiting ${retryDelay}ms before retry...`)
            await new Promise(resolve => setTimeout(resolve, retryDelay))
            console.log(`🔁 ${tag} Retrying now as attempt ${retryCount + 2}`)
            return processMonth(month, year, phase, retryCount + 1)
          }

          // Non-retryable — fire-and-forget status update and return failed
          console.error(`🚫 ${tag} Non-retryable error, marking as failed`)
          Promise.resolve(supabase
            .from('sync_status')
            .update({ status: 'failed', updated_at: new Date().toISOString(), retry_count: retryCount, error_message: errorMessage })
            .eq('user_id', userId)
            .eq('month', month)
            .eq('year', year))
            .then(() => console.log(`📝 ${tag} failed status update done`))
            .catch((e: Error) => console.error(`📝 ${tag} failed status update error (non-blocking):`, e))

          return { month, year, phase, status: 'failed', error: errorMessage }
        }
      }

      try {
        console.log(`⏱️  ${tag} Racing attempt() against ${SLOT_TIMEOUT}ms slot timeout...`)
        const result = await Promise.race([attempt(), slotTimeoutPromise])
        console.log(`✅ ${tag} Promise.race resolved with status: ${result?.status}`)
        return result
      } finally {
        clearTimeout(slotTimeoutId)
        console.log(`🧹 ${tag} Slot timeout cleared`)
      }
    }

    // Worker pool: N workers pull from a shared queue until empty.
    const runWithWorkerPool = async (
      months: { month: string; year: number; phase: 'priority' | 'background' }[],
      concurrency: number,
      label: string
    ): Promise<any[]> => {
      const queue = [...months]
      const results: any[] = []
      let completed = 0
      const total = months.length

      console.log(`\n🏊 [${label}] Starting worker pool: ${total} months, ${concurrency} workers`)
      console.log(`🏊 [${label}] Queue: ${queue.map(m => `${m.month} ${m.year}`).join(', ')}`)

      const worker = async (workerId: number) => {
        console.log(`👷 [${label}] Worker ${workerId} started`)
        while (queue.length > 0) {
          const item = queue.shift()
          if (!item) {
            console.log(`👷 [${label}] Worker ${workerId} found empty queue, exiting`)
            break
          }
          console.log(`👷 [${label}] Worker ${workerId} picked up ${item.month} ${item.year} (${queue.length} remaining in queue)`)
          const result = await processMonth(item.month, item.year, item.phase)
          results.push(result)
          completed++
          console.log(`👷 [${label}] Worker ${workerId} finished ${item.month} ${item.year} — ${completed}/${total} total done`)
        }
        console.log(`👷 [${label}] Worker ${workerId} exiting — queue empty`)
      }

      await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i + 1)))

      console.log(`🏁 [${label}] Worker pool done. Results: ${results.map(r => `${r.month} ${r.year}=${r.status}`).join(', ')}`)
      return results
    }

    const processPriorityMonths = async () => {
      const priorityMonths = monthsToSync.filter(m => m.phase === 'priority')
      if (priorityMonths.length === 0) return []
      return runWithWorkerPool(priorityMonths, 6, 'PRIORITY')
    }

    const processBackgroundMonths = async () => {
      const backgroundMonths = monthsToSync.filter(m => m.phase === 'background')
      if (backgroundMonths.length === 0) return []
      return runWithWorkerPool(backgroundMonths, 4, 'BACKGROUND')
    }

    const startSyncSequence = async () => {
      try {
        console.log('\n🎬 [trigger-sync] Starting PRIORITY phase...')
        await processPriorityMonths()
        console.log('✅ [trigger-sync] PRIORITY phase complete\n')

        console.log('🎬 [trigger-sync] Starting BACKGROUND phase...')
        const backgroundResults = await processBackgroundMonths()
        console.log('✅ [trigger-sync] BACKGROUND phase complete\n')

        const allSuccessful = backgroundResults.every(r => r.status === 'completed')
        console.log(`📊 [trigger-sync] All background successful: ${allSuccessful}`)

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
            console.error('[trigger-sync] Failed to create notification:', notificationError)
          } else {
            console.log('📬 [trigger-sync] Notification sent: Full sync complete')
          }
        }
      } catch (err) {
        console.error('[trigger-sync] Sync sequence error:', err)
      }
    }

    startSyncSequence().catch(err => {
      console.error('[trigger-sync] Background sync error:', err)
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
    console.error('[trigger-sync] Top-level error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}