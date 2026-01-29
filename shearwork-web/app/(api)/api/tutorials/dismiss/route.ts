import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function POST(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const body = await request.json()
  const pageKey = body.page_key
  const version = Number(body.version ?? 1)

  if (!pageKey) {
    return NextResponse.json({ error: 'Missing page_key' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { data: existing, error: existingError } = await supabase
    .from('user_page_tutorials')
    .select('id')
    .eq('user_id', user.id)
    .eq('page_key', pageKey)
    .eq('version', version)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('user_page_tutorials')
      .update({ dismissed_at: now, last_opened_at: now })
      .eq('id', existing.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  }

  const { error: insertError } = await supabase
    .from('user_page_tutorials')
    .insert({
      user_id: user.id,
      page_key: pageKey,
      version,
      seen_at: now,
      dismissed_at: now,
      last_opened_at: now,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
