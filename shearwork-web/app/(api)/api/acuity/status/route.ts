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

  const { data: tokenRow, error: tokenError } = await supabase
    .rpc('get_acuity_token', { p_user_id: user.id })
    .single()

  if (!tokenRow) {
    return NextResponse.json({ connected: false }, { status: 200 })
  }

  return NextResponse.json({ connected: true }, { status: 200 })
}
