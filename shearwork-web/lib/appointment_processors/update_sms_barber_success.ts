// lib/appointment_processors/update_sms_barber_success.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function getISOWeek(date: Date = new Date()): string {
  const now = new Date(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  );

  const day = now.getDay() || 7;
  now.setDate(now.getDate() + 4 - day);

  const yearStart = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((+now - +yearStart) / 86400000 + 1) / 7);
  const year = now.getFullYear();

  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function getRecentISOWeeks(count: number): string[] {
  const weeks: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    weeks.push(getISOWeek(d));
  }
  return weeks;
}

function parseToUTCTimestamp(datetimeStr: string): string {
  try {
    const date = new Date(datetimeStr);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00');
  } catch (error) {
    console.error('Error parsing datetime:', datetimeStr, error);
    return new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00');
  }
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (raw.trimStart().startsWith('+') && digits.length >= 11) return `+${digits}`;
  return `+${digits}`;
}

function normalizeNamePart(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function normalizeFullName(firstName: string | null | undefined, lastName: string | null | undefined): string | null {
  const first = normalizeNamePart(firstName);
  const last = normalizeNamePart(lastName);
  if (!first || !last) return null;
  return `${first} ${last}`;
}

type SentMessageCandidate = {
  client_id: string | null;
  created_at: string;
  is_sent: boolean | null;
};

type AppointmentDetails = {
  id?: string | number | null;
  phone?: string | null;
  datetimeCreated?: string | null;
  datetime?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  type?: string | null;
  price?: string | number | null;
};

async function resolveClientIdForSentMessages(
  userId: string,
  sentMessages: SentMessageCandidate[],
  appointmentDetails: AppointmentDetails
): Promise<{ clientId: string | null; reason?: string }> {
  const uniqueClientIds = Array.from(
    new Set(sentMessages.map((row) => row.client_id).filter((value): value is string => Boolean(value)))
  );

  if (uniqueClientIds.length === 0) {
    return { clientId: null, reason: 'No client_id on delivered sms row' };
  }

  if (uniqueClientIds.length === 1) {
    return { clientId: uniqueClientIds[0] };
  }

  const appointmentName = normalizeFullName(appointmentDetails.firstName, appointmentDetails.lastName);
  if (!appointmentName) {
    return { clientId: null, reason: 'ambiguous_shared_phone' };
  }

  const { data: candidateClients, error } = await supabase
    .from('acuity_clients')
    .select('client_id, first_name, last_name')
    .eq('user_id', userId)
    .in('client_id', uniqueClientIds);

  if (error) {
    console.error('Error resolving shared-phone clients:', error);
    return { clientId: null, reason: 'Failed to resolve shared-phone clients' };
  }

  const exactNameMatches = (candidateClients || []).filter((client) =>
    normalizeFullName(client.first_name, client.last_name) === appointmentName
  );

  if (exactNameMatches.length === 1) {
    return { clientId: exactNameMatches[0].client_id };
  }

  return {
    clientId: null,
    reason: exactNameMatches.length > 1 ? 'ambiguous_shared_phone' : 'name_mismatch',
  };
}

export async function updateSmsBarberSuccess(
  userId: string,
  appointmentDetails: AppointmentDetails
): Promise<{ success: boolean; reason?: string }> {
  try {
    console.log(`\n=== UPDATE SMS BARBER SUCCESS ===`);
    console.log(`User ID: ${userId}`);
    console.log(`Appointment ID: ${appointmentDetails.id}`);

    const appointmentPhone = normalizePhone(appointmentDetails.phone);
    if (!appointmentPhone) {
      console.log('No phone number in appointment');
      return { success: false, reason: 'No phone number' };
    }

    const appointmentCreatedAt = appointmentDetails.datetimeCreated
      ? new Date(appointmentDetails.datetimeCreated)
      : null;

    if (!appointmentCreatedAt || isNaN(appointmentCreatedAt.getTime())) {
      console.log('Invalid or missing appointment datetimeCreated');
      return { success: false, reason: 'Invalid appointment datetimeCreated' };
    }

    const appointmentDatetime = appointmentDetails.datetime;
    if (!appointmentDatetime) {
      console.log('Invalid or missing appointment datetime');
      return { success: false, reason: 'Invalid appointment datetime' };
    }

    // Look back across the last 2 weeks only
    const recentWeeks = getRecentISOWeeks(2);
    console.log(`Checking ISO weeks: ${recentWeeks.join(', ')}`);

    // Fetch all buckets for this user within the lookback window
    const { data: buckets, error: bucketsError } = await supabase
      .from('sms_smart_buckets')
      .select('bucket_id, campaign_start, total_clients, iso_week')
      .eq('user_id', userId)
      .in('iso_week', recentWeeks)
      .order('campaign_start', { ascending: false });

    if (bucketsError || !buckets || buckets.length === 0) {
      console.log(`No smart buckets found for user ${userId} in recent weeks`);
      return { success: false, reason: 'No smart bucket' };
    }

    // Find the most recent bucket where an SMS was sent to this phone
    // and the appointment was created after the SMS was sent
    let matchedBucket: typeof buckets[number] | null = null;
    let matchedSentMessages: SentMessageCandidate[] | null = null;

    for (const bucket of buckets) {
      const { data: sentMessages, error: sentError } = await supabase
        .from('sms_sent')
        .select('client_id, created_at, is_sent')
        .eq('smart_bucket_id', bucket.bucket_id)
        .eq('phone_normalized', appointmentPhone)
        .eq('is_sent', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (sentError || !sentMessages || sentMessages.length === 0) continue;

      const validSentMessage = sentMessages.find((row) => {
        const smsSentAt = new Date(row.created_at);
        return appointmentCreatedAt > smsSentAt;
      });

      if (!validSentMessage) {
        console.log(`Appointment created before SMS for bucket ${bucket.bucket_id} — skipping`);
        continue;
      }

      matchedBucket = bucket;
      matchedSentMessages = sentMessages;
      break; // most recent matching bucket wins
    }

    if (!matchedBucket || !matchedSentMessages) {
      console.log(`No attributable SMS found for phone ${appointmentPhone}`);
      return { success: false, reason: 'No SMS sent to this client' };
    }

    console.log(`✅ Attributed to bucket ${matchedBucket.bucket_id} (${matchedBucket.iso_week})`);

    const { clientId, reason: clientResolutionReason } = await resolveClientIdForSentMessages(
      userId,
      matchedSentMessages,
      appointmentDetails
    );

    if (!clientId) {
      console.log(`Unable to resolve client for SMS attribution: ${clientResolutionReason}`);
      return { success: false, reason: clientResolutionReason || 'No client_id on sms_sent row' };
    }

    const targetISOWeek = matchedBucket.iso_week;
    const service = appointmentDetails.type || 'Unknown';
    const price = Math.round(Number(appointmentDetails.price)) || 0;
    const appointmentDate = parseToUTCTimestamp(appointmentDatetime);
    const messagesDelivered = matchedBucket.total_clients;

    const { data: existing } = await supabase
      .from('barber_nudge_success')
      .select('id, client_ids, services, prices, appointment_dates')
      .eq('user_id', userId)
      .eq('iso_week_number', targetISOWeek)
      .single();

    const readableDatetime = new Date(appointmentDatetime).toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (existing) {
      const existingClientIds: string[] = existing.client_ids || [];

      if (existingClientIds.includes(clientId)) {
        console.log(`Client ${clientId} already in barber_nudge_success`);
        return { success: true, reason: 'Client already tracked' };
      }

      await supabase
        .from('barber_nudge_success')
        .update({
          messages_delivered: messagesDelivered,
          client_ids: [...existingClientIds, clientId],
          services: [...(existing.services || []), service],
          prices: [...(existing.prices || []), price],
          appointment_dates: [...(existing.appointment_dates || []), appointmentDate],
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      console.log(`✅ Updated barber_nudge_success for user ${userId}`);
    } else {
      await supabase
        .from('barber_nudge_success')
        .insert({
          user_id: userId,
          iso_week_number: targetISOWeek,
          messages_delivered: messagesDelivered,
          clicked_link: 0,
          client_ids: [clientId],
          services: [service],
          prices: [price],
          appointment_dates: [appointmentDate]
        });

      console.log(`✅ Created barber_nudge_success for user ${userId}`);
    }

    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        header: 'SMS Auto-nudge success!',
        message: `${appointmentDetails.firstName} booked your opening at ${readableDatetime}.`,
        reference_type: 'sms_auto_nudge',
        show: false
      });

    return { success: true };

  } catch (error) {
    console.error('Error in updateSmsBarberSuccess:', error);
    return { success: false, reason: String(error) };
  }
}
