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
  "How's it going {name}? It's Corva. You have {slots} empty slot/s this week. Want me to help fill them? Est. Return: ${return}",
  "Hey {name}, it's Corva. You have {slots} empty slot/s this week. Want me to help fill them? Est. Return: ${return}",
  "What's up {name}? Corva here. You have {slots} empty slot/s this week. Want me to help fill them? Est. Return: ${return}",
  "Hi {name}, it's Corva. You have {slots} empty slot/s this week. Want me to help fill them? Est. Return: ${return}",
  "Hey there {name}! It's Corva. You have {slots} empty slot/s this week. Want me to help fill them? Est. Return: ${return}",
  "Good morning {name}! Corva here. You have {slots} empty slot/s this week. Want me to help fill them? Est. Return: ${return}",
  "Hello {name}, it's Corva. You have {slots} empty slot/s this week. Want me to help fill them? Est. Return: ${return}",
  "Yo {name}! Corva here. You have {slots} empty slot/s this week. Want me to help fill them? Est. Return: ${return}",
  "Hi there {name}, it's Corva. You have {slots} empty slot/s this week. Want me to help fill them? Est. Return: ${return}",
  "Hey {name}! Corva here. You have {slots} empty slot/s this week. Want me to help fill them? Est. Return: ${return}",
]

function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0]
}

function getRandomMessage(name: string, empty_slots: number, estimatedReturn: number): string {
  const template = messageTemplates[Math.floor(Math.random() * messageTemplates.length)]
  return template
    .replace('{name}', getFirstName(name))
    .replace('{slots}', empty_slots.toString())
    .replace('{return}', estimatedReturn.toString())
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
        const message = getRandomMessage(barber.full_name || 'there', 3, 135) // Change 1 and 45 later
        
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
        
        results.push({
          user_id: barber.user_id,
          phone: barber.phone,
          message_sid: twilioMessage.sid,
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