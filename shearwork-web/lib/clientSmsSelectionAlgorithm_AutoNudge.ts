// lib/sms/clientSmsSelectionAlgorithm.ts
import { SupabaseClient } from '@supabase/supabase-js';
import {
  getActiveHolidayForBoosting,
  calculateHolidaySensitivityBatch,
} from './nudge';

export interface AcuityClient {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  phone_normalized: string | null;
  first_appt: string | null;
  last_appt: string | null;
  primary_service: string | null;
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
  holiday_cohort?: string | null;  // Holiday experiment tracking (e.g., 'march_break_2026')
}

// Get current and previous ISO week
const getISOWeek = (date: Date): string => {
  const dayOfWeek = date.getDay() || 7
  const thursday = new Date(date)
  thursday.setDate(date.getDate() - dayOfWeek + 4)
  const jan4 = new Date(thursday.getFullYear(), 0, 4)
  const jan4Day = jan4.getDay() || 7
  const firstMonday = new Date(jan4)
  firstMonday.setDate(jan4.getDate() - jan4Day + 1)
  const weekNumber = Math.round((thursday.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1
  return `${thursday.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

const getLastISOWeekOfYear = (year: number): number => {
  const dec28 = new Date(year, 11, 28)
  return parseInt(getISOWeek(dec28).split('-W')[1])
}

const getPreviousISOWeek = (isoWeek: string): string => {
  const [yearStr, weekStr] = isoWeek.split('-W')
  let year = parseInt(yearStr)
  let week = parseInt(weekStr) - 1
  if (week === 0) {
    year -= 1
    week = getLastISOWeekOfYear(year)
  }
  return `${year}-W${String(week).padStart(2, '0')}`
}

/**
 * Selects up to `limit` clients to send SMS auto nudge messages to.
 * Phase 1: strict scoring fills up to `limit`.
 * Phase 2: lenient scoring fills any remaining slots.
 * Heavily prioritizes consistent and semi-consistent clients (90%).
 */
export async function selectClientsForSMS_AutoNudge(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 50,
  visitingType?: string
): Promise<ScoredClient[]> {
  const today = new Date();

  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // --- Shared base query builder ---
  const buildBaseQuery = (supabase: SupabaseClient) => {
    let query = supabase
      .from('acuity_clients')
      .select('*')
      .eq('user_id', userId)
      .not('phone_normalized', 'is', null)
      .not('last_appt', 'is', null)
      .neq('sms_subscribed', false)
      .gt('total_appointments', 1)
      .gte('avg_weekly_visits', 0.01)
      .lte('avg_weekly_visits', 2.5)
      .or(`next_future_appointment.is.null,next_future_appointment.lte.${twoWeeksAgo.toISOString()}`)
      .order('last_appt', { ascending: false });

    if (visitingType) {
      query = query.eq('visiting_type', visitingType);
    }

    return query;
  };

  // --- Smart bucket exemption ---
  const currentWeek = getISOWeek(today)
  const previousWeek = getPreviousISOWeek(currentWeek)

  const { data: recentBuckets } = await supabase
    .from('sms_smart_buckets')
    .select('clients')
    .eq('user_id', userId)
    .in('iso_week', [currentWeek, previousWeek])

  const exemptPhones = new Set<string>()
  for (const bucket of recentBuckets || []) {
    for (const client of bucket.clients || []) {
      if (client.phone) exemptPhones.add(client.phone)
    }
  }

  // --- PHASE 1: Strict clients ---
  const { data: strictRaw, error: strictError } = await buildBaseQuery(supabase)
    .lt('last_appt', twoWeeksAgo.toISOString());

  if (strictError) {
    throw new Error(`Failed to fetch strict clients: ${strictError.message}`);
  }

  const strictFiltered = (strictRaw || []).filter(
    c => !c.phone_normalized || !exemptPhones.has(c.phone_normalized)
  );

  const strictScored = strictFiltered
    .map(c => scoreClientStrict(c, today))
    .filter(c => c.score > 0 && c.days_overdue >= 0);

  const strictUnique = deduplicateByPhone(strictScored);
  strictUnique.sort((a, b) => b.score - a.score);

  // --- PHASE 2: Lenient fills remaining slots ---
  let selectedClients: ScoredClient[] = strictUnique.slice(0, limit);

  if (selectedClients.length < limit) {
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const { data: lenientRaw, error: lenientError } = await buildBaseQuery(supabase)
      .lt('last_appt', oneWeekAgo.toISOString());

    if (lenientError) {
      throw new Error(`Failed to fetch lenient clients: ${lenientError.message}`);
    }

    const strictPhones = new Set(strictUnique.map(c => c.phone_normalized));

    const lenientFiltered = (lenientRaw || []).filter(
      c =>
        (!c.phone_normalized || !exemptPhones.has(c.phone_normalized)) &&
        !strictPhones.has(c.phone_normalized)
    );

    const lenientScored = lenientFiltered
      .map(c => scoreClientLenient(c, today))
      .filter(c => c.score > 0 && c.days_overdue >= 0);

    const lenientUnique = deduplicateByPhone(lenientScored);
    lenientUnique.sort((a, b) => b.score - a.score);

    const remainingSlots = limit - selectedClients.length;
    selectedClients = [...selectedClients, ...lenientUnique.slice(0, remainingSlots)];
  }

  // --- Holiday sensitivity boost ---
  const activeHoliday = getActiveHolidayForBoosting(today);

  if (activeHoliday && selectedClients.length > 0) {
    const clientIds = selectedClients.map(c => c.client_id);
    const sensitivityMap = await calculateHolidaySensitivityBatch(
      supabase,
      clientIds,
      userId,
      activeHoliday
    );

    for (const client of selectedClients) {
      const sensitivity = sensitivityMap.get(client.client_id);
      if (sensitivity && sensitivity.boost > 0) {
        client.score += sensitivity.boost;
        client.holiday_cohort = sensitivity.holidayCohort;
      }
    }

    // Re-sort after holiday boosts
    selectedClients.sort((a, b) => b.score - a.score);
  }

  // --- 90/10 type split ---
  const consistentAndSemiConsistent = selectedClients.filter(
    c => c.visiting_type === 'consistent' || c.visiting_type === 'semi-consistent'
  );
  const others = selectedClients.filter(
    c => c.visiting_type !== 'consistent' && c.visiting_type !== 'semi-consistent'
  );

  const targetConsistentCount = Math.floor(limit * 0.9);
  const finalClients: ScoredClient[] = [];

  finalClients.push(...consistentAndSemiConsistent.slice(0, targetConsistentCount));

  const remainingSlots = limit - finalClients.length;
  if (remainingSlots > 0) {
    finalClients.push(...others.slice(0, remainingSlots));
  }

  if (finalClients.length < limit && consistentAndSemiConsistent.length > targetConsistentCount) {
    const additionalNeeded = limit - finalClients.length;
    finalClients.push(
      ...consistentAndSemiConsistent.slice(targetConsistentCount, targetConsistentCount + additionalNeeded)
    );
  }

  console.log("Selected Clients:")
  console.log(finalClients[0])

  return finalClients;
}

/**
 * Remove duplicate phone numbers, keeping the client with the highest score
 */
function deduplicateByPhone(clients: ScoredClient[]): ScoredClient[] {
  const phoneMap = new Map<string, ScoredClient>();

  for (const client of clients) {
    if (!client.phone_normalized) continue;

    const existing = phoneMap.get(client.phone_normalized);

    if (!existing ||
        client.score > existing.score ||
        (client.score === existing.score && client.days_since_last_visit < existing.days_since_last_visit)) {
      phoneMap.set(client.phone_normalized, client);
    }
  }

  return Array.from(phoneMap.values());
}

/**
 * STRICT scoring — mirrors Campaign strict algorithm
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

  if (daysSinceLastSms < 14) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: 0, days_overdue: 0 };
  }

  const expectedVisitIntervalDays = client.avg_weekly_visits
    ? Math.round(7 / client.avg_weekly_visits)
    : 0;

  const daysOverdue = daysSinceLastVisit - expectedVisitIntervalDays;

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

  // CONSISTENT: 0–45 days overdue
  if (client.visiting_type === 'consistent') {
    if (daysOverdue >= 0 && daysOverdue <= 45) {
      score = 400 + (daysOverdue * 5) + proximityBonus;
      if (daysOverdue > 10) {
        score -= ((daysOverdue - 10) * 3);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }

  // SEMI-CONSISTENT: 0–30 days overdue
  else if (client.visiting_type === 'semi-consistent') {
    if (daysOverdue >= 0 && daysOverdue <= 30) {
      score = 350 + (daysOverdue * 4) + proximityBonus;
      if (daysOverdue > 15) {
        score -= ((daysOverdue - 15) * 3);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }

  // EASY-GOING: 5–60 days overdue
  else if (client.visiting_type === 'easy-going') {
    if (daysOverdue >= 5 && daysOverdue <= 60) {
      score = 120 + ((daysOverdue - 5) * 2) + proximityBonus;
      if (daysOverdue > 20) {
        score -= ((daysOverdue - 20) * 5);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }

  // RARE: 10–90 days overdue
  else if (client.visiting_type === 'rare') {
    if (daysOverdue >= 10 && daysOverdue <= 90) {
      score = 100 + ((daysOverdue - 10) * 1.2) + proximityBonus;
      if (daysOverdue > 25) {
        score -= ((daysOverdue - 25) * 5);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }

  // NULL: Treat like easy-going (5–60 days overdue)
  else {
    if (daysOverdue >= 5 && daysOverdue <= 60) {
      score = 110 + ((daysOverdue - 5) * 2) + proximityBonus;
      if (daysOverdue > 20) {
        score -= ((daysOverdue - 20) * 5);
      }
    } else {
      return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
    }
  }

  if (daysOverdue <= 30) {
    if (daysSinceLastVisit > 365) score += 20;
    if (daysSinceLastVisit > 540) score += 30;
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
 * LENIENT scoring — for filling remaining slots after strict phase
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

  if (daysSinceLastSms < 15) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: 0, days_overdue: 0 };
  }

  const expectedVisitIntervalDays = client.avg_weekly_visits
    ? Math.round(7 / client.avg_weekly_visits)
    : 0;

  const daysOverdue = daysSinceLastVisit - expectedVisitIntervalDays;

  if (daysOverdue < 0) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
  }

  if (daysOverdue > 120) {
    return { ...client, score: 0, days_since_last_visit: daysSinceLastVisit, expected_visit_interval_days: expectedVisitIntervalDays, days_overdue: daysOverdue };
  }

  let baseScore = 200;

  if (daysOverdue > 60) {
    baseScore -= ((daysOverdue - 60) * 10);
  }

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