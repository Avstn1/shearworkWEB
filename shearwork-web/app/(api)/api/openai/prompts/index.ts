import { monthlyRentalPrompt } from './monthlyRentalPrompt'
import { monthlyCommissionPrompt } from './monthlyCommissionPrompt'
import { weeklyRentalPrompt } from './weeklyRentalPrompt'
import { weeklyCommissionPrompt } from './weeklyCommissionPrompt'
import { weeklyComparisonRentalPrompt } from './weeklyComparisonRentalPrompt'
import { weeklyComparisonCommissionPrompt } from './weeklyComparisonCommissionPrompt'

export const prompts = {
  'monthly/rental': monthlyRentalPrompt,
  'monthly/commission': monthlyCommissionPrompt,
  'weekly/rental': weeklyRentalPrompt,
  'weekly/commission': weeklyCommissionPrompt,
  'weekly_comparison/rental': weeklyComparisonRentalPrompt,
  'weekly_comparison/commission': weeklyComparisonCommissionPrompt,
}
