// app/api/auth/verify-web-token/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { authCodeCache } from '@/lib/redis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  console.log('========================================')
  console.log('🚀 VERIFY WEB TOKEN - START')
  console.log('========================================')
  
  try {
    const { code } = await req.json()
    console.log('📥 Received code:', code)

    if (!code) {
      console.log('❌ No code provided')
      return NextResponse.json(
        { error: 'Code is required' }, 
        { status: 400 }
      )
    }

    console.log('🔍 Looking up code in Redis...')
    
    // Get userId from Redis
    const userId = await authCodeCache.get(code)
    console.log('📦 Redis lookup result:', userId ? `Found user: ${userId}` : 'NOT FOUND')
    
    if (!userId) {
      console.error('❌ Code not found or expired:', code)
      return NextResponse.json({ 
        error: 'Invalid or expired code. Please try again from the app.' 
      }, { status: 401 })
    }

    console.log('✅ Code valid for user:', userId)
    console.log('🗑️  Deleting code from Redis...')

    // Delete code immediately (one-time use)
    await authCodeCache.delete(code)
    console.log('✅ Code deleted from Redis')

    console.log('👤 Fetching user from Supabase...')

    // Get user from Supabase
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)
    
    if (userError) {
      console.error('❌ Supabase getUserById error:', userError)
      console.error('Error details:', JSON.stringify(userError, null, 2))
    }
    
    if (!user) {
      console.error('❌ No user found for ID:', userId)
      return NextResponse.json(
        { error: 'User not found' }, 
        { status: 404 }
      )
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    })

    if (!user.email) {
      console.error('❌ User has no email:', user.id)
      return NextResponse.json(
        { error: 'User email not found' }, 
        { status: 404 }
      )
    }

    console.log('🔐 Generating magic link for user:', user.email)

    // Generate link - use 'magiclink' here
    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',  // ← Use 'magiclink' for generateLink
      email: user.email,
    })

    if (linkError) {
      console.error('❌ Generate link error:', linkError)
      console.error('Link error details:', JSON.stringify(linkError, null, 2))
      return NextResponse.json({ 
        error: 'Failed to generate session' 
      }, { status: 500 })
    }

    if (!data) {
      console.error('❌ No data returned from generateLink')
      return NextResponse.json({ 
        error: 'Failed to generate session - no data' 
      }, { status: 500 })
    }

    console.log('✅ Link generated successfully')
    console.log('📋 Link data keys:', Object.keys(data))
    console.log('📋 Properties keys:', data.properties ? Object.keys(data.properties) : 'NO PROPERTIES')
    console.log('📋 Full link data:', JSON.stringify(data, null, 2))

    // Get the hashed token
    const tokenHash = data.properties.hashed_token

    if (!tokenHash) {
      console.error('❌ No hashed_token in properties')
      console.error('Available properties:', JSON.stringify(data.properties, null, 2))
      return NextResponse.json({ 
        error: 'Failed to generate session tokens - no hash' 
      }, { status: 500 })
    }

    console.log('✅ Token hash obtained:', tokenHash.substring(0, 20) + '...')
    console.log('🔓 Verifying OTP with Supabase...')

    // Verify the OTP - use 'email' here (NOT 'magiclink')
    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      type: 'email',  // ← Use 'email' for verifyOtp
      token_hash: tokenHash,
      email: user.email,
    })

    if (sessionError) {
      console.error('❌ VerifyOtp error:', sessionError)
      console.error('Session error details:', JSON.stringify(sessionError, null, 2))
      console.error('Error message:', sessionError.message)
      console.error('Error status:', sessionError.status)
      return NextResponse.json({ 
        error: 'Failed to create session: ' + (sessionError?.message || 'Unknown error')
      }, { status: 500 })
    }

    if (!sessionData) {
      console.error('❌ No session data returned from verifyOtp')
      return NextResponse.json({ 
        error: 'Failed to create session - no data'
      }, { status: 500 })
    }

    console.log('📋 Session data keys:', Object.keys(sessionData))
    
    if (!sessionData.session) {
      console.error('❌ No session in sessionData')
      console.error('Session data:', JSON.stringify(sessionData, null, 2))
      return NextResponse.json({ 
        error: 'Failed to create session - no session object'
      }, { status: 500 })
    }

    console.log('✅ Session created successfully!')
    console.log('📋 Session keys:', Object.keys(sessionData.session))
    console.log('🎫 Access token (first 20 chars):', sessionData.session.access_token.substring(0, 20) + '...')
    console.log('🎫 Refresh token exists:', !!sessionData.session.refresh_token)
    console.log('👤 Session user ID:', sessionData.session.user?.id)

    const response = { 
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      user: {
        id: user.id,
        email: user.email
      }
    }

    console.log('📤 Sending response:', {
      access_token: response.access_token.substring(0, 20) + '...',
      refresh_token: response.refresh_token ? response.refresh_token.substring(0, 20) + '...' : 'MISSING',
      user: response.user
    })

    console.log('========================================')
    console.log('✅ VERIFY WEB TOKEN - SUCCESS')
    console.log('========================================')

    return NextResponse.json(response)
    
  } catch (err: any) {
    console.error('========================================')
    console.error('💥 VERIFY WEB TOKEN - FATAL ERROR')
    console.error('========================================')
    console.error('❌ Error name:', err.name)
    console.error('❌ Error message:', err.message)
    console.error('❌ Error stack:', err.stack)
    console.error('❌ Full error:', JSON.stringify(err, null, 2))
    console.error('========================================')
    
    return NextResponse.json(
      { error: 'Verification failed: ' + err.message },
      { status: 500 }
    )
  }
}