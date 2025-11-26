import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushNotificationMessage {
  to: string | string[]
  title: string
  body: string
  data?: Record<string, any>
  sound?: 'default' | null
  badge?: number
  priority?: 'default' | 'normal' | 'high'
}

async function sendPushNotification(message: PushNotificationMessage) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: message.to,
      title: message.title,
      body: message.body,
      data: message.data || {},
      sound: message.sound || 'default',
      badge: message.badge,
      priority: message.priority || 'high',
    }),
  })

  return await response.json()
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request body
    const { userId, title, body, data, reportId, reportType } = await req.json()

    // Validation
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get user's push tokens
    const { data: tokens, error } = await supabaseClient
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)

    if (error) {
      throw error
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No push tokens found for user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Prepare notification data
    const notificationData = data || {}
    if (reportId) notificationData.reportId = reportId
    if (reportType) notificationData.reportType = reportType

    // Send notifications in chunks of 100
    const pushTokens = tokens.map(t => t.token)
    const chunks = []
    for (let i = 0; i < pushTokens.length; i += 100) {
      chunks.push(pushTokens.slice(i, i + 100))
    }

    const results = []
    for (const chunk of chunks) {
      const result = await sendPushNotification({
        to: chunk,
        title: title || 'New Notification',
        body: body || 'You have a new update',
        data: notificationData,
      })
      results.push(result)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent to ${pushTokens.length} device(s)`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})