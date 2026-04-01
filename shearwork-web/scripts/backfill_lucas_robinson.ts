// scripts/backfill_lucas_robinson.ts
//
// One-off script to retroactively attribute Lucas Robinson's booking
// to Cruz (148e1d51) after the webhook resolved to the wrong barber.
//
// Run: npx tsx scripts/backfill_lucas_robinson.ts
//
// What it does:
//   1. Calls updateSmsBarberSuccess with the correct user_id and appointment data
//   2. If attribution succeeds, logs it to system_logs and creates the notification
//
// DRY RUN by default — set DRY_RUN=false below to actually write.

const DRY_RUN = false;
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Appointment data from the webhook logs ──────────────────────────────────

const CORRECT_USER_ID = '148e1d51-ad9f-4eda-a33e-73d13d5d01cb'; // Cruz

const appointmentDetails = {
  id: 1679598358,
  firstName: 'Lucas',
  lastName: 'Robinson',
  phone: '+16475278754',
  email: 'megan.michelle.robinson@outlook.com',
  datetime: '2026-04-04T10:30:00-0400',
  datetimeCreated: '2026-03-30T15:57:04-0500',
  price: '35.00',
  type: 'KIDS HAIRCUT  (AGES 1-12)',
  calendar: 'CRUZ',
  calendarID: 7180066,
};

// ── Helpers (copied from update_sms_barber_success.ts) ──────────────────────

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
  return `${now.getFullYear()}-W${week.toString().padStart(2, '0')}`;
}

function getRecentISOWeeks(count: number, fromDate: Date): string[] {
  const weeks: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(fromDate);
    d.setDate(fromDate.getDate() - i * 7);
    weeks.push(getISOWeek(d));
  }
  return weeks;
}

function parseToUTCTimestamp(datetimeStr: string): string {
  const date = new Date(datetimeStr);
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00');
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${DRY_RUN ? '🔍 DRY RUN' : '🔥 LIVE RUN'} — Backfilling Lucas Robinson's nudge attribution\n`);
  console.log(`User: ${CORRECT_USER_ID}`);
  console.log(`Appointment: ${appointmentDetails.id}`);

  const appointmentCreatedAt = new Date(appointmentDetails.datetimeCreated);

  // Hardcoded to match what the original webhook checked on March 30
  // (the dynamic calculation drifts since we're running this after the fact)
  const recentWeeks = ['2026-W14', '2026-W13'];
  console.log(`Checking ISO weeks: ${recentWeeks.join(', ')}`);

  // Find matching SMS bucket
  const { data: buckets, error: bucketsError } = await supabase
    .from('sms_smart_buckets')
    .select('bucket_id, campaign_start, total_clients, iso_week')
    .eq('user_id', CORRECT_USER_ID)
    .in('iso_week', recentWeeks)
    .order('campaign_start', { ascending: false });

  if (bucketsError || !buckets || buckets.length === 0) {
    console.log(`❌ No smart buckets found for user ${CORRECT_USER_ID} in weeks ${recentWeeks.join(', ')}`);
    console.log('   This means Cruz may not have had an active campaign. Nothing to backfill.');
    return;
  }

  console.log(`Found ${buckets.length} bucket(s):`, buckets.map((b) => `${b.bucket_id} (${b.iso_week})`));

  let matchedBucket: (typeof buckets)[number] | null = null;
  let matchedSent: { client_id: string; created_at: string } | null = null;

  for (const bucket of buckets) {
    const { data: sentMessage } = await supabase
      .from('sms_sent')
      .select('client_id, created_at, is_sent')
      .eq('smart_bucket_id', bucket.bucket_id)
      .eq('phone_normalized', appointmentDetails.phone)
      .maybeSingle();

    if (!sentMessage) continue;

    const smsSentAt = new Date(sentMessage.created_at);
    if (appointmentCreatedAt <= smsSentAt) {
      console.log(`  Bucket ${bucket.bucket_id}: SMS sent AFTER booking — skipping`);
      continue;
    }

    console.log(`  ✅ Match: bucket ${bucket.bucket_id}, SMS sent at ${sentMessage.created_at}`);
    matchedBucket = bucket;
    matchedSent = sentMessage;
    break;
  }

  if (!matchedBucket || !matchedSent) {
    console.log('❌ No attributable SMS found — Cruz may not have nudged this client.');
    return;
  }

  const clientId = matchedSent.client_id;
  const targetISOWeek = matchedBucket.iso_week;
  const service = appointmentDetails.type;
  const price = Math.round(Number(appointmentDetails.price)) || 0;
  const appointmentDate = parseToUTCTimestamp(appointmentDetails.datetime);
  const messagesDelivered = matchedBucket.total_clients;

  console.log(`\nAttribution details:`);
  console.log(`  Client ID: ${clientId}`);
  console.log(`  ISO Week: ${targetISOWeek}`);
  console.log(`  Service: ${service}`);
  console.log(`  Price: $${price}`);
  console.log(`  Appointment: ${appointmentDate}`);

  // Check for existing barber_nudge_success row
  const { data: existing } = await supabase
    .from('barber_nudge_success')
    .select('id, client_ids, services, prices, appointment_dates')
    .eq('user_id', CORRECT_USER_ID)
    .eq('iso_week_number', targetISOWeek)
    .single();

  if (existing) {
    const existingClientIds: string[] = existing.client_ids || [];
    if (existingClientIds.includes(clientId)) {
      console.log('\n⚠️  Client already tracked in barber_nudge_success — no action needed.');
      return;
    }

    console.log(`\nWill UPDATE existing barber_nudge_success row (id: ${existing.id})`);

    if (!DRY_RUN) {
      await supabase
        .from('barber_nudge_success')
        .update({
          messages_delivered: messagesDelivered,
          client_ids: [...existingClientIds, clientId],
          services: [...(existing.services || []), service],
          prices: [...(existing.prices || []), price],
          appointment_dates: [...(existing.appointment_dates || []), appointmentDate],
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      console.log('✅ Updated.');
    }
  } else {
    console.log('\nWill INSERT new barber_nudge_success row');

    if (!DRY_RUN) {
      await supabase.from('barber_nudge_success').insert({
        user_id: CORRECT_USER_ID,
        iso_week_number: targetISOWeek,
        messages_delivered: messagesDelivered,
        clicked_link: 0,
        client_ids: [clientId],
        services: [service],
        prices: [price],
        appointment_dates: [appointmentDate],
      });
      console.log('✅ Inserted.');
    }
  }

  // System log
  console.log('Will INSERT system_log entry');
  if (!DRY_RUN) {
    await supabase.from('system_logs').insert({
      source: 'SYSTEM',
      action: 'barber_nudge_success',
      status: 'success',
      details: `Cruz: Lucas Robinson (+16475278754) booked [backfill]`,
    });
    console.log('✅ Logged.');
  }

  // Notification
  const readableDatetime = new Date(appointmentDetails.datetime).toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  console.log('Will INSERT notification');
  if (!DRY_RUN) {
    await supabase.from('notifications').insert({
      user_id: CORRECT_USER_ID,
      header: 'SMS Auto-nudge success!',
      message: `Lucas booked your opening at ${readableDatetime}.`,
      reference_type: 'sms_auto_nudge',
      show: false,
    });
    console.log('✅ Notification created.');
  }

  console.log(`\n${DRY_RUN ? '🔍 DRY RUN complete — set DRY_RUN=false to write.' : '✅ Backfill complete.'}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});