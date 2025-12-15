// supabase/functions/sync_barber_clients/index.ts

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

    // Get current year and calculate years to sync (past 1 year so loops 2 years total) -- Changed to 1 year now but can edit later
    const currentYear = new Date().getFullYear()
    const startYear = currentYear  // - 1  // 2025 - 2 = 2023
    const yearsToSync = []
    
    for (let year = startYear; year <= currentYear; year++) {
      yearsToSync.push(year)
    }

    console.log(`STARTING CLIENT SYNC FOR ${tokens?.length || 0} USERS across years ${startYear}-${currentYear}. CURRENT TIME: ${new Date()}`)
    
    const CONCURRENCY_LIMIT = 50

    // Build all requests to be made (one per user per year)
    const allRequests: { userId: string; year: number }[] = []
    
    for (const tokenItem of tokens || []) {
      for (const year of yearsToSync) {
        allRequests.push({
          userId: tokenItem.user_id,
          year
        })
      }
    }

    console.log(`Total requests to make: ${allRequests.length} (${tokens?.length || 0} users × ${yearsToSync.length} years)`)

    async function fireWithConcurrency(items, limit) {
      let active = 0
      let index = 0

      return new Promise(resolve => {
        function next() {
          while (active < limit && index < items.length) {
            const request = items[index++]
            active++

            const url = `https://shearwork-web.vercel.app/api/acuity/pull-clients?year=${request.year}`
            
            fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-User-Id': request.userId,
                'x-vercel-protection-bypass': BYPASS_TOKEN
              }
            })
              .then(response => {
                if (!response.ok) {
                  return response.text().then(errorText => {
                    console.error(`✗ ${request.userId} - Year ${request.year}: ${errorText}`)
                  })
                } else {
                  return response.json().then(data => {
                    console.log(`✓ ${request.userId} - Year ${request.year}: ${data.totalClients} clients synced`)
                  })
                }
              })
              .catch(err => console.error(`Error for ${request.userId} - Year ${request.year}:`, err))
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

    console.log(`All client sync requests dispatched (with concurrency limit ${CONCURRENCY_LIMIT})`)
    console.log(`CLIENT SYNC ENDED. CURRENT TIME: ${new Date()}`)

    return new Response(JSON.stringify({ 
      success: true,
      usersProcessed: tokens?.length || 0,
      yearsProcessed: yearsToSync,
      totalRequests: allRequests.length
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})