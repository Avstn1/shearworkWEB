// app/api/auth/generate-web-token/route.ts
import { NextResponse } from 'next/server'
import { authCodeCache } from '@/lib/redis'
import { getAuthenticatedUser } from '@/utils/api-auth'
import crypto from "node:crypto";
import { SendMailClient } from "zeptomail";

const url = "https://api.zeptomail.ca/v1.1/email";
const token = `Zoho-enczapikey ${process.env.ZEPTOMAIL_TOKEN}`;
const client = new SendMailClient({ url, token });

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
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }
    
    const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
    
    await authCodeCache.set(code, user?.id, 10)

    // Send verification email via ZeptoMail
    try {
      await client.sendMail({
        "from": {
          "address": "noreply@corva.ca",
          "name": "Corva"
        },
        "to": [
          {
            "email_address": {
              "address": email,
              "name": "User"
            }
          }
        ],
        "subject": "Your Verification Code - ShearWork",
        "htmlbody": `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; margin-bottom: 20px;">Verify Your Email</h1>
            <p style="color: #666; font-size: 16px; margin-bottom: 30px;">
              Enter this code to verify your email address:
            </p>
            <div style="background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%); padding: 30px; text-align: center; border-radius: 10px; margin: 30px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a;">
                ${code}
              </span>
            </div>
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              This code will expire in 10 minutes.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        `
      });

      console.log('✅ Generated code for user:', user.id)
      console.log('✅ Sent verification email to:', email)
    } catch (emailError) {
      console.error('ZeptoMail send error:', emailError)
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ 
      message: 'Verification code sent to your email',
      expiresIn: 600
    })
    
  } catch (err: any) {
    console.error('Generate token error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to generate code' },
      { status: 500 }
    )
  }
}