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
): Promise<ScoredClient[]> {
  const today = new Date();
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const eightMonthsAgo = new Date(today);
  eightMonthsAgo.setMonth(eightMonthsAgo.getMonth() - 8);
  
  // Fetch eligible clients who haven't visited in 2 weeks to 8 months
  const { data: clients, error } = await supabase
    .from('acuity_clients')
    .select('*')
    .eq('user_id', userId)
    .not('phone_normalized', 'is', null)
    .not('last_appt', 'is', null)
    .lt('last_appt', twoWeeksAgo.toISOString())
    .gt('last_appt', eightMonthsAgo.toISOString())
    .gt('total_appointments', 0)
    .order('last_appt', { ascending: false });

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

  // More lenient - don't message if SMS sent in last 7 days (vs 14 days in regular algorithm)
  if (daysSinceLastSms < 7) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: 0, days_overdue: 0 };
  }

  const expectedVisitIntervalDays = client.avg_weekly_visits 
    ? Math.round(7 / client.avg_weekly_visits)
    : 0;

  const daysOverdue = daysSinceLastVisit - expectedVisitIntervalDays;

  // NEW CLIENTS: Special handling
  if (client.visiting_type === 'new' || client.total_appointments === 1) {
    // Don't message if it's been less than 21 days since last visit
    if (daysSinceLastVisit < 21) {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: 0, days_overdue: 0 };
    }
    
    // The closer to 21 days, the higher the score
    // At 21 days: highest score
    // Score decreases as days increase beyond 21
    const daysAfter21 = daysSinceLastVisit - 21;
    const newClientProximityBonus = Math.max(0, 200 - (daysAfter21 * 2));
    
    score = 90 + newClientProximityBonus;
    
    // After 60 days total (39 days after the 21-day mark), start losing score
    if (daysSinceLastVisit > 60) {
      const daysAfter60 = daysSinceLastVisit - 60;
      score -= (daysAfter60 * 3); // Lose 3 points per day after 60
    }
    
    return {
      ...client,
      score: Math.max(0, score),
      days_since_last_visit: daysSinceLastVisit,
      expected_visit_interval_days: expectedVisitIntervalDays,
      days_overdue: daysOverdue,
    };
  }

  // EXISTING CLIENTS: Proximity to 10 days overdue
  // Calculate proximity bonus: The closer to 10 days overdue, the higher the bonus
  const optimalOverdue = 10;
  const distanceFromOptimal = Math.abs(daysOverdue - optimalOverdue);
  
  // Proximity bonus decreases as you move away from 10
  // At 10 days overdue: +150 bonus (increased from 100)
  // At 0 or 20 days overdue: +75 bonus
  // At -10 or 30 days overdue: +0 bonus
  const proximityBonus = Math.max(0, 150 - (distanceFromOptimal * 7.5));

  // STRICTER OVERDUE REQUIREMENTS FOR HOLIDAY CAMPAIGNS
  
  // CONSISTENT: Never message if negative overdue (they're early)
  // HIGHEST PRIORITY - Boost base score significantly
  if (client.visiting_type === 'consistent') {
    if (daysOverdue >= 0) {
      score = 250 + (daysOverdue * 4) + proximityBonus; // Increased from 150 base, 2x multiplier
      
      // Start penalizing at 10 days overdue with HIGH penalty curve
      if (daysOverdue > 10) {
        const daysAfter10 = daysOverdue - 10;
        score -= (daysAfter10 * 5); // High penalty: -5 points per day
      }
    } else {
      // Negative overdue = don't message
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // SEMI-CONSISTENT: Never message if less than -1 day overdue
  // HIGH PRIORITY - Boost base score
  else if (client.visiting_type === 'semi-consistent') {
    if (daysOverdue >= -1) {
      score = 220 + ((daysOverdue + 1) * 3.5) + proximityBonus; // Increased from 160 base, higher multiplier
      
      // Start penalizing at 15 days overdue with MEDIUM-HIGH penalty curve
      if (daysOverdue > 15) {
        const daysAfter15 = daysOverdue - 15;
        score -= (daysAfter15 * 3.5); // Medium-high penalty: -3.5 points per day
      }
    } else {
      // Less than -1 days overdue = don't message
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // EASY-GOING: Never message if less than 5 days overdue
  else if (client.visiting_type === 'easy-going') {
    if (daysOverdue >= 5) {
      score = 100 + ((daysOverdue - 5) * 1.5) + proximityBonus;
      
      // Start penalizing at 20 days overdue with MEDIUM penalty curve
      if (daysOverdue > 20) {
        const daysAfter20 = daysOverdue - 20;
        score -= (daysAfter20 * 2.5); // Medium penalty: -2.5 points per day
      }
    } else {
      // Less than 5 days overdue = don't message
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // RARE: Never message if less than 10 days overdue
  else if (client.visiting_type === 'rare') {
    if (daysOverdue >= 10) {
      score = 80 + ((daysOverdue - 10) * 1) + proximityBonus;
      
      // Start penalizing at 25 days overdue with MEDIUM penalty curve (same as easy-going)
      if (daysOverdue > 25) {
        const daysAfter25 = daysOverdue - 25;
        score -= (daysAfter25 * 2.5); // Medium penalty: -2.5 points per day
      }
    } else {
      // Less than 10 days overdue = don't message
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }
  
  // NULL visiting_type: Treat like easy-going (require 5 days overdue)
  else {
    if (daysOverdue >= 5) {
      score = 90 + ((daysOverdue - 5) * 1.5) + proximityBonus;
      
      // Start penalizing at 20 days overdue (same as easy-going)
      if (daysOverdue > 20) {
        const daysAfter20 = daysOverdue - 20;
        score -= (daysAfter20 * 2.5); // Medium penalty: -2.5 points per day
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }

  // Bonus for longer absence (they really need re-engagement) - only for clients not heavily penalized
  if (daysOverdue <= 30) {
    if (daysSinceLastVisit > 365) {
      score += 20; // Been away over a year
    }
    if (daysSinceLastVisit > 540) {
      score += 30; // Been away over 18 months
    }
  }

  return {
    ...client,
    score: Math.max(0, score), // Ensure score never goes negative
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