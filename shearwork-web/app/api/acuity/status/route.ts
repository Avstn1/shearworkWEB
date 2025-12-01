import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: Request) {
  // const supabase = await createSupabaseServerClient()
  // const {
  //   data: { user },
  // } = await supabase.auth.getUser()

  const { user, supabase } = await getAuthenticatedUser(request)

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
