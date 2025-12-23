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

export interface CampaignResult {
  clients: ScoredClient[];
  totalAvailableClients: number;
}

/**
 * Selects clients for holiday mass campaigns.
 * First uses strict criteria, then fills remaining slots with lenient criteria.
 */
export async function selectClientsForSMS_Campaign(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50,
): Promise<CampaignResult> {
  const today = new Date();
  
  // PHASE 1: Get clients with STRICT criteria (original algorithm)
  const strictClients = await getStrictClients(supabase, userId, today);
  
  // Boost strict clients' scores by 500 to ensure they're prioritized
  const boostedStrictClients = strictClients.map(client => ({
    ...client,
    score: client.score + 500
  }));
  
  // If we have enough, return them
  if (boostedStrictClients.length >= limit) {
    const selected = boostedStrictClients.slice(0, limit);
    
    // FINAL STEP: Convert negative overdue to 0
    const finalSelected = selected.map(client => ({
      ...client,
      days_overdue: Math.max(0, client.days_overdue)
    }));
    
    return {
      clients: finalSelected,
      totalAvailableClients: boostedStrictClients.length
    };
  }
  
  // PHASE 2: Need more clients - use LENIENT criteria
  const lenientClients = await getLenientClients(supabase, userId, today);
  
  // Remove duplicates - exclude anyone already in strict list
  const strictPhones = new Set(boostedStrictClients.map(c => c.phone_normalized));
  const beforeDedup = lenientClients.length;
  const uniqueLenientClients = lenientClients.filter(
    client => !strictPhones.has(client.phone_normalized)
  );
  
  // Combine both lists (strict clients already have +500 boost, so they'll be first when sorted)
  const allClients = [...boostedStrictClients, ...uniqueLenientClients];
  
  // Sort by score (highest first)
  allClients.sort((a, b) => b.score - a.score);
  
  // Take top N
  const selectedClients = allClients.slice(0, limit);
  
  // FINAL STEP: Convert negative overdue to 0
  const finalSelectedClients = selectedClients.map(client => ({
    ...client,
    days_overdue: Math.max(0, client.days_overdue)
  }));
  
  const strictSelected = finalSelectedClients.filter(c => c.score >= 500).length;
  const lenientSelected = finalSelectedClients.length - strictSelected;
  
  return {
    clients: finalSelectedClients,
    totalAvailableClients: allClients.length
  };
}

/**
 * Get clients using STRICT criteria (original algorithm)
 */
async function getStrictClients(
  supabase: SupabaseClient,
  userId: string,
  today: Date
): Promise<ScoredClient[]> {
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const eightMonthsAgo = new Date(today);
  eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
  
  // acuity_clients change for testing
  const { data: clients, error } = await supabase
    .from('acuity_clients_testing')
    .select('*')
    .eq('user_id', userId)
    .not('phone_normalized', 'is', null)
    .not('last_appt', 'is', null)
    .neq('sms_subscribed', false)
    .lt('last_appt', twoWeeksAgo.toISOString())
    .gt('last_appt', eightMonthsAgo.toISOString())
    .gt('total_appointments', 0)
    .order('last_appt', { ascending: false });

  if (error || !clients || clients.length === 0) {
    return [];
  }

  // Score with STRICT algorithm
  const scoredClients = clients.map((client) => scoreClientStrict(client, today));
  const afterScoreFilter = scoredClients.filter((client) => client.score > 0);

  // Remove duplicates
  const uniqueClients = deduplicateByPhone(afterScoreFilter);
  
  // Sort by score
  uniqueClients.sort((a, b) => b.score - a.score);
  
  return uniqueClients;
}

/**
 * Get clients using LENIENT criteria (for filling gaps)
 */
async function getLenientClients(
  supabase: SupabaseClient,
  userId: string,
  today: Date
): Promise<ScoredClient[]> {
  // Much wider time window
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const twoYearsAgo = new Date(today);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  
  // acuity_clients change for testing
  const { data: clients, error } = await supabase
    .from('acuity_clients_testing')
    .select('*')
    .eq('user_id', userId)
    .not('phone_normalized', 'is', null)
    .not('last_appt', 'is', null)
    .neq('sms_subscribed', false)
    .lt('last_appt', oneWeekAgo.toISOString())
    .gt('last_appt', twoYearsAgo.toISOString())
    .gt('total_appointments', 0)
    .order('last_appt', { ascending: false });

  if (error || !clients || clients.length === 0) {
    return [];
  }

  // Score with LENIENT algorithm
  const scoredClients = clients.map((client) => scoreClientLenient(client, today));
  const afterScoreFilter = scoredClients.filter((client) => client.score > 0);

  // Remove duplicates
  const uniqueClients = deduplicateByPhone(afterScoreFilter);
  
  // Sort by score
  uniqueClients.sort((a, b) => b.score - a.score);
  
  return uniqueClients;
}

/**
 * STRICT scoring (original algorithm)
 */
function scoreClientStrict(client: AcuityClient, today: Date): ScoredClient {
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

  if (daysSinceLastSms < 7) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: 0, days_overdue: 0 };
  }

  const expectedVisitIntervalDays = client.avg_weekly_visits 
    ? Math.round(7 / client.avg_weekly_visits)
    : 0;

  const daysOverdue = daysSinceLastVisit - expectedVisitIntervalDays;

  // NEW CLIENTS
  if (client.visiting_type === 'new' || client.total_appointments === 1) {
    if (daysSinceLastVisit < 21) {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: 0, days_overdue: 0 };
    }
    
    const daysAfter21 = daysSinceLastVisit - 21;
    const newClientProximityBonus = Math.max(0, 200 - (daysAfter21 * 2));
    score = 90 + newClientProximityBonus;
    
    if (daysSinceLastVisit > 60) {
      const daysAfter60 = daysSinceLastVisit - 60;
      score -= (daysAfter60 * 3);
    }
    
    return {
      ...client,
      score: Math.max(0, score),
      days_since_last_visit: daysSinceLastVisit,
      expected_visit_interval_days: expectedVisitIntervalDays,
      days_overdue: daysOverdue,
    };
  }

  const optimalOverdue = 10;
  const distanceFromOptimal = Math.abs(daysOverdue - optimalOverdue);
  const proximityBonus = Math.max(0, 150 - (distanceFromOptimal * 7.5));

  // CONSISTENT: Must be between 0 and 30 days overdue (not too late, not early)
  if (client.visiting_type === 'consistent') {
    if (daysOverdue >= 0 && daysOverdue <= 30) {
      score = 250 + (daysOverdue * 4) + proximityBonus;
      if (daysOverdue > 10) {
        const daysAfter10 = daysOverdue - 10;
        score -= (daysAfter10 * 5);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // SEMI-CONSISTENT: Must be between -1 and 20 days overdue
  else if (client.visiting_type === 'semi-consistent') {
    if (daysOverdue >= -1 && daysOverdue <= 20) {
      score = 220 + ((daysOverdue + 1) * 3.5) + proximityBonus;
      if (daysOverdue > 15) {
        const daysAfter15 = daysOverdue - 15;
        score -= (daysAfter15 * 3.5);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // EASY-GOING: Must be between 5 and 60 days overdue
  else if (client.visiting_type === 'easy-going') {
    if (daysOverdue >= 5 && daysOverdue <= 60) {
      score = 100 + ((daysOverdue - 5) * 1.5) + proximityBonus;
      if (daysOverdue > 20) {
        const daysAfter20 = daysOverdue - 20;
        score -= (daysAfter20 * 2.5);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // RARE: Must be between 10 and 90 days overdue
  else if (client.visiting_type === 'rare') {
    if (daysOverdue >= 10 && daysOverdue <= 90) {
      score = 80 + ((daysOverdue - 10) * 1) + proximityBonus;
      if (daysOverdue > 25) {
        const daysAfter25 = daysOverdue - 25;
        score -= (daysAfter25 * 2.5);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // NULL: Treat like easy-going (5-60 days overdue)
  else {
    if (daysOverdue >= 5 && daysOverdue <= 60) {
      score = 90 + ((daysOverdue - 5) * 1.5) + proximityBonus;
      if (daysOverdue > 20) {
        const daysAfter20 = daysOverdue - 20;
        score -= (daysAfter20 * 2.5);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }

  if (daysOverdue <= 30) {
    if (daysSinceLastVisit > 365) {
      score += 20;
    }
    if (daysSinceLastVisit > 540) {
      score += 30;
    }
  }

  return {
    ...client,
    score: Math.max(0, score),
    days_since_last_visit: daysSinceLastVisit,
    expected_visit_interval_days: expectedVisitIntervalDays,
    days_overdue: daysOverdue,
  };
}

/**
 * LENIENT scoring (for filling gaps - prevents prioritizing very old clients)
 */
function scoreClientLenient(client: AcuityClient, today: Date): ScoredClient {
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

  // ALWAYS require 15 days since last SMS for lenient
  if (daysSinceLastSms < 15) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: 0, days_overdue: 0 };
  }

  const expectedVisitIntervalDays = client.avg_weekly_visits 
    ? Math.round(7 / client.avg_weekly_visits)
    : 0;

  const daysOverdue = daysSinceLastVisit - expectedVisitIntervalDays;

  // LENIENT: Allow slightly older clients, but still cap it
  // Maximum 120 days overdue for lenient (4 months past their expected visit)
  if (daysOverdue > 120) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
  }

  // Scoring that DOESN'T increase infinitely with days overdue
  let baseScore = 200;
  
  // Penalty for being TOO overdue (clients who are likely gone)
  if (daysOverdue > 60) {
    const excessDays = daysOverdue - 60;
    baseScore -= (excessDays * 3); // Lose 3 points per day after 60 days overdue
  }
  
  // Small bonus for being near optimal
  const optimalOverdue = 15;
  const distanceFromOptimal = Math.abs(daysOverdue - optimalOverdue);
  const proximityBonus = Math.max(0, 50 - (distanceFromOptimal * 2));
  
  score = baseScore + proximityBonus;

  return {
    ...client,
    score: Math.max(0, score),
    days_since_last_visit: daysSinceLastVisit,
    expected_visit_interval_days: expectedVisitIntervalDays,
    days_overdue: daysOverdue,
  };
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

export async function markClientsAsMessaged(
  supabase: SupabaseClient,
  clientIds: string[]
): Promise<void> {
  // acuity_clients change for testing
  const { error } = await supabase
    .from('acuity_clients_testing')
    .update({ date_last_sms_sent: new Date().toISOString() })
    .in('client_id', clientIds);

  if (error) {
    throw new Error(`Failed to update SMS sent dates: ${error.message}`);
  }
}