// supabase/functions/send_autonudge_confirmation_reminder_notif/index.ts

// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
  Deno.env.get("SERVICE_ROLE_KEY") ?? '', 
)

// 20 different headers
const HEADERS = [
  "It's time to say yes to your free Auto nudge!",
  "Your weekly Auto nudge SMS is waiting!",
  "Don't forget your free Auto nudge confirmation!",
  "Weekly reminder: Auto nudge SMS authorization needed",
  "Your Auto nudge SMS is ready to send!",
  "Confirm your free Auto nudge via SMS today!",
  "Your complimentary Auto nudge needs your OK!",
  "Time to authorize this week's Auto nudge SMS!",
  "Your free Auto nudge SMS is standing by!",
  "Quick reminder: Auto nudge SMS confirmation pending",
  "Activate your weekly Auto nudge through SMS!",
  "Your Auto nudge SMS authorization is waiting!",
  "Don't miss out on your free Auto nudge SMS!",
  "Weekly Auto nudge: SMS confirmation required",
  "Say yes to your Auto nudge SMS this week!",
  "Your free Auto nudge SMS needs the green light!",
  "Auto nudge SMS ready - just needs your approval!",
  "Confirm your weekly Auto nudge via SMS now!",
  "Your Auto nudge SMS campaign awaits confirmation!",
  "Weekly check-in: Auto nudge SMS authorization needed"
]

// 20 different message templates
const MESSAGE_TEMPLATES = [
  "Hey {firstName}, you haven't authorized your free auto-nudge this week. Reply YES to Corva's SMS to activate it!",
  "Hi {firstName}, reply YES to Corva's SMS to activate your free auto-nudge this week and keep your clients coming back!",
  "{firstName}, your complimentary auto-nudge is ready! Just reply YES to the SMS from Corva to reach your clients.",
  "Hey {firstName}, confirm your free auto-nudge by replying YES to Corva's text message this week!",
  "Hi {firstName}, you have a free auto-nudge waiting. Reply YES to the SMS from Corva to engage your clients!",
  "{firstName}, don't forget to reply YES to Corva's SMS to approve your weekly auto-nudge. Your clients are waiting!",
  "Hey {firstName}, your free auto-nudge is ready. Just text YES back to Corva and reconnect with your clients!",
  "Hi {firstName}, authorize your complimentary auto-nudge by replying YES to the text from Corva!",
  "{firstName}, your weekly auto-nudge needs confirmation. Reply YES to Corva's SMS to send it out!",
  "Hey {firstName}, you haven't replied YES to Corva's SMS yet. Don't let this opportunity slip away!",
  "Hi {firstName}, reply YES to the text from Corva this week and watch your bookings grow!",
  "{firstName}, your free auto-nudge is waiting! Reply YES to Corva's message to engage your clients.",
  "Hey {firstName}, approve your weekly auto-nudge by texting YES to Corva and keep your schedule filled!",
  "Hi {firstName}, you have a pending confirmation. Reply YES to Corva's SMS to reconnect with clients!",
  "{firstName}, don't miss your chance! Text YES to Corva's message to activate your free auto-nudge.",
  "Hey {firstName}, your complimentary auto-nudge needs the green light. Reply YES to Corva's SMS today!",
  "Hi {firstName}, reply YES to the text from Corva to activate your weekly auto-nudge and bring back regulars!",
  "{firstName}, your free auto-nudge is ready to work for you. Just reply YES to Corva's SMS!",
  "Hey {firstName}, you haven't replied to Corva's SMS yet. Take 2 seconds to text YES and confirm!",
  "Hi {firstName}, reply YES to Corva's text message now and keep your clients engaged all week!"
]

Deno.serve(async (_req) => {
  try {
    const now = new Date()
    console.log(`STARTING AUTO-NUDGE REMINDER NOTIFICATION SEND. CURRENT TIME: ${now}`)

    // Get eligible barbers: active subscription, has calendar, role is barber, hasn't engaged with SMS this week
    const { data: eligibleBarbers, error: barbersError } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .not('calendar', 'is', null)
      .neq('calendar', '')
      .ilike('role', 'barber')
      .eq('stripe_subscription_status', 'active')
      .eq('sms_engaged_current_week', false)

    if (barbersError) {
      console.error('Error fetching eligible barbers:', barbersError)
      throw barbersError
    }

    if (!eligibleBarbers || eligibleBarbers.length === 0) {
      console.log('No eligible barbers found')
      return new Response(JSON.stringify({ 
        message: 'No eligible barbers to notify',
        count: 0
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    console.log(`Found ${eligibleBarbers.length} eligible barbers`)

    // Create notifications for each barber
    const notifications = eligibleBarbers.map((barber, index) => {
      // Use modulo to cycle through headers and messages independently
      const header = HEADERS[index % HEADERS.length]
      const messageTemplate = MESSAGE_TEMPLATES[index % MESSAGE_TEMPLATES.length]
      
      // Extract first name
      const firstName = barber.full_name?.split(' ')[0] || 'there'
      
      return {
        user_id: barber.user_id,
        header: header,
        message: messageTemplate.replace('{firstName}', firstName),
        show: false,
        read: false,
        reference: null,
        reference_type: 'auto_nudge_reminder'
      }
    })

    // Insert all notifications
    const { data: insertedNotifications, error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select()

    if (insertError) {
      console.error('Error inserting notifications:', insertError)
      throw insertError
    }

    console.log(`Successfully created ${insertedNotifications?.length || 0} notifications`)
    console.log(`NOTIFICATION SEND COMPLETED. CURRENT TIME: ${new Date()}`)

    return new Response(JSON.stringify({ 
      message: 'Auto-nudge reminder notifications sent successfully',
      count: insertedNotifications?.length || 0,
      recipients: eligibleBarbers.map(b => ({ 
        userId: b.user_id, 
        name: b.full_name 
      }))
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err: unknown) {
    console.error('Edge function error:', err)
    const errorMessage = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})