// app/api/otp/verify-sms-otp/route.ts
import { NextResponse } from 'next/server'
import { authCodeCache } from '@/lib/redis'
import { getAuthenticatedUser } from '@/utils/api-auth'

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
    const { code, phoneNumber } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Verification code is required' },
        { status: 400 }
      )
    }

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      )
    }

    // Validate code format (6 digits)
    const codeRegex = /^\d{6}$/;
    if (!codeRegex.test(code)) {
      return NextResponse.json(
        { error: 'Invalid code format. Code must be 6 digits.' },
        { status: 400 }
      )
    }

    try {
      // Get user ID associated with this code from Redis
      const storedUserId = await authCodeCache.get(code)

      if (!storedUserId) {
        console.error('Code not found or expired:', code)
        return NextResponse.json(
          { error: 'Invalid or expired verification code' },
          { status: 400 }
        )
      }

      // Verify the code belongs to the authenticated user
      if (storedUserId !== user.id) {
        console.error('Code does not belong to user:', { storedUserId, userId: user.id })
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 400 }
        )
      }

      // Update user's phone number as verified in Supabase
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          phone: phoneNumber,
          phone_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Failed to update phone verification:', updateError)
        return NextResponse.json(
          { error: 'Failed to verify phone number' },
          { status: 500 }
        )
      }

      // Delete the used code from Redis
      await authCodeCache.delete(code)

      console.log('✅ Phone verified for user:', user.id)
      console.log('✅ Phone number:', phoneNumber)

      return NextResponse.json({ 
        success: true,
        message: 'Phone number verified successfully',
        phoneNumber: phoneNumber
      })

    } catch (verifyError: any) {
      console.error('Verification error:', verifyError)
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 500 }
      )
    }
    
  } catch (err: any) {
    console.error('Verify SMS OTP error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to verify code' },
      { status: 500 }
    )
  }
}