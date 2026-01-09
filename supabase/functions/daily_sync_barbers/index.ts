// supabase/functions/daily_sync_barbers/index.ts

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
  Deno.env.get("SERVICE_ROLE_KEY") ?? '', 
)

// Get all users with Acuity tokens
const { data: tokens, error: tokenError } = await supabase
  .from('acuity_tokens')
  .select('user_id')

if (tokenError) throw tokenError
console.log('Users with Acuity tokens:', tokens)

Deno.serve(async (_req) => {
  try {
    const BYPASS_TOKEN = Deno.env.get('BYPASS_TOKEN') ?? ''
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? ''

    // Get current date
    const now = new Date()
    const currentMonth = MONTHS[now.getMonth()]
    const currentYear = now.getFullYear()

    console.log(`STARTING SYNC FOR ${tokens?.length || 0} USERS. CURRENT TIME: ${now}`)
    console.log(`Syncing: ${currentMonth} ${currentYear}`)
    
    const CONCURRENCY_LIMIT = 100

    // Filter users who have a calendar set
    const userIds = tokens?.map((t: { user_id: string }) => t.user_id) || []
    
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, calendar')
      .in('user_id', userIds)
      .not('calendar', 'is', null)
      .neq('calendar', '')

    if (profileError) throw profileError

    const validUserIds = new Set(profiles?.map((p: { user_id: string }) => p.user_id) || [])
    const validTokens = tokens?.filter((t: { user_id: string }) => validUserIds.has(t.user_id)) || []

    console.log(`Users to sync: ${validTokens.length} (${tokens?.length || 0} total with tokens, ${(tokens?.length || 0) - validTokens.length} without calendar)`)

    // Build all requests to be made (one per user for current month)
    const allRequests: { userId: string; month: string; year: number }[] = []
    
    for (const tokenItem of validTokens) {
      allRequests.push({
        userId: tokenItem.user_id,
        month: currentMonth,
        year: currentYear
      })
    }

    const results: { userId: string; success: boolean; error?: string; data?: unknown }[] = []

    async function fireWithConcurrency(items: typeof allRequests, limit: number) {
      let active = 0
      let index = 0

      return new Promise<void>(resolve => {
        function next() {
          while (active < limit && index < items.length) {
            const request = items[index++]
            active++

            // Use new /api/pull endpoint with month granularity
            const url = `https://shearwork-web.vercel.app/api/pull?granularity=month&month=${encodeURIComponent(request.month)}&year=${request.year}`
            
            fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'X-User-Id': request.userId,
                'x-vercel-protection-bypass': BYPASS_TOKEN,
              }
            })
              .then(async response => {
                if (!response.ok) {
                  const errorText = await response.text()
                  console.error(`✗ ${request.userId} - ${request.month} ${request.year}: ${errorText}`)
                  results.push({ userId: request.userId, success: false, error: errorText })
                } else {
                  const data = await response.json()
                  console.log(`✓ ${request.userId} - ${request.month} ${request.year}: ${data.result?.appointmentCount || 0} appointments, ${data.result?.clients?.totalProcessed || 0} clients`)
                  results.push({ userId: request.userId, success: true, data })
                }
              })
              .catch(err => {
                console.error(`Error for ${request.userId} - ${request.month} ${request.year}:`, err)
                results.push({ userId: request.userId, success: false, error: String(err) })
              })
              .finally(() => {
                active--
                next()
              })
          }

          if (active === 0 && index >= items.length) resolve()
        }

        next()
      })
    }

    await fireWithConcurrency(allRequests, CONCURRENCY_LIMIT)

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`All requests completed. Success: ${successCount}, Failed: ${failCount}`)
    console.log(`SYNC ENDED. CURRENT TIME: ${new Date()}`)

    return new Response(JSON.stringify({ 
      message: 'Current month sync completed',
      month: currentMonth,
      year: currentYear,
      totalUsers: allRequests.length,
      success: successCount,
      failed: failCount,
      errors: results.filter(r => !r.success).map(r => ({ userId: r.userId, error: r.error }))
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: unknown) {
    console.error('Edge function error:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})