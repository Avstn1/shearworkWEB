import { NextResponse } from 'next/server'
import { TRIAL_DAYS } from '@/lib/constants/trial'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { grantTrialBonus } from '@/lib/credits'

export async function POST(request: Request) {
  try {
    const { user } = await getAuthenticatedUser(request)
    console.log('Authenticated user for trial start:', user?.id)

    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    // Trial and credit fields are protected from user writes; change them as the service role
    const admin = createSupabaseAdminClient()

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('trial_start, stripe_subscription_status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Failed to load trial status:', profileError)
      return NextResponse.json(
        { error: 'Failed to verify trial status' },
        { status: 500 },
      )
    }

    const status = profile?.stripe_subscription_status ?? ''
    const hasUsedTrial = Boolean(profile?.trial_start)
    const hasActiveSub = status === 'active' || status === 'trialing'

    if (hasUsedTrial || hasActiveSub) {
      return NextResponse.json(
        { error: 'Trial already used for this account' },
        { status: 400 },
      )
    }

    const now = new Date()
    const trialEnd = new Date(now)
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS)

    const { error: updateError } = await admin
      .from('profiles')
      .update({
        trial_start: now.toISOString(),
        trial_end: trialEnd.toISOString(),
        trial_active: true,
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to start trial:', updateError)
      return NextResponse.json(
        { error: 'Failed to start trial' },
        { status: 500 },
      )
    }

    let bonusApplied = false
    try {
      bonusApplied = await grantTrialBonus(user.id, null, admin)
    } catch (bonusError) {
      console.error('Failed to grant trial credits:', bonusError)
    }

    return NextResponse.json({
      success: true,
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      bonus_applied: bonusApplied,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start trial'
    console.error('Trial start error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
