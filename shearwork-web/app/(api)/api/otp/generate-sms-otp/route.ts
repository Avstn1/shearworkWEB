// app/api/otp/generate-sms-otp/route.ts
import { NextResponse } from 'next/server'
import { authCodeCache } from '@/lib/redis'
import { getAuthenticatedUser } from '@/utils/api-auth'
import crypto from "node:crypto";
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user || !user.id) {
      console.error('Token verification failed')
      return NextResponse.json(
        { error: 'Invalid or expired token' }, 
        { status: 401 }
      )
    }

    const body = await request.json()
    const { phoneNumber } = body

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use E.164 format (e.g., +13653781438)' },
        { status: 400 }
      )
    }
    
    // Validate Twilio credentials
    if (!accountSid || !authToken || !messagingServiceSid) {
      console.error('Missing Twilio credentials')
      return NextResponse.json(
        { error: 'SMS service not configured' },
        { status: 500 }
      )
    }

    // Generate 6-digit code
    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    
    // Store code in Redis with 10 minute expiry (600 seconds)
    await authCodeCache.set(code, user?.id, 600)

    // Initialize Twilio client here (not at module level)
    const client = twilio(accountSid, authToken);

    // Send SMS via Twilio
    try {
      const message = await client.messages.create({
        body: `Your Corva verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this message.`,
        messagingServiceSid: messagingServiceSid,
        to: phoneNumber
      });

      console.log('✅ Generated code for user:', user.id)
      console.log('✅ Sent verification SMS to:', phoneNumber)
      console.log('✅ Twilio message SID:', message.sid)
    } catch (smsError: any) {
      console.error('Twilio send error:', smsError)
      return NextResponse.json(
        { 
          error: 'Failed to send verification SMS',
          details: smsError.message 
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      message: 'Verification code sent to your phone',
      expiresIn: 600
    })
    
  } catch (err: any) {
    console.error('Generate SMS OTP error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to generate code' },
      { status: 500 }
    )
  }
}