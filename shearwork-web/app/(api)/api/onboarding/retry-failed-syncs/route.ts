import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { queueMonthsForSync } from '@/lib/booking/syncQueue'

/** Re-queues every month whose sync failed after all retries. */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { userId } = await request.json()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    if (user.id !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const admin = createSupabaseAdminClient()
    const { data: failedSyncs, error: fetchError } = await admin
      .from('sync_status')
      .select('month, year, sync_phase')
      .eq('user_id', userId)
      .eq('status', 'failed')

    if (fetchError) throw fetchError

    if (!failedSyncs || failedSyncs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No failed syncs to retry',
        retriedCount: 0,
      })
    }

    await admin
      .from('sync_status')
      .update({ retry_count: 0, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('status', 'failed')

    const retriedCount = await queueMonthsForSync(admin, userId, failedSyncs)

    return NextResponse.json({
      success: true,
      message: `Retrying ${retriedCount} failed syncs`,
      retriedCount,
    })
  } catch (error) {
    console.error('[retry-failed-syncs] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
