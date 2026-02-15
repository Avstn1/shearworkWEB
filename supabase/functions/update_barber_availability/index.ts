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
  // Handle CORS preflight request
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

    // Check for optional user_id (singular) or user_ids (array) parameter
    // Prioritize user_ids if both are present
    const body = await req.json()
    console.log('Received body:', body)
    
    let targetUserIds = body.user_ids // Array
    const targetUserId = body.user_id  // Single string
    
    // If user_ids not provided but user_id is, convert to array
    if ((!targetUserIds || targetUserIds.length === 0) && targetUserId) {
      targetUserIds = [targetUserId]
    }

    // Get all profiles with a calendar set (filtered by user_ids if provided)
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

      // Monday (day 1) = normal mode to set baseline slot_count
      // Tue-Sun = update mode to set slot_count_update (current availability)
      const day = torontoToday.getDay()
      const isMonday = day === 1
      const update = !isMonday && (!targetUserIds || targetUserIds.length === 0)
      
      let url;

      // If not update, then it's a monday so reset sms_engaged_current week for everyone
      if (!update) {
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

        url = `${siteUrl}/api/availability/pull?forceRefresh=true&dryRun=false`
      } else {
        url = `${siteUrl}/api/availability/pull?forceRefresh=true&dryRun=false&mode=update`
      }

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