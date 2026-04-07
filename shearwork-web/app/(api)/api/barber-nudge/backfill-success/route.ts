// app/(api)/api/barber-nudge/backfill-success/route.ts
//
// Backfill barber_nudge_success for past campaign weeks.
// For each recent smart bucket, checks if any SMS recipients booked
// an appointment AFTER the SMS was sent but weren't attributed
// by the real-time webhook. Patches barber_nudge_success accordingly.
//
// Uses acuity_appointments table (not the Acuity API) so it works
// even when OAuth tokens are expired or appointments were synced
// under a different user_id due to the shared-calendar bug.
//
// Trigger:
//   - QStash cron (daily, e.g. 6 AM ET)
//   - Manual via admin panel or curl
//
// Query params:
//   ?weeks=1    — how many ISO weeks to look back (default 1, max 8)
//   ?userId=X   — optional, backfill only one user (useful for debugging)
//   ?dryRun=true — find matches but DON'T write to DB. Returns full detail per match.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ----------------------------------------------------------------
// Helpers (same ISO-week logic as update_sms_barber_success.ts)
// ----------------------------------------------------------------

function getISOWeek(date: Date): string {
  const torontoStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const d = new Date(torontoStr);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);

  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getRecentISOWeeks(count: number): string[] {
  const weeks: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    weeks.push(getISOWeek(d));
  }
  return [...new Set(weeks)];
}

function parseToUTCTimestamp(datetimeStr: string): string {
  try {
    const date = new Date(datetimeStr);
    if (isNaN(date.getTime())) throw new Error('Invalid date');
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00');
  } catch {
    return new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00');
  }
}

// ----------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const weeksBack = Math.min(Number(searchParams.get('weeks')) || 1, 8);
    const singleUserId = searchParams.get('userId') || null;
    const dryRun = searchParams.get('dryRun') === 'true';

    const recentWeeks = getRecentISOWeeks(weeksBack);
    console.log(`[backfill] Weeks: ${recentWeeks.join(', ')} | userId: ${singleUserId || 'all'} | dryRun: ${dryRun}`);

    // 1. Fetch all smart buckets in the lookback window
    let bucketsQuery = supabase
      .from('sms_smart_buckets')
      .select('bucket_id, user_id, iso_week, campaign_start, campaign_end, total_clients')
      .in('iso_week', recentWeeks)
      .eq('status', 'active');

    if (singleUserId) {
      bucketsQuery = bucketsQuery.eq('user_id', singleUserId);
    }

    const { data: buckets, error: bucketsErr } = await bucketsQuery;

    if (bucketsErr || !buckets || buckets.length === 0) {
      console.log('[backfill] No active buckets found');
      return NextResponse.json({ ok: true, mode: dryRun ? 'DRY_RUN' : 'LIVE', backfilled: 0, details: [] });
    }

    // Group buckets by user
    const bucketsByUser = new Map<string, typeof buckets>();
    for (const b of buckets) {
      const list = bucketsByUser.get(b.user_id) || [];
      list.push(b);
      bucketsByUser.set(b.user_id, list);
    }

    let totalBackfilled = 0;
    const details: {
      userId: string;
      week: string;
      added: number;
      alreadyTracked: number;
      smsSent: number;
      appointmentsFound: number;
      matches: {
        clientId: string;
        phone: string;
        smsSentAt: string;
        appointmentCreated: string;
        service: string;
        price: number;
        appointmentDate: string;
      }[];
    }[] = [];

    for (const [userId, userBuckets] of bucketsByUser) {
      for (const bucket of userBuckets) {
        // 2. Get all successfully-sent SMS for this bucket
        const { data: sentRows } = await supabase
          .from('sms_sent')
          .select('client_id, phone_normalized, created_at')
          .eq('smart_bucket_id', bucket.bucket_id)
          .eq('is_sent', true);

        if (!sentRows || sentRows.length === 0) continue;

        // 3. Load existing barber_nudge_success to know what's already attributed
        const { data: existing } = await supabase
          .from('barber_nudge_success')
          .select('id, client_ids, services, prices, appointment_dates, messages_delivered')
          .eq('user_id', userId)
          .eq('iso_week_number', bucket.iso_week)
          .maybeSingle();

        const alreadyTracked = new Set<string>(existing?.client_ids || []);

        // Only process clients not yet attributed
        const untracked = sentRows.filter(
          (r) => r.client_id && r.phone_normalized && !alreadyTracked.has(r.client_id)
        );

        if (untracked.length === 0) continue;

        // 4. Search acuity_appointments across ALL user_ids for these phones.
        //    This handles the shared-calendar bug where appointments land
        //    under a different user_id than the barber who sent the nudge.
        const untrackedPhones = [...new Set(untracked.map((r) => r.phone_normalized!))];

        const campaignStartDate = new Date(bucket.campaign_start);
        const graceEnd = new Date(bucket.campaign_end);
        graceEnd.setDate(graceEnd.getDate() + 21);

        const { data: appointments, error: apptErr } = await supabase
          .from('acuity_appointments')
          .select('phone_normalized, service_type, revenue, datetime, appointment_datecreated')
          .in('phone_normalized', untrackedPhones)
          .gte('appointment_datecreated', campaignStartDate.toISOString())
          .lte('appointment_datecreated', graceEnd.toISOString())
          .order('appointment_datecreated', { ascending: true });

        if (apptErr) {
          console.error(`[backfill] Error querying acuity_appointments for ${userId} ${bucket.iso_week}:`, apptErr);
          continue;
        }

        if (!appointments || appointments.length === 0) continue;

        // Deduplicate appointments — the shared-calendar bug causes the same
        // appointment to appear under multiple user_ids. We only need one
        // match per phone+datetime combo.
        const seenApptKeys = new Set<string>();
        const dedupedAppointments = appointments.filter((appt) => {
          const key = `${appt.phone_normalized}|${appt.appointment_datecreated}`;
          if (seenApptKeys.has(key)) return false;
          seenApptKeys.add(key);
          return true;
        });

        // 5. Match untracked SMS recipients to booked appointments.
        //    For each client, take the FIRST appointment created after the SMS
        //    (one attribution per client, same as the real-time webhook).
        const newBookings: {
          clientId: string;
          phone: string;
          smsSentAt: string;
          appointmentCreated: string;
          service: string;
          price: number;
          appointmentDate: string;
        }[] = [];

        const matchedClients = new Set<string>();

        for (const sent of untracked) {
          if (matchedClients.has(sent.client_id!)) continue;

          const smsSentAt = new Date(sent.created_at);

          // Find the first appointment for this phone created after the SMS
          const match = dedupedAppointments.find((appt) => {
            if (appt.phone_normalized !== sent.phone_normalized) return false;
            if (!appt.appointment_datecreated) return false;
            return new Date(appt.appointment_datecreated) > smsSentAt;
          });

          if (match) {
            matchedClients.add(sent.client_id!);
            newBookings.push({
              clientId: sent.client_id!,
              phone: sent.phone_normalized!,
              smsSentAt: sent.created_at,
              appointmentCreated: match.appointment_datecreated,
              service: match.service_type || 'Unknown',
              price: Math.round(Number(match.revenue)) || 0,
              appointmentDate: parseToUTCTimestamp(match.datetime),
            });
          }
        }

        if (newBookings.length === 0) continue;

        // Record detail for every bucket regardless of dryRun
        const bucketDetail = {
          userId,
          week: bucket.iso_week,
          added: newBookings.length,
          alreadyTracked: alreadyTracked.size,
          smsSent: sentRows.length,
          appointmentsFound: dedupedAppointments.length,
          matches: newBookings,
        };

        // 6. In dry run, skip DB writes entirely
        if (dryRun) {
          console.log(
            `[backfill][DRY RUN] ${userId} week ${bucket.iso_week}: would add ${newBookings.length} booking(s)`
          );
          totalBackfilled += newBookings.length;
          details.push(bucketDetail);
          continue;
        }

        // 7. Upsert into barber_nudge_success
        if (existing) {
          const { error: updateErr } = await supabase
            .from('barber_nudge_success')
            .update({
              client_ids: [
                ...(existing.client_ids || []),
                ...newBookings.map((b) => b.clientId),
              ],
              services: [
                ...(existing.services || []),
                ...newBookings.map((b) => b.service),
              ],
              prices: [
                ...(existing.prices || []),
                ...newBookings.map((b) => b.price),
              ],
              appointment_dates: [
                ...(existing.appointment_dates || []),
                ...newBookings.map((b) => b.appointmentDate),
              ],
              messages_delivered: bucket.total_clients,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateErr) {
            console.error(`[backfill] Update error for ${userId} ${bucket.iso_week}:`, updateErr);
            continue;
          }
        } else {
          const { error: insertErr } = await supabase
            .from('barber_nudge_success')
            .insert({
              user_id: userId,
              iso_week_number: bucket.iso_week,
              messages_delivered: bucket.total_clients,
              clicked_link: 0,
              client_ids: newBookings.map((b) => b.clientId),
              services: newBookings.map((b) => b.service),
              prices: newBookings.map((b) => b.price),
              appointment_dates: newBookings.map((b) => b.appointmentDate),
            });

          if (insertErr) {
            console.error(`[backfill] Insert error for ${userId} ${bucket.iso_week}:`, insertErr);
            continue;
          }
        }

        console.log(
          `[backfill] ✅ ${userId} week ${bucket.iso_week}: +${newBookings.length} booking(s)`
        );
        totalBackfilled += newBookings.length;
        details.push(bucketDetail);
      }
    }

    console.log(`[backfill] Done. Total ${dryRun ? 'would backfill' : 'backfilled'}: ${totalBackfilled}`);

    // Log to system_logs so it shows up in admin (skip in dry run)
    if (totalBackfilled > 0 && !dryRun) {
      await supabase.from('system_logs').insert({
        source: 'CRON',
        action: 'backfill_nudge_success',
        status: 'success',
        details: `Backfilled ${totalBackfilled} booking(s) across ${details.length} user-week(s)`,
      });
    }

    return NextResponse.json({
      ok: true,
      mode: dryRun ? 'DRY_RUN' : 'LIVE',
      backfilled: totalBackfilled,
      details,
    });
  } catch (error) {
    console.error('[backfill] Fatal error:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}