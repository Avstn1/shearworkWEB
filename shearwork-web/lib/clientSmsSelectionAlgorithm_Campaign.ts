// lib/sms/holidayMassCampaignAlgorithm.ts
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
 * Selects clients for holiday mass campaigns.
 * Targets clients who haven't visited in 2+ weeks but less than 8 months.
 * Purpose: Re-engage clients during holiday periods when they have more free time.
 */
export async function selectClientsForSMS_Campaign(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50,
  visitingType?: string
): Promise<ScoredClient[]> {
  const today = new Date();
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const eightMonthsAgo = new Date(today);
  eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
  
  // Fetch eligible clients who haven't visited in 2 weeks to 8 months
  let query = supabase
    .from('acuity_clients_testing')
    .select('*')
    .eq('user_id', userId)
    .not('phone_normalized', 'is', null)
    .not('last_appt', 'is', null)
    .lt('last_appt', twoWeeksAgo.toISOString())
    .gt('last_appt', eightMonthsAgo.toISOString())
    .gt('total_appointments', 0)
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
    .map((client) => scoreClientForHoliday(client, today))
    .filter((client) => {
      if (client.score <= 0) return false;

      const daysSinceLastVisit = client.days_since_last_visit;

      // Ensure within 2 weeks to 8 months window
      return daysSinceLastVisit >= 14 && daysSinceLastVisit <= 240;
    });

  // Remove duplicates based on phone_normalized (keep the one with highest score)
  const uniqueClients = deduplicateByPhone(allScoredClients);

  // Sort by score (highest first)
  uniqueClients.sort((a, b) => b.score - a.score);

  console.log(`🎄 Holiday Campaign - Available clients: ${uniqueClients.length}`);

  // For mass campaigns, no complex distribution logic - just take top scoring clients
  const selectedClients = uniqueClients.slice(0, limit);

  console.log(`✅ Selected ${selectedClients.length} clients for holiday campaign`);

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

function scoreClientForHoliday(client: AcuityClient, today: Date): ScoredClient {
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

  // More lenient - don't message if SMS sent in last 7 days (vs 14 days in regular algorithm)
  if (daysSinceLastSms < 7) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: 0, days_overdue: 0 };
  }

  const expectedVisitIntervalDays = client.avg_weekly_visits 
    ? Math.round(7 / client.avg_weekly_visits)
    : 0;

  const daysOverdue = daysSinceLastVisit - expectedVisitIntervalDays;

  // LENIENT OVERDUE REQUIREMENTS FOR HOLIDAY CAMPAIGNS
  // Allow negative values (meaning they're not technically overdue yet)
  
  // CONSISTENT: Must be at exactly expected interval (0 days overdue or more)
  if (client.visiting_type === 'consistent') {
    if (daysOverdue >= 0) {
      score = 150 + (daysOverdue * 2);
    }
  }
  
  // SEMI-CONSISTENT: Can be up to 3 days early (-3 days overdue)
  else if (client.visiting_type === 'semi-consistent') {
    if (daysOverdue >= -3) {
      score = 160 + ((daysOverdue + 3) * 2);
    }
  }
  
  // EASY-GOING: Can be up to 10 days early (-10 days overdue)
  else if (client.visiting_type === 'easy-going') {
    if (daysOverdue >= -10) {
      score = 100 + ((daysOverdue + 10) * 1.5);
    }
  }
  
  // RARE: Can be up to 20 days early (-20 days overdue)
  else if (client.visiting_type === 'rare') {
    if (daysOverdue >= -20) {
      score = 80 + ((daysOverdue + 20) * 1);
    }
  }
  
  // NEW or NULL: Treat like easy-going
  else {
    if (daysOverdue >= -10) {
      score = 90 + ((daysOverdue + 10) * 1.5);
    }
  }

  // Bonus for longer absence (they really need re-engagement)
  if (daysSinceLastVisit > 365) {
    score += 20; // Been away over a year
  }
  if (daysSinceLastVisit > 540) {
    score += 30; // Been away over 18 months
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
    .from('acuity_clients')
    .update({ date_last_sms_sent: new Date().toISOString() })
    .in('client_id', clientIds);

  if (error) {
    throw new Error(`Failed to update SMS sent dates: ${error.message}`);
  }
}