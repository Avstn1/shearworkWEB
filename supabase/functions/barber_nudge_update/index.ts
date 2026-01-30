// supabase/functions/barber_nudge_update/index.ts

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

const twilio_client = twilio(accountSid, authToken)

// Message templates
const messageTemplates = [
  "Update: {filled} of {total} empty slots were filled by Corva. \n\nEst Recovery: ${recovery}",
  "Hello! {filled} of {total} slots were filled this week by Corva. \n\nEst Recovery: ${recovery}",
  "Progress update: {filled}/{total} slots were filled by Corva. \n\nEst Recovery: ${recovery}",
  "Week update: {filled} of {total} empty slots were booked by Corva. \n\nEst Recovery: ${recovery}",
  "Good news! {filled} out of {total} slots were filled by Corva. \n\nEst Recovery: ${recovery}",
]

function getRandomMessage(filled: number, total: number, recovery: number): string {
  const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)]
  return template
    .replace('{filled}', filled.toString())
    .replace('{total}', total.toString())
    .replace('{recovery}', recovery.toString())
}

function getISOWeek(): string {
  const now = new Date(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  )

  const day = now.getDay() || 7
  now.setDate(now.getDate() + 4 - day)

  const yearStart = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((+now - +yearStart) / 86400000 + 1) / 7)
  const year = now.getFullYear()

  return `${year}-W${week.toString().padStart(2, '0')}`
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
    .select('slot_count, estimated_revenue')
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
  const totalRevenue = data.reduce((sum, row) => sum + (parseFloat(row.estimated_revenue?.toString() || '0')), 0)
  
  return {
    slots: totalSlots,
    revenue: Math.round(totalRevenue)
  }
}

async function getBarberNudgeSuccess(userId: string, isoWeek: string): Promise<{ clientIds: string[] } | null> {
  const { data, error } = await supabase
    .from('barber_nudge_success')
    .select('client_ids')
    .eq('user_id', userId)
    .eq('iso_week_number', isoWeek)
    .single()

  if (error || !data) {
    return null
  }

  return {
    clientIds: data.client_ids || []
  }
}

Deno.serve(async (req) => {
  try {
    const isoWeek = getISOWeek()
    
    // Get barbers matching the criteria
    const { data: barbers, error: barbersError } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone')
      .ilike('role', 'barber')
      .eq('stripe_subscription_status', 'active')
      .eq('sms_engaged_current_week', true)
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

    console.log(`Sending update messages to ${barbers.length} barber(s). Current time: ${new Date()}`)
    console.log(`ISO Week: ${isoWeek}`)

    const results = []

    for (const barber of barbers) {
      try {
        // Get barber nudge success data
        const nudgeSuccess = await getBarberNudgeSuccess(barber.user_id, isoWeek)
        
        if (!nudgeSuccess) {
          console.log(`No barber_nudge_success record for ${barber.full_name} - skipping`)
          results.push({
            user_id: barber.user_id,
            phone: barber.phone,
            status: 'skipped',
            reason: 'No nudge success record'
          })
          continue
        }

        // Get actual availability data for this barber
        const availability = await getBarberAvailability(barber.user_id)
        
        if (availability.slots === 0) {
          console.log(`No availability data for ${barber.full_name} - skipping`)
          results.push({
            user_id: barber.user_id,
            phone: barber.phone,
            status: 'skipped',
            reason: 'No availability data'
          })
          continue
        }

        const filledSlots = nudgeSuccess.clientIds.length
        const totalSlots = availability.slots
        const revenuePerSlot = totalSlots > 0 ? availability.revenue / totalSlots : 0
        const estimatedRecovery = Math.round(revenuePerSlot * filledSlots)
        
        const message = getRandomMessage(filledSlots, totalSlots, estimatedRecovery)
        
        const twilioMessage = await twilio_client.messages.create({
          body: `${message}\n\nReply STOP to unsubscribe.`,
          messagingServiceSid: messagingServiceSid,
          to: barber.phone
        })

        console.log(`Update sent to ${barber.full_name} (${barber.phone}): ${twilioMessage.sid}`)
        console.log(`  Stats: ${filledSlots}/${totalSlots} slots, $${estimatedRecovery} recovery`)
        
        results.push({
          user_id: barber.user_id,
          phone: barber.phone,
          message_sid: twilioMessage.sid,
          filled_slots: filledSlots,
          total_slots: totalSlots,
          estimated_recovery: estimatedRecovery,
          status: 'sent'
        })
      } catch (error) {
        console.error(`Failed to send update to ${barber.full_name} (${barber.phone}):`, error)
        
        results.push({
          user_id: barber.user_id,
          phone: barber.phone,
          error: error.message,
          status: 'failed'
        })
      }
    }

    console.log(`Update sending completed. Current time: ${new Date()}`)

    return new Response(JSON.stringify({ 
      success: true,
      isoWeek: isoWeek,
      sent: results.filter(r => r.status === 'sent').length,
      skipped: results.filter(r => r.status === 'skipped').length,
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