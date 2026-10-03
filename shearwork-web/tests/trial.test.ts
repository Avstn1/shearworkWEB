import { describe, expect, it } from 'vitest'
import { isTrialActive } from '@/utils/trial'

const DAY = 24 * 60 * 60 * 1000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString()

describe('isTrialActive', () => {
  it('active card-less trial within its dates', () => {
    expect(isTrialActive({ trial_active: true, trial_start: iso(-3), trial_end: iso(18) })).toBe(true)
  })

  it('card-less trial past trial_end is over even if trial_active was never cleared', () => {
    expect(isTrialActive({ trial_active: true, trial_start: iso(-30), trial_end: iso(-9) })).toBe(false)
  })

  it('Stripe trialing status is active (Stripe owns the dates)', () => {
    expect(isTrialActive({ stripe_subscription_status: 'trialing' })).toBe(true)
  })

  it('canceled always loses access', () => {
    expect(isTrialActive({ stripe_subscription_status: 'canceled', trial_active: true, trial_end: iso(5) })).toBe(false)
  })

  it('no trial flag means no trial', () => {
    expect(isTrialActive({ trial_active: false, trial_start: iso(-1), trial_end: iso(5) })).toBe(false)
    expect(isTrialActive(null)).toBe(false)
  })

  it('legacy rows with the flag but no end date keep access', () => {
    expect(isTrialActive({ trial_active: true })).toBe(true)
  })
})
