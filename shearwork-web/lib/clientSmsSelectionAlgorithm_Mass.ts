// lib/sms/recentAppointmentCampaignAlgorithm.ts
import { SupabaseClient } from '@supabase/supabase-js'
import { AcuityClient, ScoredClient } from './clientSmsSelectionAlgorithm_AutoNudge'

export interface CampaignResult {
  clients: ScoredClient[];
  deselectedClients: ScoredClient[];
  totalAvailableClients: number;
}

export async function selectClientsForSMS_Mass(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50,
  messageId?: string
): Promise<CampaignResult> {
  // Calculate 1.5 years ago (18 months)
  const oneAndHalfYearsAgo = new Date()
  oneAndHalfYearsAgo.setMonth(oneAndHalfYearsAgo.getMonth() - 18)

  const query = supabase
  // acuity_clients_testing change for testing
    .from('acuity_clients_testing')
    .select('*')
    .eq('user_id', userId)
    .not('phone_normalized', 'is', null)
    .not('last_appt', 'is', null)
    .neq('sms_subscribed', false)
    .gt('total_appointments', 0)

  const { data: clients, error: queryError } = await query

  if (queryError) {
    throw new Error(`Failed to fetch clients: ${queryError.message}`)
  }

  if (!clients) {
    throw new Error('Clients query returned null')
  }

  const totalAvailableClients = clients.length

  if (clients.length === 0) {
    return {
      clients: [],
      deselectedClients: [],
      totalAvailableClients: 0,
    }
  }

  // Fetch selected_clients and deselected_clients if messageId is provided
  let selectedClients: ScoredClient[] = []
  let deselectedPhones: string[] = []

  if (messageId) {
    const { data: messageData } = await supabase
      .from('sms_scheduled_messages')
      .select('selected_clients, deselected_clients')
      .eq('id', messageId)
      .single()

    if (messageData) {
      selectedClients = messageData.selected_clients || []
      deselectedPhones = messageData.deselected_clients || []
    }
  }

  // Score all clients
  const today = new Date()
  const scoredClients: ScoredClient[] = clients.map(client =>
    scoreClientForHoliday(client, today)
  )

  // Remove manually deselected phones + ensure phone exists
  const filteredClients = scoredClients.filter(
    client =>
      client.phone_normalized !== null &&
      !deselectedPhones.includes(client.phone_normalized)
  )

  // Sort alphabetically by full name
  const sortedClients = filteredClients.toSorted((a, b) => {
    const aFullName = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase()
    const bFullName = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase()
    return aFullName.localeCompare(bFullName)
  })

  // Account for pre-selected clients
  const selectedCount = selectedClients.length
  const algorithmLimit = Math.max(0, limit - selectedCount)

  const algorithmClients = sortedClients.slice(0, algorithmLimit)

  const finalClients: ScoredClient[] = [
    ...selectedClients,
    ...algorithmClients,
  ]

  // --- NEW: compute deselected as set difference ---

  const finalPhoneSet = new Set(
    finalClients
      .map(c => c.phone_normalized)
      .filter((p): p is string => !!p)
  )

  const deselectedClients = scoredClients.filter(
    c => !c.phone_normalized || !finalPhoneSet.has(c.phone_normalized)
  )

  return {
    clients: finalClients,
    deselectedClients,
    totalAvailableClients,
  }
}

function scoreClientForHoliday(
  client: AcuityClient,
  today: Date
): ScoredClient {
  const lastApptDate = client.last_appt ? new Date(client.last_appt) : null

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
