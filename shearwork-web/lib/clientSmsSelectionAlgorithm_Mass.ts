// lib/sms/recentAppointmentCampaignAlgorithm.ts
import { SupabaseClient } from '@supabase/supabase-js'
import { AcuityClient, ScoredClient } from './clientSmsSelectionAlgorithm_Overdue'

export async function selectClientsForSMS_Mass(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50,
  visitingType?: string
): Promise<ScoredClient[]> {
  let query = supabase
    .from('acuity_clients')
    .select('*')
    .eq('user_id', userId)
    .not('phone_normalized', 'is', null)
    .not('last_appt', 'is', null)
    .gt('total_appointments', 0)
    .order('last_appt', { ascending: false }) // MOST RECENT FIRST
    .limit(limit)

  // Optional visiting_type filter
  if (visitingType) {
    query = query.eq('visiting_type', visitingType)
  }

  const { data: clients, error } = await query

  if (error) {
    throw new Error(`Failed to fetch clients: ${error.message}`)
  }

  if (!clients || clients.length === 0) {
    return []
  }

  // Map each client to include score and days_since_last_visit
  const today = new Date()
  const scoredClients: ScoredClient[] = clients.map(client =>
    scoreClientForHoliday(client, today)
  )

  return scoredClients
}

function scoreClientForHoliday(client: AcuityClient, today: Date): ScoredClient {
  const lastApptDate = client.last_appt ? new Date(client.last_appt) : null
  const lastSmsSentDate = client.date_last_sms_sent ? new Date(client.date_last_sms_sent) : null

  if (!lastApptDate) {
    return {
      ...client,
      score: 0,
      days_since_last_visit: 0,
      expected_visit_interval_days: 0,
      days_overdue: 0,
    }
  }

  let daysSinceLastVisit = Math.floor(
    (today.getTime() - lastApptDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Clamp to 0 minimum
  if (daysSinceLastVisit < 0) daysSinceLastVisit = 0

  const MAX_SCORE = 240
  const score = Math.max(0, MAX_SCORE - daysSinceLastVisit)

  return {
    ...client,
    score,
    days_since_last_visit: daysSinceLastVisit,
    expected_visit_interval_days: 0,
    days_overdue: 0,
  }
}
