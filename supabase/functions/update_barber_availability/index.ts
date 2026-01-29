// supabase/functions/daily_availability_pull/index.ts

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
  Deno.env.get("SERVICE_ROLE_KEY") ?? '', 
)

const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL")

Deno.serve(async (_req) => {
  try {
    const BYPASS_TOKEN = Deno.env.get('BYPASS_TOKEN') ?? ''
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? ''

    // Get current date
    const now = new Date()
    console.log(`STARTING AVAILABILITY PULL. CURRENT TIME: ${now}`)
    
    const CONCURRENCY_LIMIT = 100

    // Get all profiles with a calendar set
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, calendar, full_name')
      .not('calendar', 'is', null)
      .neq('calendar', '')

    if (profileError) throw profileError

    console.log(`Users to pull availability for: ${profiles?.length || 0}`)

    // Build all requests to be made (one per user)
    const allRequests: { userId: string; fullName: string }[] = []
    
    for (const profile of profiles || []) {
      allRequests.push({
        userId: profile.user_id,
        fullName: profile.full_name || 'Unknown'
      })
    }

    const results: { userId: string; fullName: string; success: boolean; error?: string; data?: unknown }[] = []

    async function fireWithConcurrency(items: typeof allRequests, limit: number) {
      let active = 0
      let index = 0

      return new Promise<void>(resolve => {
        function next() {
          while (active < limit && index < items.length) {
            const request = items[index++]
            active++

            const url = `${siteUrl}/api/availability/pull?forceRefresh=true&dryRun=false`
            
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
                  console.error(`✗ ${request.fullName} (${request.userId}): ${errorText}`)
                  results.push({ 
                    userId: request.userId, 
                    fullName: request.fullName,
                    success: false, 
                    error: errorText 
                  })
                } else {
                  const data = await response.json()
                  console.log(`✓ ${request.fullName} (${request.userId}): ${data.slotsUpserted || 0} slots upserted`)
                  results.push({ 
                    userId: request.userId,
                    fullName: request.fullName,
                    success: true, 
                    data 
                  })
                }
              })
              .catch(err => {
                console.error(`Error for ${request.fullName} (${request.userId}):`, err)
                results.push({ 
                  userId: request.userId,
                  fullName: request.fullName,
                  success: false, 
                  error: String(err) 
                })
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
      message: 'Availability pull completed',
      totalUsers: allRequests.length,
      success: successCount,
      failed: failCount,
      errors: results.filter(r => !r.success).map(r => ({ 
        userId: r.userId,
        fullName: r.fullName,
        error: r.error 
      })),
      successfulPulls: results.filter(r => r.success).map(r => ({
        userId: r.userId,
        fullName: r.fullName,
        slotsUpserted: r.data?.slotsUpserted || 0
      }))
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