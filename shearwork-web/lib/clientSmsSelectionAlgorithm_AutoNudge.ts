// lib/sms/clientSmsSelectionAlgorithm.ts
import { SupabaseClient } from '@supabase/supabase-js';

export interface AcuityClient {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  phone_normalized: string | null;
  first_appt: string | null;
  last_appt: string | null;
  visiting_type: 'new' | 'consistent' | 'semi-consistent' | 'easy-going' | 'rare' | null;
  avg_weekly_visits: number | null;
  total_appointments: number;
  date_last_sms_sent: string | null;
}

export interface ScoredClient extends AcuityClient {
  score: number;
  days_since_last_visit: number;
  expected_visit_interval_days: number;
  days_overdue: number;
}

/**
 * Selects up to 50 clients to send SMS marketing messages to.
 * Heavily prioritizes consistent and semi-consistent clients (90%).
 * Requires clients to be at least 14 days overdue based on their visit pattern.
 */
export async function selectClientsForSMS_AutoNudge(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50,
  visitingType?: string
): Promise<ScoredClient[]> {
  const today = new Date();
  
  // Fetch eligible clients
  let query = supabase
    // acuity_clients change for testing
    .from('test_acuity_clients')
    .select('*')
    .eq('user_id', userId)
    .not('phone_normalized', 'is', null)
    .not('last_appt', 'is', null)
    .neq('sms_subscribed', false)
    .gt('total_appointments', 1)
    .gte('avg_weekly_visits', 0.01)
    .lte('avg_weekly_visits', 2.5)
    .order('last_appt', { ascending: false });

  // Conditionally add visiting_type filter if provided
  if (visitingType) {
    query = query.eq('visiting_type', visitingType);
  }

  const { data: clients, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch clients: ${error.message}`);
  }

  if (!clients || clients.length === 0) {
    return [];
  }

  // Score and filter clients
  const allScoredClients: ScoredClient[] = clients
    .map((client) => scoreClient(client, today))
    .filter((client) => {
      if (client.score <= 0) return false;

      const daysSinceLastVisit = client.days_since_last_visit;

      // Apply time-based filters
      switch (client.visiting_type) {
        case 'consistent':
          return daysSinceLastVisit < 60;
        case 'semi-consistent':
          return daysSinceLastVisit < 90;
        case 'easy-going':
          return daysSinceLastVisit < 120;
        case 'rare':
          return daysSinceLastVisit < 210;
        default:
          return daysSinceLastVisit < 90;
      }
    });

  // Remove duplicates based on phone_normalized (keep the one with highest score)
  const uniqueClients = deduplicateByPhone(allScoredClients);

  // Sort by score (highest first)
  uniqueClients.sort((a, b) => b.score - a.score);

  // Separate by type
  const consistentAndSemiConsistent = uniqueClients.filter(
    c => c.visiting_type === 'consistent' || c.visiting_type === 'semi-consistent'
  );
  const others = uniqueClients.filter(
    c => c.visiting_type !== 'consistent' && c.visiting_type !== 'semi-consistent'
  );

  console.log(`📊 Available clients: Consistent/Semi=${consistentAndSemiConsistent.length}, Others=${others.length}`);

  // Target 90% consistent/semi-consistent
  const targetConsistentCount = Math.floor(limit * 0.9);
  
  const selectedClients: ScoredClient[] = [];

  // Fill with consistent/semi-consistent first
  selectedClients.push(...consistentAndSemiConsistent.slice(0, targetConsistentCount));

  // Fill remaining with others
  const remainingSlots = limit - selectedClients.length;
  if (remainingSlots > 0) {
    selectedClients.push(...others.slice(0, remainingSlots));
  }

  // If still under limit, add more consistent/semi-consistent
  if (selectedClients.length < limit && consistentAndSemiConsistent.length > targetConsistentCount) {
    const additionalNeeded = limit - selectedClients.length;
    selectedClients.push(...consistentAndSemiConsistent.slice(targetConsistentCount, targetConsistentCount + additionalNeeded));
  }

  console.log(`✅ Selected ${selectedClients.length} clients`);

  return selectedClients;
}

/**
 * Remove duplicate phone numbers, keeping the client with the highest score
 */
function deduplicateByPhone(clients: ScoredClient[]): ScoredClient[] {
  const phoneMap = new Map<string, ScoredClient>();

  for (const client of clients) {
    if (!client.phone_normalized) continue;

    const existing = phoneMap.get(client.phone_normalized);
    
    // Keep the client with higher score, or if same score, keep the one with more recent visit
    if (!existing || 
        client.score > existing.score || 
        (client.score === existing.score && client.days_since_last_visit < existing.days_since_last_visit)) {
      phoneMap.set(client.phone_normalized, client);
    }
  }

  return Array.from(phoneMap.values());
}

function scoreClient(client: AcuityClient, today: Date): ScoredClient {
  let score = 0;
  
  const lastApptDate = client.last_appt ? new Date(client.last_appt) : null;
  const lastSmsSentDate = client.date_last_sms_sent ? new Date(client.date_last_sms_sent) : null;
  
  if (!lastApptDate) {
    return { ...client, score: 0, days_since_last_visit: 0, expected_visit_interval_days: 0, days_overdue: 0 };
  }

  const daysSinceLastVisit = Math.floor((today.getTime() - lastApptDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceLastSms = lastSmsSentDate 
    ? Math.floor((today.getTime() - lastSmsSentDate.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  // Don't message if SMS sent in last 14 days
  if (daysSinceLastSms < 14) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: 0, days_overdue: 0 };
  }

  const expectedVisitIntervalDays = client.avg_weekly_visits 
    ? Math.round(7 / client.avg_weekly_visits)
    : 0;

  const daysOverdue = Math.max(0, daysSinceLastVisit - expectedVisitIntervalDays);

  // UNIVERSAL REQUIREMENT: Must be at least 14 days  
  if (daysOverdue < 14) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
  }

  // CONSISTENT: Score if at least 14 days overdue
  if (client.visiting_type === 'consistent') {
    score = 195 + (daysOverdue * 3);
  }
  
  // SEMI-CONSISTENT: Score if at least 14 days overdue
  else if (client.visiting_type === 'semi-consistent') {
    score = 200 + (daysOverdue * 3);
  }
  
  // EASY-GOING: Score if at least 14 days overdue
  else if (client.visiting_type === 'easy-going') {
    score = 25 + Math.min(daysOverdue, 10);
  }
  
  // RARE: Score if at least 14 days overdue
  else if (client.visiting_type === 'rare') {
    score = 10;
  }

  return {
    ...client,
    score,
    days_since_last_visit: daysSinceLastVisit,
    expected_visit_interval_days: expectedVisitIntervalDays,
    days_overdue: daysOverdue,
  };
}

export async function markClientsAsMessaged(
  supabase: SupabaseClient,
  clientIds: string[]
): Promise<void> {
  const { error } = await supabase
    // acuity_clients change for testing
    .from('test_acuity_clients')
    .update({ date_last_sms_sent: new Date().toISOString() })
    .in('client_id', clientIds);

  if (error) {
    throw new Error(`Failed to update SMS sent dates: ${error.message}`);
  }
}