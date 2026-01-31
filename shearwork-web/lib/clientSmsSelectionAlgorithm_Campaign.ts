// lib/clientSmsSelectionAlgorithm_Campaign.ts
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
  deselectedClients: ScoredClient[];
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
  messageId?: string
): Promise<CampaignResult> {
  const today = new Date();

  let selectedClients: any[] = [];
  let deselectedPhones: string[] = [];

  if (messageId) {
    const { data: messageData } = await supabase
      .from('sms_scheduled_messages')
      .select('selected_clients, deselected_clients')
      .eq('id', messageId)
      .single();

    if (messageData) {
      selectedClients = messageData.selected_clients || [];
      deselectedPhones = messageData.deselected_clients || [];
    }
  }

  // PHASE 1: Strict clients
  const strictClients = await getStrictClients(supabase, userId, today);
  const filteredStrict = strictClients.filter(
    c => c.phone_normalized && !deselectedPhones.includes(c.phone_normalized)
  ).map(c => ({ ...c, score: c.score + 500 }));

  const selectedCount = selectedClients.length;
  const algorithmLimit = Math.max(0, limit - selectedCount);

  let algorithmClients: ScoredClient[] = [];
  let allFilteredClients = [...filteredStrict];

  if (filteredStrict.length >= algorithmLimit) {
    algorithmClients = filteredStrict.slice(0, algorithmLimit);
  } else {
    const lenientClients = await getLenientClients(supabase, userId, today);
    const filteredLenient = lenientClients.filter(
      c => c.phone_normalized && !deselectedPhones.includes(c.phone_normalized)
    );
    const strictPhones = new Set(filteredStrict.map(c => c.phone_normalized));
    const uniqueLenient = filteredLenient.filter(c => !strictPhones.has(c.phone_normalized));
    allFilteredClients = [...filteredStrict, ...uniqueLenient];
    allFilteredClients.sort((a, b) => b.score - a.score);
    algorithmClients = allFilteredClients.slice(0, algorithmLimit);
  }

  const finalClients = [...selectedClients, ...algorithmClients];

  // Get ALL clients who weren't picked (have phone, haven't been texted in 14 days)
  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: allEligibleClients, error } = await supabase
  // acuity_clients change for testing
    .from('acuity_clients')
    .select('*')
    .eq('user_id', userId)
    .not('phone_normalized', 'is', null)
    .neq('sms_subscribed', false)
    .or(`date_last_sms_sent.is.null,date_last_sms_sent.lt.${fourteenDaysAgo.toISOString()}`)
    .gt('total_appointments', 0);

  let deselectedClients: ScoredClient[] = [];

  if (!error && allEligibleClients) {
    const finalPhones = new Set(finalClients.map(c => c.phone_normalized));
    
    // Score all eligible clients and filter out the ones that were selected
    const scoredEligible = allEligibleClients
      .map(client => {
        // Try strict scoring first, then lenient
        let scored = scoreClientStrict(client, today);
        if (scored.score === 0) {
          scored = scoreClientLenient(client, today);
        }
        return scored;
      })
      .filter(c => c.phone_normalized && !finalPhones.has(c.phone_normalized));

    // Deduplicate and sort
    deselectedClients = deduplicateByPhone(scoredEligible);
    deselectedClients.sort((a, b) => b.score - a.score);
  }

  return {
    clients: finalClients,
    deselectedClients,
    totalAvailableClients: finalClients.length + deselectedClients.length
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
  
  // acuity_clients change for testing
  const { data: clients, error } = await supabase
    .from('acuity_clients')
    .select('*')
    .eq('user_id', userId)
    .not('phone_normalized', 'is', null)
    .not('last_appt', 'is', null)
    .neq('sms_subscribed', false)
    .lt('last_appt', twoWeeksAgo.toISOString())
    .gt('total_appointments', 0)
    .gte('avg_weekly_visits', 0.01)
    .lte('avg_weekly_visits', 2.5)
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
  
  // acuity_clients change for testing
  const { data: clients, error } = await supabase
    .from('acuity_clients')
    .select('*')
    .eq('user_id', userId)
    .not('phone_normalized', 'is', null)
    .not('last_appt', 'is', null)
    .neq('sms_subscribed', false)
    .lt('last_appt', oneWeekAgo.toISOString())
    .gt('total_appointments', 0)
    .gte('avg_weekly_visits', 0.01)
    .lte('avg_weekly_visits', 2.5)
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

  // BLOCK NEGATIVE DAYS OVERDUE (clients who aren't due yet)
  if (daysOverdue < 0) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
  }

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
      score -= (daysAfter60 * 10);
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
  const proximityBonus = Math.max(0, 200 - (distanceFromOptimal * 5));

  // CONSISTENT: Must be between 0 and 45 days overdue (EXPANDED WINDOW)
  if (client.visiting_type === 'consistent') {
    if (daysOverdue >= 0 && daysOverdue <= 45) {
      score = 400 + (daysOverdue * 5) + proximityBonus; // HIGHER BASE SCORE
      if (daysOverdue > 10) {
        const daysAfter10 = daysOverdue - 10;
        score -= (daysAfter10 * 3); // REDUCED PENALTY
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // SEMI-CONSISTENT: Must be between 0 and 30 days overdue (EXPANDED WINDOW)
  else if (client.visiting_type === 'semi-consistent') {
    if (daysOverdue >= 0 && daysOverdue <= 30) {
      score = 350 + (daysOverdue * 4) + proximityBonus; // HIGHER BASE SCORE
      if (daysOverdue > 15) {
        const daysAfter15 = daysOverdue - 15;
        score -= (daysAfter15 * 3); // REDUCED PENALTY
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // EASY-GOING: Must be between 5 and 60 days overdue
  else if (client.visiting_type === 'easy-going') {
    if (daysOverdue >= 5 && daysOverdue <= 60) {
      score = 120 + ((daysOverdue - 5) * 2) + proximityBonus;
      if (daysOverdue > 20) {
        const daysAfter20 = daysOverdue - 20;
        score -= (daysAfter20 * 5);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // RARE: Must be between 10 and 90 days overdue
  else if (client.visiting_type === 'rare') {
    if (daysOverdue >= 10 && daysOverdue <= 90) {
      score = 100 + ((daysOverdue - 10) * 1.2) + proximityBonus;
      if (daysOverdue > 25) {
        const daysAfter25 = daysOverdue - 25;
        score -= (daysAfter25 * 5);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // NULL: Treat like easy-going (5-60 days overdue)
  else {
    if (daysOverdue >= 5 && daysOverdue <= 60) {
      score = 110 + ((daysOverdue - 5) * 2) + proximityBonus;
      if (daysOverdue > 20) {
        const daysAfter20 = daysOverdue - 20;
        score -= (daysAfter20 * 5);
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
    baseScore -= (excessDays * 10); // Lose 10 points per day after 60 days overdue
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
  const { error } = await supabase
    // acuity_clients change for testing
    .from('acuity_clients')
    .update({ date_last_sms_sent: new Date().toISOString() })
    .in('client_id', clientIds);

  if (error) {
    throw new Error(`Failed to update SMS sent dates: ${error.message}`);
  }
}