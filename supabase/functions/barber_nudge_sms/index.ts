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

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}

function getRandomMessage(name: string, empty_slots: number, estimatedReturn: number): string {
  const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)]
  return template
    .replace('{name}', getFirstName(name))
    .replace('{slots}', empty_slots)
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
    // revenue: Math.round(totalRevenue)
  }
}

Deno.serve(async (req) => {
  try {
    // Get barbers matching the criteria
    const { data: barbers, error: barbersError } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone')
      .ilike('role', 'barber')
      .eq('stripe_subscription_status', 'active')
      .eq('user_id', '39d5d08d-2deb-4b92-a650-ee10e70b7af1')
      .not('phone', 'is', null)

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

    console.log(`Sending messages to ${barbers.length} barber(s). Current time: ${new Date()}`)

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

    console.log(`Message sending completed. Current time: ${new Date()}`)

    return new Response(JSON.stringify({ 
      success: true,
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