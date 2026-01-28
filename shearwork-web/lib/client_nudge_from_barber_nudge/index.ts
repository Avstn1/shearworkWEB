import twilio from 'twilio'

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

export async function ClientSMSFromBarberNudge(
  user_id: string,
  profile: {
    full_name: string
    email: string
    phone: string
    booking_link?: string
  }
) {
  try {
    // Calculate limit based on Mondays in current month
    const mondaysCount = getMondaysInCurrentMonth()
    const limit = mondaysCount === 5 ? 8 : 10

    // Fetch preview recipients
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
        sent: 0,
        message: 'No clients to message'
      }
    }

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
          booking_link: profile.booking_link
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

    // Send SMS to all recipients
    const statusCallbackUrl = `${siteUrl}/api/barber-nudge/sms-status-client`
    const results = []

    for (let i = 0; i < previewData.phoneNumbers.length; i++) {
      const phoneNumber = previewData.phoneNumbers[i]
      const client = previewData.clients[i]
      const client_id = client?.client_id || null

      try {
        const callbackUrl = new URL(statusCallbackUrl)
        callbackUrl.searchParams.set('user_id', user_id)
        callbackUrl.searchParams.set('client_id', client_id || '')
        callbackUrl.searchParams.set('message', message)

        const twilioMessage = await twilio_client.messages.create({
          body: `${message}\n\nReply STOP to unsubscribe.`,
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