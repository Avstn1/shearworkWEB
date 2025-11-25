// supabase/functions/sync-acuity-cron/index.ts

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

Deno.serve(async (req) => {
  try {
    const BYPASS_TOKEN = Deno.env.get('BYPASS_TOKEN') ?? ''
    const token = Deno.env.get("SERVICE_ROLE_KEY") ?? ''

    // Get current year and define year range to sync
    const currentYear = new Date().getFullYear()
    const startYear = currentYear
    const yearsToSync = []
    
    for (let year = startYear; year <= currentYear; year++) {
      yearsToSync.push(year)
    }

    console.log(`STARTING SYNC FOR ${tokens?.length || 0} USERS. CURRENT TIME: ${new Date()}`)
    
    const CONCURRENCY_LIMIT = 100

    // Build all requests to be made
    const allRequests: { userId: string; month: string; year: number }[] = []
    
    for (const tokenItem of tokens || []) {
      for (const year of yearsToSync) {
        for (const month of MONTHS) {
          allRequests.push({
            userId: tokenItem.user_id,
            month,
            year
          })
        }
      }
    }

    async function fireWithConcurrency(items, limit) {
      let active = 0
      let index = 0

      return new Promise(resolve => {
        function next() {
          while (active < limit && index < items.length) {
            const request = items[index++]
            active++

            const url = `https://shearwork-web.vercel.app/api/acuity/pull?endpoint=appointments&month=${request.month}&year=${request.year}`
            
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
                if (response.ok) {
                  console.log(`✓ ${request.userId} - ${request.month} ${request.year}`)
                } else {
                  return response.text().then(errorText => {
                    console.error(`✗ ${request.userId} - ${request.month} ${request.year}: ${errorText}`)
                  })
                }
              })
              .catch(err => console.error(`Error for ${request.userId} - ${request.month} ${request.year}:`, err))
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

    console.log(`All requests dispatched (with concurrency limit ${CONCURRENCY_LIMIT})`)
    console.log(`SYNC ENDED. CURRENT TIME: ${new Date()}`)

    return new Response(JSON.stringify({ }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})