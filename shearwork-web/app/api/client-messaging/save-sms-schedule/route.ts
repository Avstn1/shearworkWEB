/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

function getCronExpression(
  frequency: 'weekly' | 'biweekly' | 'monthly',
  dayOfWeek?: string,
  dayOfMonth?: number,
  hour?: number,
  minute?: number
): string {
  const h = hour ?? 10;
  const m = minute ?? 0;

  if (frequency === 'monthly') {
    return `${m} ${h} ${dayOfMonth} * *`;
  } else if (frequency === 'weekly' || frequency === 'biweekly') {
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const cronDay = dayMap[dayOfWeek?.toLowerCase() ?? 'monday'];
    return `${m} ${h} * * ${cronDay}`;
  }

  throw new Error('Invalid frequency');
}

function getCronText(
  frequency: 'weekly' | 'biweekly' | 'monthly',
  dayOfWeek?: string,
  dayOfMonth?: number,
  hour?: number,
  minute?: number
): string {
  const h = hour ?? 10;
  const m = minute ?? 0;

  // Convert 24hr to 12hr format
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const timeStr = `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;

  if (!dayOfWeek) throw new Error("dayOfWeek is required");
  
  if (frequency === 'monthly') {
    return `Every month on day ${dayOfMonth} at ${timeStr}`;
  } else if (frequency === 'biweekly') {
    const day = dayOfWeek?.charAt(0).toUpperCase() + dayOfWeek?.slice(1);
    return `Every other ${day} at ${timeStr}`;
  } else {
    const day = dayOfWeek?.charAt(0).toUpperCase() + dayOfWeek?.slice(1);
    return `Every ${day} at ${timeStr}`;
  }
}

export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const body = await request.json()
    const { messages } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No messages provided' },
        { status: 400 }
      )
    }

    // Validate messages based on their status
    for (const msg of messages) {
      // All messages need content
      if (!msg.message || msg.message.trim().length < 100) {
        return NextResponse.json(
          { success: false, error: 'Message must be at least 100 characters' },
          { status: 400 }
        )
      }

      // Only ACCEPTED messages need validation approval
      if (msg.validationStatus === 'ACCEPTED') {
        if (!msg.isValidated || msg.validationStatus !== 'ACCEPTED') {
          return NextResponse.json(
            { success: false, error: 'Approved messages must be validated' },
            { status: 400 }
          )
        }
      }
      
      // DRAFT messages can be saved without validation
    }

    // Process each message (upsert by id)
    const upsertPromises = messages.map(async (msg: any) => {
      try {
        // Generate cron expression and text
        const cron = getCronExpression(
          msg.frequency,
          msg.dayOfWeek,
          msg.dayOfMonth,
          msg.hour,
          msg.minute
        )
        const cronText = getCronText(
          msg.frequency,
          msg.dayOfWeek,
          msg.dayOfMonth,
          msg.hour,
          msg.minute
        )

        // Check if message already exists in database by id
        const { data: existing } = await supabase
          .from('sms_scheduled_messages')
          .select('id')
          .eq('id', msg.id)
          .eq('user_id', user.id)
          .single()

        let result;
        
        if (existing) {
          // Update existing message
          const { data, error } = await supabase
            .from('sms_scheduled_messages')
            .update({
              title: msg.title || 'Untitled Message',
              message: msg.message,
              status: msg.validationStatus, // Update status (can go from ACCEPTED to DRAFT)
              cron: cron,
              cron_text: cronText,
            })
            .eq('id', msg.id)
            .select()
            .single()

          if (error) throw error
          result = data
        } else {
          // Insert new message with the frontend-generated id
          const { data, error } = await supabase
            .from('sms_scheduled_messages')
            .insert({
              id: msg.id, // Use the id from frontend
              user_id: user.id,
              title: msg.title || 'Untitled Message',
              message: msg.message,
              status: msg.validationStatus, // Can be 'DRAFT' or 'ACCEPTED'
              cron: cron,
              cron_text: cronText,
              qstash_schedule_id: null,
            })
            .select()
            .single()

          if (error) throw error
          result = data
        }

        return { success: true, data: result }
      } catch (error: any) {
        console.error('Failed to save message:', error)
        return { success: false, error: error.message }
      }
    })

    const results = await Promise.all(upsertPromises)

    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)

    return NextResponse.json({
      success: failed.length === 0,
      created: successful.length,
      failed: failed.length,
      results,
    })

  } catch (err: any) {
    console.error('❌ SMS schedule save error:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve scheduled messages
export async function GET(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const { data: messages, error } = await supabase
      .from('sms_scheduled_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      messages: messages || [] 
    })

  } catch (err: any) {
    console.error('❌ Failed to fetch SMS schedules:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE endpoint
export async function DELETE(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

    const { id } = await request.json()

    const { error } = await supabase
      .from('sms_scheduled_messages')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}