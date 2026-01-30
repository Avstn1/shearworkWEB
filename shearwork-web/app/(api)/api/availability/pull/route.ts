import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { pullAvailability } from '@/lib/booking/availability/orchestrator'

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === 'true'
  const forceRefresh = searchParams.get('forceRefresh') === 'true'
  const updateMode = searchParams.get('mode') === 'update'

  try {
    const result = await pullAvailability(supabase, user.id, { dryRun, forceRefresh, updateMode })

    return NextResponse.json({
      endpoint: 'availability',
      dryRun,
      forceRefresh,
      result,
    })
  } catch (err) {
    console.error('Availability pull error:', err)
    return NextResponse.json({
      error: 'Availability pull failed',
      details: String(err),
    }, { status: 500 })
  }
}
