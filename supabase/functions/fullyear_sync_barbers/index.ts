// supabase/functions/fullyear_sync_barbers/index.ts

// @ts-nocheck
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
    const body = await req.json().catch(() => ({}))
    const targetUserId = body.user_id
    const targetYear = body.year || new Date().getFullYear()

    // Get users with Acuity tokens AND a calendar set (filtered by user_id if provided)
    let tokenQuery = supabase
      .from('acuity_tokens')
      .select('user_id')
    
    if (targetUserId) {
      tokenQuery = tokenQuery.eq('user_id', targetUserId)
    }

    const { data: tokens, error: tokenError } = await tokenQuery

    if (tokenError) throw tokenError
    
    if (targetUserId && (!tokens || tokens.length === 0)) {
      return new Response(JSON.stringify({ 
        error: `No Acuity token found for user_id: ${targetUserId}` 
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // Filter users who have a calendar set
    const userIds = tokens?.map((t: { user_id: string }) => t.user_id) || []
    
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No users with Acuity tokens found',
        totalRequests: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, calendar')
      .in('user_id', userIds)
      .not('calendar', 'is', null)
      .neq('calendar', '')

    if (profileError) throw profileError

    const validUserIds = new Set(profiles?.map((p: { user_id: string }) => p.user_id) || [])
    const validTokens = tokens?.filter((t: { user_id: string }) => validUserIds.has(t.user_id)) || []

    console.log(`Users to sync: ${validTokens.length}${targetUserId ? ` (filtered by user_id: ${targetUserId})` : ''} (${tokens?.length || 0} total with tokens, ${(tokens?.length || 0) - validTokens.length} without calendar)`)

    // Get current year and define year range to sync
    const currentYear = targetYear
    const startYear = currentYear
    const yearsToSync: number[] = []
    
    for (let year = startYear; year <= currentYear; year++) {
      yearsToSync.push(year)
    }

    console.log(`STARTING QUEUE SUBMISSION FOR ${validTokens.length} USERS. CURRENT TIME: ${new Date()}`)
    
    // Create 5 queues for better parallelism on free tier (parallelism=2 per queue)
    const NUM_QUEUES = 5
    const queues = Array.from({ length: NUM_QUEUES }, (_, i) => 
      qstashClient.queue({
        queueName: `acuity-sync-${i + 1}`,
      })
    )

    let enqueuedCount = 0
    let queueIndex = 0

    // Enqueue all requests, distributing evenly across queues
    for (const tokenItem of validTokens) {
      for (const year of yearsToSync) {
        // Use new /api/pull endpoint with year granularity
        const targetUrl = `https://shearwork-web.vercel.app/api/pull?granularity=year&year=${year}`
        
        // Round-robin distribution across queues
        const currentQueue = queues[queueIndex % NUM_QUEUES]
        
        currentQueue.enqueueJSON({
          url: targetUrl,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'X-User-Id': tokenItem.user_id,
            'x-vercel-protection-bypass': BYPASS_TOKEN
          },
          retries: 3,
        })
        
        console.log(`🚀 Queued ${tokenItem.user_id} - Year ${year} → Queue ${(queueIndex % NUM_QUEUES) + 1}`)
        enqueuedCount++
        queueIndex++
      }
    }

    console.log(`QUEUE SUBMISSION ENDED. Total enqueued: ${enqueuedCount}. CURRENT TIME: ${new Date()}`)

    return new Response(JSON.stringify({ 
      message: 'All requests queued to QStash',
      totalRequests: enqueuedCount,
      queues: Array.from({ length: NUM_QUEUES }, (_, i) => `acuity-sync-${i + 1}`),
      distribution: `Evenly distributed across ${NUM_QUEUES} queues (parallelism=2 each = 10 concurrent total)`,
      endpoint: '/api/pull?granularity=year'
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