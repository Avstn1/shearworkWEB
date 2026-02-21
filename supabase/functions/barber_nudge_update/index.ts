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
const siteUrl = Deno.env.get("NEXT_PUBLIC_SITE_URL")

const twilio_client = twilio(accountSid, authToken)

// Toronto timezone
const TORONTO_TZ = 'America/Toronto'

// Message templates
const messageTemplates = [
  "Update: {takenSlots} of {total} empty slots filled this week. \n\nCorva directly recovered {filled} booking/s (+${recovery}). \n\nLet's try again next week. Full details are saved in Corva.",
  "Progress update: {takenSlots}/{total} slots filled this week. \n\nCorva directly recovered {filled} booking/s (+${recovery}). \n\nLet's try again next week. Full details are saved in Corva.",
  "Week update: {takenSlots} of {total} empty slots filled this week. \n\nCorva directly recovered {filled} booking/s (+${recovery}). \n\nLet's try again next week. Full details are saved in Corva.",
  "Good news! {takenSlots} out of {total} slots filled this week. \n\nCorva directly recovered {filled} booking/s (+${recovery}). \n\nLet's try again next week. Full details are saved in Corva.",
]

function getRandomMessage(filled: number, total: number, takenSlots: number, recovery: number): string {
  const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)]
  return template
    .replace('{filled}', filled.toString())
    .replace('{total}', total.toString())
    .replace('{recovery}', recovery.toString())
    .replace('{takenSlots}', takenSlots.toString())
}

function getTorontoDateComponents(date: Date = new Date()): { year: number; month: number; day: number; hours: number; minutes: number; seconds: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  return {
    year: parseInt(parts.find(p => p.type === 'year')!.value),
    month: parseInt(parts.find(p => p.type === 'month')!.value) - 1, // 0-indexed
    day: parseInt(parts.find(p => p.type === 'day')!.value),
    hours: parseInt(parts.find(p => p.type === 'hour')!.value),
    minutes: parseInt(parts.find(p => p.type === 'minute')!.value),
    seconds: parseInt(parts.find(p => p.type === 'second')!.value),
  }
}

function getTorontoDate(date: Date = new Date()): Date {
  const c = getTorontoDateComponents(date)
  return new Date(c.year, c.month, c.day, c.hours, c.minutes, c.seconds)
}

function getCurrentDayOfWeek(): number {
  // Returns 0 (Sunday) to 6 (Saturday) in Toronto time
  const c = getTorontoDateComponents()
  return new Date(c.year, c.month, c.day).getDay()
}

function getISOWeek(): string {
  const c = getTorontoDateComponents()
  const torontoDate = new Date(c.year, c.month, c.day)

  const day = torontoDate.getDay() || 7
  torontoDate.setDate(torontoDate.getDate() + 4 - day)

  const yearStart = new Date(torontoDate.getFullYear(), 0, 1)
  const week = Math.ceil(((+torontoDate - +yearStart) / 86400000 + 1) / 7)
  const year = torontoDate.getFullYear()

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

function getCurrentWeekMondayAt10AM(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  const { start } = getISOWeekDates(torontoDate)
  
  // Set to Monday 10:00 AM Toronto time
  const monday10am = new Date(start)
  monday10am.setHours(10, 0, 0, 0)
  
  return monday10am
}

function getCurrentWeekWednesdayEnd(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  const { start } = getISOWeekDates(torontoDate)
  
  // Wednesday is 2 days after Monday
  const wednesday = new Date(start)
  wednesday.setDate(start.getDate() + 2)
  wednesday.setHours(23, 59, 59, 999)
  
  return wednesday
}

function getCurrentWeekMondayStart(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  const { start } = getISOWeekDates(torontoDate)
  
  return start
}

function getCurrentWeekThursdayEnd(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  const { start } = getISOWeekDates(torontoDate)
  
  // Thursday is 3 days after Monday
  const thursday = new Date(start)
  thursday.setDate(start.getDate() + 3)
  thursday.setHours(23, 59, 59, 999)
  
  return thursday
}

function getThreeDaysAgo(): Date {
  const now = new Date()
  const torontoDate = getTorontoDate(now)
  
  const threeDaysAgo = new Date(torontoDate)
  threeDaysAgo.setDate(torontoDate.getDate() - 3)
  
  return threeDaysAgo
}

function isDateInBarelyLateWindow(date: Date): boolean {
  const monday10am = getCurrentWeekMondayAt10AM()
  const wednesdayEnd = getCurrentWeekWednesdayEnd()
  
  // Check if date is strictly after Monday 10am and before Wednesday end
  return date > monday10am && date <= wednesdayEnd
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

async function getBarberAvailability(userId: string): Promise<{ slots: number; taken_slots: number; revenue: number }> {
  const now = new Date()
  const { start, end } = getISOWeekDates(now)
  
  const startDate = start.toISOString().split('T')[0]
  const endDate = end.toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('availability_daily_summary')
    .select('slot_count, slot_count_update, estimated_revenue')
    .eq('user_id', userId)
    .gte('slot_date', startDate)
    .lte('slot_date', endDate)
    
  if (error) {
    console.error(`Error fetching availability for user ${userId}:`, error)
    return { slots: 0, taken_slots: 0, revenue: 0 }
  }

  if (!data || data.length === 0) {
    return { slots: 0, taken_slots: 0, revenue: 0 }
  }
  
  const totalSlots = data.reduce((sum, row) => sum + (row.slot_count || 0), 0)
  const totalSlotsUpdate = data.reduce((sum, row) => sum + (row.slot_count_update || 0), 0)
  
  const takenSlots = totalSlots - totalSlotsUpdate

  const totalRevenue = data.reduce((sum, row) => sum + (parseFloat(row.estimated_revenue?.toString() || '0')), 0)
  
  return {
    slots: totalSlots,
    taken_slots: takenSlots,
    revenue: Math.round(totalRevenue)
  }
}

async function getBarberNudgeSuccess(userId: string, isoWeek: string): Promise<{ clientIds: string[]; prices: number[] } | null> {
  const { data, error } = await supabase
    .from('barber_nudge_success')
    .select('client_ids, prices')
    .eq('user_id', userId)
    .eq('iso_week_number', isoWeek)
    .single()

  if (error || !data) {
    return null
  }

  return {
    clientIds: data.client_ids || [],
    prices: data.prices || []
  }
}

async function getLatestYesReply(userId: string): Promise<{ received_at: string } | null> {
  const { data, error } = await supabase
    .from('sms_replies')
    .select('received_at, message')
    .eq('user_id', userId)
    .eq('message', 'yes')
    .order('received_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return {
    received_at: data.received_at
  }
}

async function sendUpdateMessage(barber: any, isoWeek: string): Promise<any> {
  // Get barber nudge success data
  const nudgeSuccess = await getBarberNudgeSuccess(barber.user_id, isoWeek)
  
  if (!nudgeSuccess) {
    console.log(`No barber_nudge_success record for ${barber.full_name} - skipping`)
    return {
      user_id: barber.user_id,
      phone: barber.phone,
      status: 'skipped',
      reason: 'No nudge success record'
    }
  }

  // Get actual availability data for this barber
  const availability = await getBarberAvailability(barber.user_id)
  
  if (availability.slots === 0) {
    console.log(`No availability data for ${barber.full_name} - skipping`)
    return {
      user_id: barber.user_id,
      phone: barber.phone,
      status: 'skipped',
      reason: 'No availability data'
    }
  }

  const filledSlots = nudgeSuccess.clientIds.length
  const totalSlots = availability.slots
  const takenSlots = availability.taken_slots
  const estimatedRecovery = nudgeSuccess.prices.reduce(
    (sum, price) => sum + Number(price),
    0
  )
  
  let message
  if (filledSlots > 0) {
    message = getRandomMessage(filledSlots, totalSlots, takenSlots, estimatedRecovery)
  } else {
    message = `Hey ${barber.full_name}, Corva has contacted your highest-probability clients. Results may still come in.`
  }

  const statusCallbackUrl = `${siteUrl}/api/barber-nudge/sms-status`

  const callbackUrl = new URL(statusCallbackUrl)
  callbackUrl.searchParams.set('user_id', barber.user_id)
  callbackUrl.searchParams.set('message', message)
  callbackUrl.searchParams.set('purpose', 'barber_sms_update')
  
  const twilioMessage = await twilio_client.messages.create({
    body: `${message}\n\nReply STOP to unsubscribe.`,
    messagingServiceSid: messagingServiceSid,
    to: barber.phone,
    statusCallback: callbackUrl.toString()
  })

  console.log(`Update sent to ${barber.full_name} (${barber.phone}): ${twilioMessage.sid}`)
  console.log(`Stats: ${filledSlots}/${totalSlots} slots, $${estimatedRecovery} recovery`)

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert({
      user_id: barber.user_id,
      header: "Auto nudge update",
      message: "Your auto nudge update has been sent to your phone. Click to view details in Corva.",
      reference_type: 'sms_auto_nudge',
      show: false,
    })

  if (notificationError) {
    console.error('Failed to insert notifications. Continuing without notification', notificationError)
  }
  
  return {
    user_id: barber.user_id,
    phone: barber.phone,
    message_sid: twilioMessage.sid,
    filled_slots: filledSlots,
    total_slots: totalSlots,
    estimated_recovery: estimatedRecovery,
    status: 'sent'
  }
}

Deno.serve(async (req) => {
  try {
    const dayOfWeek = getCurrentDayOfWeek()
    const isoWeek = getISOWeek()
    
    console.log(`Edge function triggered. Current day: ${dayOfWeek} (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)`)
    console.log(`ISO Week: ${isoWeek}`)
    
    const results = []
    
    // FLOW 1: Normal Wednesday updates (on-time barbers only)
    if (dayOfWeek === 3) {
      console.log('Wednesday flow: Sending updates to on-time barbers')
      
      const monday10am = getCurrentWeekMondayAt10AM()
      
      console.log(`Excluding barbers with date_autonudge_enabled after ${monday10am.toISOString()}`)
      
      // Get barbers who enabled auto-nudge BEFORE Monday 10am of current week
      const { data: barbers, error: barbersError } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone, date_autonudge_enabled')
        .ilike('role', 'barber')
        .eq('sms_engaged_current_week', true)
        .not('phone', 'is', null)
        .or('stripe_subscription_status.eq.active,trial_active.eq.true')
        .lt('date_autonudge_enabled', monday10am.toISOString())

      if (barbersError) {
        console.error('Error fetching barbers:', barbersError)
        throw barbersError
      }

      if (!barbers || barbers.length === 0) {
        console.log('No on-time barbers found for Wednesday update')
      } else {
        console.log(`Sending update messages to ${barbers.length} on-time barber(s)`)
        
        // Update availability for all barbers before sending messages
        const barberUserIds = barbers.map(b => b.user_id)
        await updateBarbersAvailability(barberUserIds)
        
        for (const barber of barbers) {
          try {
            const result = await sendUpdateMessage(barber, isoWeek)
            results.push(result)
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
      }
    }
    
    // FLOW 2: Special updates for "barely late" barbers (3 days after onboarding)
    const threeDaysAgo = getThreeDaysAgo()
    
    console.log(`Checking if 3 days ago (${threeDaysAgo.toISOString()}) is in barely late window`)
    
    if (isDateInBarelyLateWindow(threeDaysAgo)) {
      console.log('3 days ago is in barely late window - checking for special updates')
      
      const mondayStart = getCurrentWeekMondayStart()
      const thursdayEnd = getCurrentWeekThursdayEnd()
      
      // Get all barbers with active subscription/trial
      const { data: allBarbers, error: allBarbersError } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .ilike('role', 'barber')
        .not('phone', 'is', null)
        .or('stripe_subscription_status.eq.active,trial_active.eq.true')

      if (allBarbersError) {
        console.error('Error fetching all barbers:', allBarbersError)
        throw allBarbersError
      }

      if (allBarbers && allBarbers.length > 0) {
        console.log(`Checking ${allBarbers.length} barbers for barely late updates`)
        
        // First pass: identify barbers who need updates
        const barbersToUpdate = []
        
        for (const barber of allBarbers) {
          try {
            // Get latest yes reply
            const latestReply = await getLatestYesReply(barber.user_id)
            
            if (!latestReply) {
              continue
            }
            
            const replyDate = new Date(latestReply.received_at)
            const replyDateToronto = getTorontoDate(replyDate)
            
            // Check if reply was between Monday and Thursday of current week
            if (replyDateToronto >= mondayStart && replyDateToronto <= thursdayEnd) {
              barbersToUpdate.push(barber)
            }
          } catch (error) {
            console.error(`Failed to check barely late eligibility for ${barber.full_name}:`, error)
          }
        }
        
        if (barbersToUpdate.length > 0) {
          console.log(`Found ${barbersToUpdate.length} barbers for barely late updates`)
          
          // Update availability for all barbers before sending messages
          const barberUserIds = barbersToUpdate.map(b => b.user_id)
          await updateBarbersAvailability(barberUserIds)
          
          // Second pass: send updates
          for (const barber of barbersToUpdate) {
            try {
              console.log(`Sending barely late update to ${barber.full_name}`)
              const result = await sendUpdateMessage(barber, isoWeek)
              results.push({ ...result, flow: 'barely_late' })
            } catch (error) {
              console.error(`Failed to send barely late update to ${barber.full_name}:`, error)
            }
          }
        }
      }
    } else {
      console.log('3 days ago is NOT in barely late window - skipping special updates')
    }

    console.log(`Update sending completed. Current time: ${new Date().toISOString()}`)

    return new Response(JSON.stringify({ 
      success: true,
      day_of_week: dayOfWeek,
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