// supabase/functions/barber_nudge_sms/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import twilio from 'npm:twilio'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
  Deno.env.get("SERVICE_ROLE_KEY") ?? '', 
)

const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")
const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")
const messagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID_BARBERS")
const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL")

const twilio_client = twilio(accountSid, authToken)

// Toronto timezone
const TORONTO_TZ = 'America/Toronto'

// Message templates
const messageTemplates = [
  "How's it going {name}? It's Corva. You have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "Hey {name}, it's Corva. You have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "What's up {name}? Corva here. You have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "Hi {name}, it's Corva. You have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "Hey there {name}! It's Corva. You have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "Good morning {name}! Corva here. You have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "Hello {name}, it's Corva. You have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "Yo {name}! Corva here. You have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "Hi there {name}, it's Corva. You have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "Hey {name}! Corva here. You have {slots} empty slot/s this week. Want me to try filling a few of them?",
]

const correctionTemplates = [
  "Hey {name}, my mistake on that last text. You actually have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "My apologies {name}! That number was off. You actually have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "Sorry for the confusion {name}! You actually have {slots} empty slot/s this week. Want me to try filling a few of them?",
  "Hey {name}, sorry about the error in that last message. You actually have {slots} empty slot/s this week. Want me to try filling a few of them?",
]


function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}

function getTorontoDate(date: Date = new Date()): Date {
  // Convert UTC date to Toronto timezone
  const torontoTimeString = date.toLocaleString('en-CA', { timeZone: TORONTO_TZ })
  return new Date(torontoTimeString)
}

function getCurrentDayOfWeek(): number {
  // Returns 0 (Sunday) to 6 (Saturday) in Toronto time
  const torontoDate = getTorontoDate()
  return torontoDate.getDay()
}

function getYesterdayInTorontoAsUTC(): { start: string; end: string } {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  
  // Get yesterday's date in Toronto
  const yesterday = new Date(torontoDate)
  yesterday.setDate(yesterday.getDate() - 1)
  
  // Create start of day in Toronto (00:00:00)
  const yesterdayStartToronto = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate(),
    0, 0, 0, 0
  )
  
  // Create end of day in Toronto (23:59:59)
  const yesterdayEndToronto = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate(),
    23, 59, 59, 999
  )
  
  // Convert Toronto times to UTC by creating dates with timezone offset
  // We parse the Toronto date string back as if it's in the local (Toronto) timezone
  // then get the UTC equivalent
  const torontoFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  
  // Get offset between Toronto and UTC
  const torontoOffset = getTorontoUTCOffset(now)
  
  // Apply offset to get UTC times
  const yesterdayStartUTC = new Date(yesterdayStartToronto.getTime() - torontoOffset)
  const yesterdayEndUTC = new Date(yesterdayEndToronto.getTime() - torontoOffset)
  
  return {
    start: yesterdayStartUTC.toISOString(),
    end: yesterdayEndUTC.toISOString()
  }
}

function getTorontoUTCOffset(date: Date): number {
  // Get the offset in milliseconds between Toronto time and UTC
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }))
  const torontoDate = new Date(date.toLocaleString('en-US', { timeZone: TORONTO_TZ }))
  return torontoDate.getTime() - utcDate.getTime()
}

async function updateBarbersAvailability(userIds: string[]): Promise<void> {
  if (!userIds || userIds.length === 0) {
    console.log('No user IDs to update availability for')
    return
  }

  console.log(`Updating availability for ${userIds.length} barber(s)`)

  try {
    const { data, error } = await supabase.functions.invoke('update_barber_availability', {
      body: { user_ids: userIds }
    })

    if (error) {
      console.error('Failed to update barber availability:', error)
    } else {
      console.log(`Availability update completed. Success: ${data?.success}, Failed: ${data?.failed}`)
    }
  } catch (error) {
    console.error('Error calling update_barber_availability:', error)
  }
}

function getRandomMessage(name: string, empty_slots: number, estimatedReturn: number): string {
  const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)]
  return template
    .replace('{name}', getFirstName(name))
    .replace('{slots}', empty_slots.toString())
}

function getISOWeekDates(date: Date): { start: Date; end: Date } {
  const currentDate = new Date(date)
  const dayOfWeek = currentDate.getDay()
  
  // Calculate days to Monday (1 = Monday, 0 = Sunday)
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  
  const monday = new Date(currentDate)
  monday.setDate(currentDate.getDate() + daysToMonday)
  monday.setHours(0, 0, 0, 0)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  
  return { start: monday, end: sunday }
}

async function getBarberAvailability(userId: string): Promise<{ slots: number; revenue: number }> {
  const now = new Date()
  const { start, end } = getISOWeekDates(now)
  
  const startDate = start.toISOString().split('T')[0]
  const endDate = end.toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('availability_daily_summary')
    .select('slot_count')
    // .select('slot_count, estimated_revenue')
    .eq('user_id', userId)
    .gte('slot_date', startDate)
    .lte('slot_date', endDate)
    
  if (error) {
    console.error(`Error fetching availability for user ${userId}:`, error)
    return { slots: 0, revenue: 0 }
  }

  if (!data || data.length === 0) {
    return { slots: 0, revenue: 0 }
  }
  
  const totalSlots = data.reduce((sum, row) => sum + (row.slot_count || 0), 0)
  // const totalRevenue = data.reduce((sum, row) => sum + (row.estimated_revenue || 0), 0)
  
  return {
    slots: totalSlots,
    revenue: 0
    // revenue: Math.round(totalRevenue)
  }
}

Deno.serve(async (req) => {
  try {
    const dayOfWeek = getCurrentDayOfWeek()
    // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
    
    console.log(`Edge function triggered. Current day: ${dayOfWeek} (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)`)
    console.log(`Current Toronto time: ${getTorontoDate().toISOString()}`)
    
    // Thursday-Sunday: Skip execution
    if (dayOfWeek >= 4 || dayOfWeek === 0) {
      console.log('Skipping execution (Thursday-Sunday)')
      return new Response(JSON.stringify({ message: 'Skipped - not an active send day' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    
    let query = supabase
      .from('profiles')
      .select('user_id, full_name, phone')
      .ilike('role', 'barber')
      .eq('sms_engaged_current_week', false)
      .not('phone', 'is', null)
    
    // Add subscription filter (active OR trial)
    query = query.or('stripe_subscription_status.eq.active,trial_active.eq.true')
    
    if (dayOfWeek === 1) {
      // Monday: Regular flow - send to everyone with date_autonudge_enabled set
      console.log('Monday flow: Sending to all barbers with auto-nudge enabled')
      query = query.not('date_autonudge_enabled', 'is', null)
    } else {
      // Tuesday-Wednesday: Catch-up flow - send to barbers who onboarded yesterday
      console.log('Tuesday-Wednesday catch-up flow: Sending to barbers who onboarded yesterday')
      
      const { start, end } = getYesterdayInTorontoAsUTC()
      
      console.log(`Looking for date_autonudge_enabled between ${start} and ${end} (UTC, representing yesterday in Toronto time)`)
      
      // Filter for barbers whose date_autonudge_enabled was yesterday (Toronto time)
      query = query
        .gte('date_autonudge_enabled', start)
        .lte('date_autonudge_enabled', end)
    }

    const { data: barbers, error: barbersError } = await query

    if (barbersError) {
      console.error('Error fetching barbers:', barbersError)
      throw barbersError
    }

    if (!barbers || barbers.length === 0) {
      console.log('No barbers found matching criteria')
      return new Response(JSON.stringify({ message: 'No barbers found' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`Sending messages to ${barbers.length} barber(s). Current time: ${new Date().toISOString()}`)

    // Update availability for all barbers before sending messages
    const barberUserIds = barbers.map(b => b.user_id)
    await updateBarbersAvailability(barberUserIds)

    const statusCallbackUrl = `${siteUrl}/api/barber-nudge/sms-status`
    const results = []

    for (const barber of barbers) {
      try {
        // Get actual availability data for this barber
        const availability = await getBarberAvailability(barber.user_id)
        
        const message = getRandomMessage(
          barber.full_name || 'there',
          availability.slots,
          availability.revenue
        )
        
        const callbackUrl = new URL(statusCallbackUrl)
        callbackUrl.searchParams.set('user_id', barber.user_id)
        callbackUrl.searchParams.set('message', message)
        callbackUrl.searchParams.set('purpose', 'barber_sms')
        
        const twilioMessage = await twilio_client.messages.create({
          body: `${message}\n\nReply YES to continue and STOP to unsubscribe.`,
          messagingServiceSid: messagingServiceSid,
          to: barber.phone,
          statusCallback: callbackUrl.toString()
        })

        console.log(`Message sent to ${barber.full_name} (${barber.phone}): ${twilioMessage.sid}`)
        console.log(`Availability: ${availability.slots} slots, $${availability.revenue} revenue`)
        
        results.push({
          user_id: barber.user_id,
          phone: barber.phone,
          message_sid: twilioMessage.sid,
          slots: availability.slots,
          revenue: availability.revenue,
          status: 'sent'
        })
      } catch (error) {
        console.error(`Failed to send message to ${barber.full_name} (${barber.phone}):`, error)
        
        results.push({
          user_id: barber.user_id,
          phone: barber.phone,
          error: error.message,
          status: 'failed'
        })
      }
    }

    console.log(`Message sending completed. Current time: ${new Date().toISOString()}`)

    return new Response(JSON.stringify({ 
      success: true,
      day_of_week: dayOfWeek,
      flow_type: dayOfWeek === 1 ? 'monday_regular' : 'tuesday_wednesday_catchup',
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('Edge function error:', err)
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})