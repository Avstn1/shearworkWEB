import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key from Supabase dashboard
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(req: Request) {
  try {
    const { session_id } = await req.json()

    if (!session_id) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    console.log('Attempting to revoke session:', session_id)

    // Revoke the session using admin privileges
    // This will immediately invalidate the session
    const { error } = await supabaseAdmin.auth.admin.signOut(session_id)

    if (error) {
      console.error('Error revoking session:', error)
      throw error
    }

    console.log('Session revoked successfully:', session_id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to revoke session:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to revoke session' }, 
      { status: 500 }
    )
  }
}