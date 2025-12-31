// supabase/functions/fullyear_sync_barbers/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

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
    
    // Build all requests (one per user per year)
    const queueRequests: Array<{
      url: string
      headers: Record<string, string>
      userId: string
      year: number
    }> = []
    
    for (const tokenItem of tokens || []) {
      for (const year of yearsToSync) {
        queueRequests.push({
          url: `https://shearwork-web.vercel.app/api/acuity/pull-year?year=${year}`,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'X-User-Id': tokenItem.user_id,
            'x-vercel-protection-bypass': BYPASS_TOKEN
          },
          userId: tokenItem.user_id,
          year
        })
      }
    }

    console.log(`Total requests to queue: ${queueRequests.length}`)

    // Fire all requests to QStash (fire and forget)
    for (const request of queueRequests) {
      fetch('https://qstash.upstash.io/v2/publish', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${QSTASH_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: request.url,
          headers: request.headers,
          method: 'GET',
          retries: 3,
          delay: 0,
        })
      })
      console.log(`🚀 Queued ${request.userId} - Year ${request.year}`)
    }

    console.log(`QUEUE SUBMISSION ENDED. CURRENT TIME: ${new Date()}`)

    return new Response(JSON.stringify({ 
      message: 'All requests queued to QStash',
      totalRequests: queueRequests.length
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