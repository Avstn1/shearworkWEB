// supabase/functions/fullyear_sync_barbers/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Client } from 'npm:@upstash/qstash@2'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
  Deno.env.get("SERVICE_ROLE_KEY") ?? '', 
)

Deno.serve(async (req) => {
  try {
    const QSTASH_TOKEN = Deno.env.get('QSTASH_TOKEN') ?? ''
    const BYPASS_TOKEN = Deno.env.get('BYPASS_TOKEN') ?? ''
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? ''

    if (!QSTASH_TOKEN) {
      throw new Error('QSTASH_TOKEN is not set')
    }

    // Initialize QStash client
    const qstashClient = new Client({ token: QSTASH_TOKEN })

    // Check for optional user_id parameter
    const url = new URL(req.url)
    const targetUserId = url.searchParams.get('user_id')

    // Get users with Acuity tokens (filtered by user_id if provided)
    let query = supabase
      .from('acuity_tokens')
      .select('user_id')
    
    if (targetUserId) {
      query = query.eq('user_id', targetUserId)
    }

    const { data: tokens, error: tokenError } = await query

    if (tokenError) throw tokenError
    
    if (targetUserId && (!tokens || tokens.length === 0)) {
      return new Response(JSON.stringify({ 
        error: `No Acuity token found for user_id: ${targetUserId}` 
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    console.log(`Users to sync: ${tokens?.length || 0}${targetUserId ? ` (filtered by user_id: ${targetUserId})` : ''}`)

    // Get current year and define year range to sync
    const currentYear = new Date().getFullYear()
    const startYear = 2024
    const yearsToSync = []
    
    for (let year = startYear; year <= currentYear; year++) {
      yearsToSync.push(year)
    }

    console.log(`STARTING QUEUE SUBMISSION FOR ${tokens?.length || 0} USERS. CURRENT TIME: ${new Date()}`)
    
    // Create queue for acuity sync
    const queue = qstashClient.queue({
      queueName: 'acuity-full-year-sync',
    })

    let enqueuedCount = 0

    // Enqueue all requests
    for (const tokenItem of tokens || []) {
      for (const year of yearsToSync) {
        const targetUrl = `https://shearwork-web.vercel.app/api/acuity/pull-year?year=${year}&user_id=${tokenItem.user_id}`
        
        queue.enqueueJSON({
          url: targetUrl,
          headers: {
            'Content-Type': 'application/json',
            'x-vercel-protection-bypass': BYPASS_TOKEN
          },
          retries: 3,
        })
        
        console.log(`🚀 Queued ${tokenItem.user_id} - Year ${year}`)
        enqueuedCount++
      }
    }

    console.log(`QUEUE SUBMISSION ENDED. Total enqueued: ${enqueuedCount}. CURRENT TIME: ${new Date()}`)

    return new Response(JSON.stringify({ 
      message: 'All requests queued to QStash',
      totalRequests: enqueuedCount,
      queueName: 'acuity-full-year-sync'
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ 
      error: String(err?.message ?? err) 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})