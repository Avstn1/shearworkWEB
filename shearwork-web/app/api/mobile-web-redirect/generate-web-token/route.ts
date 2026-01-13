// app/api/auth/generate-web-token/route.ts
import { NextResponse } from 'next/server'
import { authCodeCache } from '@/lib/redis'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)

    // Generate a random one-time code
    const code = crypto.randomUUID()

    if (!user || !user.id) {
      console.error('Token verification failed')
      return NextResponse.json(
        { error: 'Invalid or expired token' }, 
        { status: 401 }
      )
    }
    
    await authCodeCache.set(code, user?.id, 300) // Code valid for 5 minutes

    return NextResponse.json({ 
      code,
      expiresIn: 300  // Code valid for 5 minutes
    })
    
  } catch (err: any) {
    console.error('Generate token error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to generate code' },
      { status: 500 }
    )
  }
}