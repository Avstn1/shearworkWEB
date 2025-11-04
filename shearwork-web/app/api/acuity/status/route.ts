import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ connected: false })
  }

  const { data, error } = await supabase
    .from('acuity_tokens')
    .select('access_token')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ connected: !!data && !error })
}
