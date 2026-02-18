import { NextResponse } from 'next/server'
import { TRIAL_BONUS_CREDITS, TRIAL_DAYS } from '@/lib/constants/trial'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function POST(request: Request) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    console.log('Authenticated user for trial start:', user?.id)

    if (!user) {
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL))
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('trial_start, stripe_subscription_status, available_credits, reserved_credits')
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

    const { data: trialBonus, error: trialBonusError } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('user_id', user.id)
      .eq('action', 'trial_bonus')
      .maybeSingle()

    if (trialBonusError) {
      console.error('Failed to check trial bonus:', trialBonusError)
      return NextResponse.json(
        { error: 'Failed to verify trial bonus' },
        { status: 500 },
      )
    }

    const existingCredits = profile?.available_credits ?? 0
    const existingReserved = profile?.reserved_credits ?? 0
    const shouldGrantTrialCredits = !trialBonus
    const profileUpdate: Record<string, unknown> = {
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      trial_active: true,
    }

    if (shouldGrantTrialCredits) {
      profileUpdate.available_credits = existingCredits + TRIAL_BONUS_CREDITS
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to start trial:', updateError)
      return NextResponse.json(
        { error: 'Failed to start trial' },
        { status: 500 },
      )
    }

    if (shouldGrantTrialCredits) {
      const { error: creditError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: user.id,
          action: 'trial_bonus',
          old_available: existingCredits,
          new_available: existingCredits + TRIAL_BONUS_CREDITS,
          old_reserved: existingReserved,
          new_reserved: existingReserved,
          created_at: new Date().toISOString(),
        })

      if (creditError) {
        console.error('Failed to log trial credits:', creditError)
      }
    }

    return NextResponse.json({
      success: true,
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      bonus_applied: shouldGrantTrialCredits,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start trial'
    console.error('Trial start error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
