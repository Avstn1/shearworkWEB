import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username')

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Normalize username to lowercase
    const normalizedUsername = username.toLowerCase().trim()

    // Validate username format (alphanumeric and underscores only, 3-30 chars)
    if (!/^[a-z0-9_]{3,30}$/.test(normalizedUsername)) {
      return NextResponse.json(
        { available: false, error: 'Invalid username format' },
        { status: 400 }
      )
    }

    // Check if username exists
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', normalizedUsername)
      .maybeSingle()

    if (error) {
      console.error('Database error checking username:', error)
      return NextResponse.json(
        { error: 'Failed to check username availability' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      available: !data,
      username: normalizedUsername,
    })
  } catch (err) {
    console.error('Username check error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}