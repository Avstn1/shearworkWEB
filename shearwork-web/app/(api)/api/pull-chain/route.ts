// app/api/pull-chain/route.ts
//
// Internal-only endpoint. Never called by the frontend.
// Authenticated exclusively by service role key in Authorization header.
//
// Atomically claims the next pending sync_status row for a user, runs the pull,
// then fires itself again — forming a sequential chain with no timeout risk.
// FOR UPDATE SKIP LOCKED ensures two simultaneous triggers never process the same row.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { pull } from '@/lib/booking/orchestrator'
import { Month } from '@/lib/booking/types'
import { after } from 'next/server'

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  // Atomically claim the next pending row — SKIP LOCKED means a second
  // simultaneous chain for the same user will grab a different row, not this one
  const { data, error } = await serviceSupabase
    .rpc('claim_next_pending_sync', { p_user_id: userId })

  if (error) {
    console.error('[pull-chain] claim error:', error)
    return NextResponse.json({ error: 'Failed to claim next row' }, { status: 500 })
  }

  const next = data?.[0]
  if (!next) {
    console.log(`[pull-chain] Chain complete for user ${userId}`)
    return NextResponse.json({ message: 'Chain complete' })
  }

  console.log(`[pull-chain] Processing ${next.month} ${next.year} for user ${userId}`)

  try {
    await pull(serviceSupabase, userId, {
      granularity: 'month',
      month: next.month as Month,
      year: next.year,
    })

    await serviceSupabase
      .from('sync_status')
      .update({ status: 'completed', error_message: null, updated_at: new Date().toISOString() })
      .eq('id', next.id)

    console.log(`[pull-chain] ✓ ${next.month} ${next.year}`)
  } catch (err) {
    console.error(`[pull-chain] ✗ ${next.month} ${next.year}:`, err)

    // One bad month does not stall the chain
    await serviceSupabase.rpc('increment_sync_retry_and_fail', {
      row_id: next.id,
      error_msg: String(err),
    })
  }

  // Use after() so Vercel keeps the function alive until the next fetch completes
  // Without this, Vercel kills the process as soon as the response is sent
  const nextHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    'x-vercel-protection-bypass': process.env.BYPASS_TOKEN ?? '',
  }
  const nextBody = JSON.stringify({ userId })

  after(async () => {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/pull-chain`, {
      method: 'POST',
      headers: nextHeaders,
      body: nextBody,
    }).catch((err) => console.error('[pull-chain] Failed to fire next link:', err))
  })

  return NextResponse.json({ message: 'ok', processed: `${next.month} ${next.year}` })
}