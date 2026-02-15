import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user's phone number
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('phone, full_name')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.phone) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 400 }
      )
    }

    // Initialize Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID_BARBERS

    if (!accountSid || !authToken || !messagingServiceSid) {
      console.error('Missing Twilio credentials')
      return NextResponse.json(
        { error: 'SMS service not configured' },
        { status: 500 }
      )
    }

    const twilioClient = twilio(accountSid, authToken)

    // Send confirmation SMS
    const message = "Corva will send smart booking reminders to past clients when you have openings. You'll be notified when someone books from your nudge."

    const twilioMessage = await twilioClient.messages.create({
      body: message,
      messagingServiceSid: messagingServiceSid,
      to: profile.phone,
    })

    console.log(`Auto-nudge confirmation sent to ${profile.full_name} (${profile.phone}): ${twilioMessage.sid}`)

    return NextResponse.json({
      success: true,
      message_sid: twilioMessage.sid,
    })
  } catch (error) {
    console.error('Error sending auto-nudge confirmation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send SMS' },
      { status: 500 }
    )
  }
}