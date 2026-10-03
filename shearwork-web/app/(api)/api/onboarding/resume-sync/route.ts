import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { queueMonthsForSync } from '@/lib/booking/syncQueue'

// A month stuck in 'queued'/'processing' this long lost its job (e.g. a deploy
// interrupted it) and is safe to queue again
const STALE_AFTER_MS = 15 * 60 * 1000

/**
 * Re-queues every month that is not done: pending, retrying or failed, plus queued /
 * processing months that have gone stale. Months still genuinely in flight are left alone
 * so they don't run twice.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedUser(request)
    const { userId } = await request.json()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    if (user.id !== userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const admin = createSupabaseAdminClient()
    const { data: incomplete, error: fetchError } = await admin
      .from('sync_status')
      .select('month, year, sync_phase, status, updated_at')
      .eq('user_id', userId)
      .neq('status', 'completed')

    if (fetchError) throw fetchError

    const staleBefore = Date.now() - STALE_AFTER_MS
    const toQueue = (incomplete ?? []).filter(row => {
      if (row.status !== 'queued' && row.status !== 'processing') return true
      const updatedAt = row.updated_at ? Date.parse(row.updated_at) : 0
      return updatedAt < staleBefore
    })

    if (toQueue.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No incomplete syncs to resume',
        resumedCount: 0,
      })
    }

    const resumedCount = await queueMonthsForSync(admin, userId, toQueue)
    console.log(`🔄 Re-queued ${resumedCount}/${toQueue.length} incomplete syncs for user ${userId}`)

    return NextResponse.json({
      success: true,
      message: `Resumed ${resumedCount} syncs`,
      resumedCount,
    })
  } catch (error) {
    console.error('[resume-sync] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
