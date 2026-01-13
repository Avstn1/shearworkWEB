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
    console.log('Verifying web token for code:', code)

    if (!code) {
      return NextResponse.json(
        { error: 'Code is required' }, 
        { status: 400 }
      )
    }

    // Get userId from Redis
    const userId = await authCodeCache.get(code)
    console.log('Retrieved userId from cache:', userId)
    
    if (!userId) {
      console.error('❌ Code not found or expired:', code)
      return NextResponse.json({ 
        error: 'Invalid or expired code. Please try again from the app.' 
      }, { status: 401 })
    }

    // Delete code immediately (one-time use)
    await authCodeCache.delete(code)

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

    if (!user.email) {
      console.error('❌ User has no email:', user.id)
      return NextResponse.json(
        { error: 'User email not found' }, 
        { status: 404 }
      )
    }

    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink', 
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

    // Get the hashed token
    const tokenHash = data.properties.hashed_token

    if (!tokenHash) {
      console.error('❌ No hashed_token in properties')
      console.error('Available properties:', JSON.stringify(data.properties, null, 2))
      return NextResponse.json({ 
        error: 'Failed to generate session tokens - no hash' 
      }, { status: 500 })
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.verifyOtp({
      type: 'magiclink',  
      token_hash: tokenHash,
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
    
    if (!sessionData.session) {
      console.error('❌ No session in sessionData')
      console.error('Session data:', JSON.stringify(sessionData, null, 2))
      return NextResponse.json({ 
        error: 'Failed to create session - no session object'
      }, { status: 500 })
    }

    const response = { 
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      user: {
        id: user.id,
        email: user.email
      }
    }

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