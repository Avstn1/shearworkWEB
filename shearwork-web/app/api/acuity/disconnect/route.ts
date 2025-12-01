import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function POST(request: Request) {
  // const supabase = await createSupabaseServerClient()
  // const {
  //   data: { user },
  // } = await supabase.auth.getUser()

  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user) {
    return NextResponse.json({ error: 'User not logged in' }, { status: 401 })
  }

  // Get user's current token
  const { data: tokenData } = await supabase
    .from('acuity_tokens')
    .select('access_token')
    .eq('user_id', user.id)
    .single()

  if (tokenData?.access_token) {
    await fetch('https://acuityscheduling.com/oauth2/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        access_token: tokenData.access_token,
        client_id: process.env.ACUITY_CLIENT_ID!,
        client_secret: process.env.ACUITY_CLIENT_SECRET!,
      }),
    })
  }

  // Remove from Supabase
  await supabase.from('acuity_tokens').delete().eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
