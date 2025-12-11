// app/api/auth/generate-web-token/route.ts
import { NextResponse } from 'next/server'
import { authCodeCache } from '@/lib/redis'
import { getAuthenticatedUser } from '@/utils/api-auth'
import crypto from "node:crypto";

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
    
    const code = crypto.randomInt(100000, 999999).toString(); 
    
    await authCodeCache.set(code, user?.id, 10)

    console.log('✅ Generated code for user:', user.id)
    console.log('Code:', code)
    return NextResponse.json({ // change this and dont return code
      code,
      expiresIn: 300
    })
    
  } catch (err: any) {
    console.error('Generate token error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to generate code' },
      { status: 500 }
    )
  }
}