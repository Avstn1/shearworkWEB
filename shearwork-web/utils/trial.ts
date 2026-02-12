import {
  TRIAL_DAYS,
  SOFT_PROMPT_DAY,
  URGENT_PROMPT_DAY,
  STRONG_PROMPT_DAY,
} from '@/lib/constants/trial'

export type TrialProfile = {
  trial_active?: boolean | null
  trial_start?: string | null
  trial_end?: string | null
  stripe_subscription_status?: string | null
}

export const isTrialActive = (profile?: TrialProfile | null): boolean => {
  if (profile?.stripe_subscription_status === 'trialing') return true
  if (!profile?.trial_active || !profile.trial_start || !profile.trial_end) return false

  const start = new Date(profile.trial_start)
  const end = new Date(profile.trial_end)
  const now = new Date()

  return now >= start && now <= end
}

/**
 * Returns which day of the trial the user is on (1-based).
 * Returns 0 if trial hasn't started.
 * Returns days beyond TRIAL_DAYS if trial has expired.
 */
export const getTrialDayNumber = (profile?: TrialProfile | null): number => {
  if (!profile?.trial_start) return 0

  const start = new Date(profile.trial_start)
  const now = new Date()

  // Reset to start of day for accurate day calculation
  start.setHours(0, 0, 0, 0)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const diffMs = today.getTime() - start.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Day 1 is the first day (diffDays = 0 means day 1)
  return diffDays + 1
}

/**
 * Returns days remaining in the trial.
 * Returns 0 if trial has expired or hasn't started.
 */
export const getTrialDaysRemaining = (profile?: TrialProfile | null): number => {
  if (!profile?.trial_start) return 0

  const dayNumber = getTrialDayNumber(profile)
  const remaining = TRIAL_DAYS - dayNumber + 1

  return Math.max(0, remaining)
}

/**
 * Returns true if soft prompt should show (Day 14-17, no payment method).
 */
export const shouldShowSoftPrompt = (
  profile?: TrialProfile | null,
  hasPaymentMethod?: boolean
): boolean => {
  if (hasPaymentMethod) return false
  if (!isTrialActive(profile)) return false

  const dayNumber = getTrialDayNumber(profile)
  return dayNumber >= SOFT_PROMPT_DAY && dayNumber < URGENT_PROMPT_DAY
}

/**
 * Returns true if urgent prompt should show (Day 18-20, no payment method).
 */
export const shouldShowUrgentPrompt = (
  profile?: TrialProfile | null,
  hasPaymentMethod?: boolean
): boolean => {
  if (hasPaymentMethod) return false
  if (!isTrialActive(profile)) return false

  const dayNumber = getTrialDayNumber(profile)
  return dayNumber >= URGENT_PROMPT_DAY && dayNumber < STRONG_PROMPT_DAY
}

/**
 * Returns true if strong/blocking prompt should show (Day 21+, no payment method).
 */
export const shouldShowStrongPrompt = (
  profile?: TrialProfile | null,
  hasPaymentMethod?: boolean
): boolean => {
  if (hasPaymentMethod) return false
  
  // If they have an active paid subscription, no prompt needed
  if (profile?.stripe_subscription_status === 'active') return false

  const dayNumber = getTrialDayNumber(profile)
  
  // Day 21+ and no payment method = blocked
  return dayNumber >= STRONG_PROMPT_DAY
}

/**
 * Returns the prompt mode that should be shown, or null if no prompt needed.
 */
export const getTrialPromptMode = (
  profile?: TrialProfile | null,
  hasPaymentMethod?: boolean
): 'soft' | 'urgent' | 'strong' | null => {
  if (shouldShowStrongPrompt(profile, hasPaymentMethod)) return 'strong'
  if (shouldShowUrgentPrompt(profile, hasPaymentMethod)) return 'urgent'
  if (shouldShowSoftPrompt(profile, hasPaymentMethod)) return 'soft'
  return null
}
