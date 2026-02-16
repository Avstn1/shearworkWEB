import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: NextRequest) {
  console.log('[USERNAME CHECK] Request received')
  
  try {
    // Step 1: Authenticate user
    console.log('[USERNAME CHECK] Authenticating user...')
    let user, supabase
    
    try {
      const authResult = await getAuthenticatedUser(request)
      user = authResult.user
      supabase = authResult.supabase
      console.log('[USERNAME CHECK] User authenticated:', user.id)
    } catch (authError) {
      console.error('[USERNAME CHECK] Authentication failed:', authError)
      return NextResponse.json(
        { 
          error: 'Authentication failed',
          details: authError instanceof Error ? authError.message : 'Unknown auth error'
        },
        { status: 401 }
      )
    }
    
    // Step 2: Get username from query params
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')
    console.log('[USERNAME CHECK] Username param:', username)

    if (!username) {
      console.log('[USERNAME CHECK] No username provided')
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Step 3: Normalize username
    const normalizedUsername = username.toLowerCase().trim()
    console.log('[USERNAME CHECK] Normalized username:', normalizedUsername)

    // Step 4: Validate username format
    if (!/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
      console.log('[USERNAME CHECK] Invalid username format:', normalizedUsername)
      return NextResponse.json(
        { available: false, error: 'Invalid username format' },
        { status: 400 }
      )
    }

    // Step 5: Query database
    console.log('[USERNAME CHECK] Querying database for username:', normalizedUsername)
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', normalizedUsername)
      .maybeSingle()

    if (error) {
      console.error('[USERNAME CHECK] Database error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to check username availability',
          details: error.message,
          code: error.code
        },
        { status: 500 }
      )
    }

    console.log('[USERNAME CHECK] Database query result:', data ? 'Username exists' : 'Username available')

    // Step 6: Return result
    return NextResponse.json({
      available: !data,
      username: normalizedUsername,
    })
  } catch (err) {
    console.error('[USERNAME CHECK] Unexpected error:', err)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined
      },
      { status: 500 }
    )
  }
}