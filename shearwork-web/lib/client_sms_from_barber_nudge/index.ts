import twilio from 'twilio'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

const twilio_client = twilio(accountSid, authToken)

function getMondaysInCurrentMonth(): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  
  let mondayCount = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    if (date.getDay() === 1) { // Monday is 1
      mondayCount++
    }
  }
  
  return mondayCount
}

async function fetchPreviewRecipients(
  user_id: string,
  limit: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const previewResponse = await fetch(
      `${siteUrl}/api/client-messaging/preview-recipients?limit=${limit}&userId=${user_id}&algorithm=auto-nudge`
    )

    if (!previewResponse.ok) {
      console.error('Failed to fetch preview recipients:', previewResponse.statusText)
      return {
        success: false,
        error: 'Failed to fetch recipients'
      }
    }

    const previewData = await previewResponse.json()

    if (!previewData.success || !previewData.phoneNumbers || previewData.phoneNumbers.length === 0) {
      console.log('No clients to message')
      return {
        success: true,
        data: null
      }
    }

    return {
      success: true,
      data: previewData
    }
  } catch (error: any) {
    console.error('Error fetching preview recipients:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

async function generateSMSMessage(
  profile: {
    full_name: string
    email: string
    phone: string
    username: string
  }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Generate booking link without token
    const bookingLink = `${siteUrl}book?profile=${profile.username}`

    // Generate SMS template
    const templateResponse = await fetch(`${siteUrl}/api/client-messaging/generate-sms-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Generate a professional barbershop marketing SMS message',
        profile: {
          full_name: profile.full_name || '',
          email: profile.email || '',
          phone: profile.phone || '',
          booking_link: bookingLink
        }
      }),
    })

    if (!templateResponse.ok) {
      console.error('Failed to generate SMS template:', templateResponse.statusText)
      return {
        success: false,
        error: 'Failed to generate message template'
      }
    }

    const templateData = await templateResponse.json()
    const message = templateData.message || templateData.template

    if (!message) {
      console.error('No message template generated')
      return {
        success: false,
        error: 'No message template generated'
      }
    }

    return {
      success: true,
      message
    }
  } catch (error: any) {
    console.error('Error generating SMS message:', error)
    return {
      success: false,
      error: error.message
    }
  }
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

function addTokenToBookingLink(message: string, token: string, username: string): string {
  const pattern = `${siteUrl}book?profile=${username}`
  return message.replace(pattern, `${siteUrl}book?profile=${username}&t=${token}`)
}

export async function ClientSMSFromBarberNudge(
  user_id: string,
  profile: {
    full_name: string
    email: string
    phone: string
    booking_link?: string
    username: string
  }
) {
  const supabase = await createSupabaseServerClient()

  await supabase
      .from('barber_nudge_success')
      .insert({
        user_id: user_id,
        iso_week_number: getISOWeek(),
        messages_delivered: 0,
        clicked_link: 0,
        client_ids: [],
        services: [],
        appointment_dates: []
      })

  // console.log(`Created barber_nudge_success for user ${userId}`)

  try {
    // Calculate limit based on Mondays in current month
    const mondaysCount = getMondaysInCurrentMonth()
    const limit = mondaysCount === 5 ? 8 : 10

    // Fetch preview recipients
    const previewResult = await fetchPreviewRecipients(user_id, limit)

    if (!previewResult.success) {
      return { success: false, error: previewResult.error }
    }

    if (!previewResult.data) {
      return { success: true, sent: 0, message: 'No clients to message'}
    }

    const previewData = previewResult.data

    // Generate SMS message once (without token)
    const messageResult = await generateSMSMessage(profile)

    if (!messageResult.success || !messageResult.message) {
      return { success: false, error: messageResult.error || 'Failed to generate message' }
    }

    const baseMessage = messageResult.message

    // Create a row in sms_scheduled_messages
    const { data: scheduledMessage, error: scheduledMessageInsertError } = await supabase
      .from('sms_scheduled_messages')
      .insert({
        user_id: user_id,
        title: `${user_id}_${getISOWeek()}`,
        message: baseMessage,
        status: 'ACCEPTED',
        purpose: 'auto-nudge',
        message_limit: limit,
        final_clients_to_message: previewData.phoneNumbers.length,
        is_running: true
      })
      .select()
      .single()

    if (scheduledMessageInsertError) {
      console.error('Failed to insert SMS Scheduled Message:', scheduledMessageInsertError)
      return { success: false, error: scheduledMessageInsertError || 'Failed to insert sms_scheduled_message' }
    }

    // Send SMS to all recipients
    const statusCallbackUrl = `${siteUrl}/api/barber-nudge/sms-status-client`
    const results = []

    for (let i = 0; i < previewData.phoneNumbers.length; i++) {
      const client = previewData.clients[i]
      const phoneNumber = client.phone
      const client_id = client?.client_id || null

      // Add unique token to the message
      const messageWithToken = addTokenToBookingLink(baseMessage, client.link_token, profile.username)

      try {
        const callbackUrl = new URL(statusCallbackUrl)
        callbackUrl.searchParams.set('user_id', user_id)
        callbackUrl.searchParams.set('client_id', client_id || '')
        callbackUrl.searchParams.set('message', messageWithToken)
        callbackUrl.searchParams.set('message_id', scheduledMessage.id)

        const twilioMessage = await twilio_client.messages.create({
          body: `${messageWithToken}\n\nReply STOP to unsubscribe.`,
          messagingServiceSid: messagingServiceSid,
          to: phoneNumber,
          statusCallback: callbackUrl.toString()
        })

        console.log(`Message sent to ${phoneNumber}: ${twilioMessage.sid}`)

        results.push({
          phone: phoneNumber,
          client_id: client_id,
          message_sid: twilioMessage.sid,
          status: 'sent'
        })
      } catch (error: any) {
        console.error(`Failed to send message to ${phoneNumber}:`, error)

        results.push({
          phone: phoneNumber,
          client_id: client_id,
          error: error.message,
          status: 'failed'
        })
      }
    }

    return {
      success: true,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    }
  } catch (error: any) {
    console.error('ClientSMSFromBarberNudge error:', error)
    return {
      success: false,
      error: error.message
    }
  }
}