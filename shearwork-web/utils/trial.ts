export type TrialProfile = {
  trial_active?: boolean | null
  trial_start?: string | null
  trial_end?: string | null
  stripe_subscription_status?: string | null
}

export const isTrialActive = (profile?: TrialProfile | null) => {
  if (profile?.stripe_subscription_status === 'trialing') return true
  if (!profile?.trial_active || !profile.trial_start || !profile.trial_end) return false

  const start = new Date(profile.trial_start)
  const end = new Date(profile.trial_end)
  const now = new Date()

  return now >= start && now <= end
}
