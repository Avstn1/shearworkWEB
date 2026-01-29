import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const pageKey = searchParams.get('page_key')
  const version = Number(searchParams.get('version') ?? '1')

  if (!pageKey) {
    return NextResponse.json({ error: 'Missing page_key' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_page_tutorials')
    .select('seen_at, completed_at, dismissed_at, last_opened_at, version')
    .eq('user_id', user.id)
    .eq('page_key', pageKey)
    .eq('version', version)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    seen: Boolean(data?.seen_at),
    completed: Boolean(data?.completed_at),
    dismissed: Boolean(data?.dismissed_at),
    record: data ?? null,
  })
}
