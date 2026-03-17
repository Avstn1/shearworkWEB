// supabase/functions/update_barber_availability/index.ts

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
  Deno.env.get("SERVICE_ROLE_KEY") ?? '', 
)

const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL")

const torontoToday = new Date(
  new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    const BYPASS_TOKEN = Deno.env.get('BYPASS_TOKEN') ?? ''
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? ''
    
    const CONCURRENCY_LIMIT = 100

    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }
    
    let targetUserIds = Array.isArray(body.user_ids)
      ? body.user_ids.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : undefined

    const targetUserId = typeof body.user_id === 'string' && body.user_id.length > 0
      ? body.user_id
      : null

    const forceRefreshParam = typeof body.force_refresh === 'boolean'
      ? body.force_refresh
      : undefined

    console.log('Received request to update availability with parameters [user_ids, user_id]:', { targetUserIds, targetUserId })
    
    if ((!targetUserIds || targetUserIds.length === 0) && targetUserId) {
      targetUserIds = [targetUserId]
    }

    const isTargetedUpdate = Boolean(targetUserIds && targetUserIds.length > 0)
    const shouldForceRefresh = forceRefreshParam ?? !isTargetedUpdate
    const hasTargetKeys =
      Object.prototype.hasOwnProperty.call(body, 'user_id') ||
      Object.prototype.hasOwnProperty.call(body, 'user_ids')

    if (hasTargetKeys && !isTargetedUpdate) {
      return new Response(JSON.stringify({
        error: 'Invalid target user payload',
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      })
    }

    let profileQuery = supabase
      .from('profiles')
      .select('user_id, calendar, full_name')
      .not('calendar', 'is', null)
      .neq('calendar', '')
    
    if (targetUserIds && Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      profileQuery = profileQuery.in('user_id', targetUserIds)
    }

    const { data: profiles, error: profileError } = await profileQuery
    
    if (profileError) throw profileError

    console.log(`Profiles fetched: ${profiles?.length ?? 0}`)

    const allRequests: { userId: string; fullName: string }[] = []
    
    for (const profile of profiles || []) {
      allRequests.push({
        userId: profile.user_id,
        fullName: profile.full_name || 'Unknown'
      })
    }

    console.log(`allRequests built: ${allRequests.length} items`)

    // Reset sms_engaged_current_week before firing requests (cron job only)
    if (!isTargetedUpdate) {
      console.log('No specific user IDs provided, performing reset for all users with sms_engaged_current_week = true')
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          sms_engaged_current_week: false,
          updated_at: new Date().toISOString()
        })
        .eq('sms_engaged_current_week', true)
      
      if (updateError) {
        console.error('Failed to update profile engagement:', updateError)
      }
    }

    const results: { userId: string; fullName: string; success: boolean; error?: string; data?: unknown }[] = []

    function fireWithConcurrency(items: { userId: string; fullName: string }[], limit: number) {
      let active = 0
      let index = 0

      const url = isTargetedUpdate
        ? `${siteUrl}/api/availability/pull?forceRefresh=${String(shouldForceRefresh)}&dryRun=false&mode=update`
        : `${siteUrl}/api/availability/pull?forceRefresh=${String(shouldForceRefresh)}&dryRun=false`

      if (isTargetedUpdate) {
        console.log('Specific user IDs provided, performing update for those users')
      }

      console.log(`Firing ${items.length} requests to: ${url}`)

      return new Promise<void>(resolve => {
        function next() {
          while (active < limit && index < items.length) {
            const request = items[index++]
            active++

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
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      status: 200,
    })
  } catch (err: unknown) {
    console.error('Edge function error:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  }
})