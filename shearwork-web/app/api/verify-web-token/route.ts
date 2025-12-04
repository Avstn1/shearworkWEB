// app/api/auth/verify-web-token/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authCodeCache } from '@/lib/redis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json(
        { error: 'Code is required' }, 
        { status: 400 }
      )
    }

    console.log(`Verifying code: ${code}`)

    // Get userId from Redis
    const userId = await authCodeCache.get(code)
    
    if (!userId) {
      console.error('Code not found or expired:', code)
      return NextResponse.json({ 
        error: 'Invalid or expired code. Please try again from the app.' 
      }, { status: 401 })
    }

    console.log(`Code valid for user: ${userId}`)

    // Delete code immediately (one-time use)
    await authCodeCache.delete(code)

    // Get user from Supabase
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)
    
    if (userError || !user || !user.email) {
      console.error('User not found:', userError)
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      )
    }

    console.log(`Generating session for user: ${user.email}`)

    // Generate a magic link session (this creates valid tokens)
    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    })

    if (linkError || !data) {
      console.error('Failed to generate session:', linkError)
      return NextResponse.json({ 
        error: 'Failed to generate session' 
      }, { status: 500 })
    }

    // The properties object contains the hashed_token and redirect_to
    // We need to exchange this for actual session tokens
    // Use the action_link to create a proper session
    const actionLink = data.properties.action_link
    
    if (!actionLink) {
      console.error('No action link in response')
      return NextResponse.json({ 
        error: 'Failed to generate session tokens' 
      }, { status: 500 })
    }

    // Extract the token from the action link
    const url = new URL(actionLink)
    const token = url.searchParams.get('token')
    const type = url.searchParams.get('type')

    if (!token || type !== 'magiclink') {
      console.error('Invalid action link format')
      return NextResponse.json({ 
        error: 'Failed to generate session tokens' 
      }, { status: 500 })
    }

    // Verify the magic link token to get session tokens
    const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'magiclink',
    })

    if (verifyError || !sessionData.session) {
      console.error('Failed to verify magic link:', verifyError)
      return NextResponse.json({ 
        error: 'Failed to create session' 
      }, { status: 500 })
    }

    // Return the session tokens
    return NextResponse.json({ 
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      user: {
        id: user.id,
        email: user.email
      }
    })
    
  } catch (err: any) {
    console.error('Verify token error:', err)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}