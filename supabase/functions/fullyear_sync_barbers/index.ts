// supabase/functions/fullyear_sync_barbers/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

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

Deno.serve(async (req) => {
  try {
    const BYPASS_TOKEN = Deno.env.get('BYPASS_TOKEN') ?? ''
    const token = Deno.env.get("SERVICE_ROLE_KEY") ?? ''

    // Get current year and define year range to sync
    const currentYear = new Date().getFullYear()
    const startYear = 2023
    const yearsToSync = []
    
    for (let year = startYear; year <= currentYear; year++) {
      yearsToSync.push(year)
    }

    console.log(`STARTING SYNC FOR ${tokens?.length || 0} USERS. CURRENT TIME: ${new Date()}`)
    
    const CONCURRENCY_LIMIT = 10 // Reduced since we're doing full years now

    // Build all requests (one per user per year)
    const allRequests: { userId: string; year: number }[] = []
    
    for (const tokenItem of tokens || []) {
      for (const year of yearsToSync) {
        allRequests.push({
          userId: tokenItem.user_id,
          year
        })
      }
    }

    console.log(`Total requests to make: ${allRequests.length}`)

    async function fireWithConcurrency(items, limit) {
      let active = 0
      let index = 0
      const results = {
        success: 0,
        failed: 0
      }

      return new Promise(resolve => {
        function next() {
          while (active < limit && index < items.length) {
            const request = items[index++]
            active++

            const url = `https://shearwork-web.vercel.app/api/acuity/pull-year?year=${request.year}`
            
            console.log(`🔄 Starting: ${request.userId} - Year ${request.year}`)
            
            fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-User-Id': request.userId,
                'x-vercel-protection-bypass': BYPASS_TOKEN
              }
            })
              .then(async response => {
                if (!response.ok) {
                  const errorText = await response.text()
                  console.error(`✗ ${request.userId} - Year ${request.year}: ${response.status} ${errorText}`)
                  results.failed++
                } else {
                  const data = await response.json()
                  console.log(`✓ ${request.userId} - Year ${request.year}: ${data.totalClients || 0} clients, ${data.totalAppointments || 0} appointments`)
                  results.success++
                }
              })
              .catch(err => {
                console.error(`Error for ${request.userId} - Year ${request.year}:`, err)
                results.failed++
              })
              .finally(() => {
                active--
                next()
              })
          }

          if (active === 0 && index >= items.length) {
            console.log(`\n📊 RESULTS: ${results.success} succeeded, ${results.failed} failed`)
            resolve(results)
          }
        }

        next()
      })
    }

    await fireWithConcurrency(allRequests, CONCURRENCY_LIMIT)

    console.log(`SYNC ENDED. CURRENT TIME: ${new Date()}`)

    return new Response(JSON.stringify({ 
      message: 'Sync completed',
      totalRequests: allRequests.length
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})