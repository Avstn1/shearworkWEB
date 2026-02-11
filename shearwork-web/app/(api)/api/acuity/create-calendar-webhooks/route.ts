// app/api/acuity/create-calendar-webhooks/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createWebhooksForUser } from '@/lib/acuity_webhooks/api'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const ACUITY_API_BASE = 'https://acuityscheduling.com/api/v1'

async function fetchCalendarIdByName(accessToken: string, calendarName: string): Promise<string | null> {
  try {
    const response = await fetch(`${ACUITY_API_BASE}/calendars`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    })
    
    if (!response.ok) {
      console.error('Failed to fetch calendars:', await response.text())
      return null
    }
    
    const calendars = await response.json()
    
    // Find calendar by name (case-insensitive comparison)
    const matchedCalendar = calendars.find((cal: any) => 
      cal.name.toLowerCase() === calendarName.toLowerCase()
    )
    
    if (!matchedCalendar) {
      console.error(`Calendar "${calendarName}" not found in Acuity calendars`)
      return null
    }
    
    return matchedCalendar.id.toString()
  } catch (error) {
    console.error('Error fetching calendar ID:', error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const { user_id, calendar_name } = await request.json()

    if (!user_id || !calendar_name) {
      return NextResponse.json({ 
        error: 'Missing user_id or calendar_name' 
      }, { status: 400 })
    }

    // Get the user's access token
    const { data: token, error: tokenError } = await supabase
      .from('acuity_tokens')
      .select('access_token')
      .eq('user_id', user_id)
      .single()

    if (tokenError || !token) {
      console.log(`No Acuity token found for user ${user_id}`)
      return NextResponse.json({ 
        success: false, 
        reason: 'No Acuity connection' 
      })
    }

    // Fetch calendar_id by matching the calendar name
    const calendarId = await fetchCalendarIdByName(token.access_token, calendar_name)

    if (!calendarId) {
      return NextResponse.json({ 
        success: false, 
        reason: `Calendar "${calendar_name}" not found in Acuity` 
      }, { status: 404 })
    }

    // Update calendar_id in acuity_tokens
    const { error: updateError } = await supabase
      .from('acuity_tokens')
      .update({ 
        calendar_id: calendarId,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)

    if (updateError) {
      console.error('Failed to update calendar_id:', updateError)
      return NextResponse.json({ 
        success: false, 
        reason: 'Failed to update calendar_id' 
      }, { status: 500 })
    }

    console.log(`✅ Updated calendar_id to ${calendarId} for user ${user_id}`)

    // Create/update webhooks
    try {
      const webhookResult = await createWebhooksForUser(user_id, token.access_token)
      
      if (webhookResult.success) {
        console.log(`✅ Successfully created ${webhookResult.webhooks?.length} webhooks`)
        return NextResponse.json({ 
          success: true, 
          calendar_id: calendarId,
          webhooks: webhookResult.webhooks?.length || 0
        })
      } else {
        console.error('Failed to create webhooks:', webhookResult.error)
        return NextResponse.json({ 
          success: false, 
          reason: 'Calendar updated but webhook creation failed',
          calendar_id: calendarId
        })
      }
    } catch (error) {
      console.error('Error creating webhooks:', error)
      return NextResponse.json({ 
        success: false, 
        reason: 'Calendar updated but webhook creation failed',
        calendar_id: calendarId
      })
    }

  } catch (error) {
    console.error('Error in sync-calendar:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: String(error) 
    }, { status: 500 })
  }
}