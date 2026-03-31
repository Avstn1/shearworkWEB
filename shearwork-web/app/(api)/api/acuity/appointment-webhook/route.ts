// app/(api)/api/acuity/appointment-webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { updateSmsBarberSuccess } from '@/lib/appointment_processors/update_sms_barber_success';
import { updateBarberClient } from '@/lib/appointment_processors/update_barber_client';
import { pullAvailability } from '@/lib/booking/availability/orchestrator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const ACUITY_API_BASE = 'https://acuityscheduling.com/api/v1';

function formatTorontoDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getTorontoWeekRange(weekOffset: number): { startDate: string; endDate: string } {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' })
  );
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const start = new Date(now);
  start.setDate(now.getDate() + diff + weekOffset * 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    startDate: formatTorontoDate(start),
    endDate: formatTorontoDate(end),
  };
}

function getRelevantAvailabilityWeekOffsets(action: string, datetime?: string): number[] {
  if (action === 'appointment.rescheduled' || action === 'appointment.changed') {
    return [0, 1];
  }

  if (!datetime) {
    return [0];
  }

  const appointmentDate = new Date(datetime);
  if (Number.isNaN(appointmentDate.getTime())) {
    return [0];
  }

  const appointmentTorontoDate = formatTorontoDate(appointmentDate);
  const candidateOffsets = [0, 1].filter((weekOffset) => {
    const range = getTorontoWeekRange(weekOffset);
    return appointmentTorontoDate >= range.startDate && appointmentTorontoDate <= range.endDate;
  });

  return candidateOffsets.length > 0 ? candidateOffsets : [0];
}

async function refreshAvailabilityForOpenBookings(userId: string, weekOffsets: number[]) {
  const results = await Promise.allSettled(
    weekOffsets.map((weekOffset) =>
      pullAvailability(supabase, userId, {
        dryRun: false,
        forceRefresh: true,
        weekOffset,
      })
    )
  );

  results.forEach((result, index) => {
    const weekOffset = weekOffsets[index];
    if (result.status === 'fulfilled') {
      console.log(`✅ availability refreshed for weekOffset=${weekOffset}`);
      return;
    }

    console.error(`Failed to refresh availability for weekOffset=${weekOffset}:`, result.reason);
  });
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

// ---------------------------------------------------------------------------
// Barber resolution: disambiguate when multiple users share a calendar_id
// ---------------------------------------------------------------------------
// Chain:
//   1. Match profiles.calendar to the Acuity appointment's calendar name
//   2. Prefer the user with sms_engaged_current_week = true (actively nudging)
//   3. Prefer an active Stripe subscriber
//   4. Fall back to first candidate
// ---------------------------------------------------------------------------

interface ResolvedBarber {
  userId: string;
  allCandidateUserIds: string[];
}

async function resolveBarberUserId(
  supabase: SupabaseClient,
  candidateUserIds: string[],
  calendarName: string | undefined
): Promise<ResolvedBarber> {
  // Single candidate — no ambiguity
  if (candidateUserIds.length === 1) {
    return { userId: candidateUserIds[0], allCandidateUserIds: candidateUserIds };
  }

  console.log(
    `[resolveBarber] ${candidateUserIds.length} candidates for calendar_id — disambiguating`
  );

  // If we don't have a calendar name from the appointment, can't narrow further
  if (!calendarName) {
    console.log('[resolveBarber] No calendar name on appointment — using first candidate');
    return { userId: candidateUserIds[0], allCandidateUserIds: candidateUserIds };
  }

  // Step 1: Filter by profiles.calendar matching the appointment's calendar name
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, sms_engaged_current_week, stripe_subscription_status')
    .in('user_id', candidateUserIds)
    .eq('calendar', calendarName);

  if (profilesError || !profiles || profiles.length === 0) {
    console.log(
      `[resolveBarber] No profiles matched calendar="${calendarName}" — using first candidate`
    );
    return { userId: candidateUserIds[0], allCandidateUserIds: candidateUserIds };
  }

  if (profiles.length === 1) {
    console.log(
      `[resolveBarber] ✅ Unique match on calendar="${calendarName}" → ${profiles[0].user_id}`
    );
    return {
      userId: profiles[0].user_id,
      allCandidateUserIds: candidateUserIds,
    };
  }

  // Step 2: Multiple profiles share the same calendar name — prefer active SMS user
  console.log(
    `[resolveBarber] ${profiles.length} profiles share calendar="${calendarName}" — applying tiebreakers`
  );

  const smsActive = profiles.find((p) => p.sms_engaged_current_week === true);
  if (smsActive) {
    console.log(
      `[resolveBarber] ✅ Picked sms_engaged user → ${smsActive.user_id}`
    );
    return { userId: smsActive.user_id, allCandidateUserIds: candidateUserIds };
  }

  // Step 3: Prefer active Stripe subscriber
  const activeSubscriber = profiles.find(
    (p) => p.stripe_subscription_status === 'active'
  );
  if (activeSubscriber) {
    console.log(
      `[resolveBarber] ✅ Picked active subscriber → ${activeSubscriber.user_id}`
    );
    return {
      userId: activeSubscriber.user_id,
      allCandidateUserIds: candidateUserIds,
    };
  }

  // Step 4: fallback — first profile that matched the calendar name
  console.log(
    `[resolveBarber] ⚠️  No tiebreaker matched — using first profile → ${profiles[0].user_id}`
  );
  return { userId: profiles[0].user_id, allCandidateUserIds: candidateUserIds };
}

// ---------------------------------------------------------------------------
// For nudge attribution: if the resolved user has no matching SMS buckets,
// try remaining candidates who share the calendar name. This handles the edge
// case where two barbers share both calendar_id AND calendar name and only
// one of them sent the nudge.
// ---------------------------------------------------------------------------

async function attributeNudgeWithFallback(
  resolvedUserId: string,
  allCandidateUserIds: string[],
  calendarName: string | undefined,
  appointmentDetails: any
): Promise<{ success: boolean; reason?: string; attributedUserId: string }> {
  // Try resolved user first
  const primary = await updateSmsBarberSuccess(resolvedUserId, appointmentDetails);
  if (primary.success && !primary.reason) {
    return { ...primary, attributedUserId: resolvedUserId };
  }

  // If it failed due to "No smart bucket" and we have other candidates, try them
  if (
    primary.reason?.includes('No smart bucket') &&
    allCandidateUserIds.length > 1
  ) {
    // Get other candidates that also match the calendar name
    const otherIds = allCandidateUserIds.filter((id) => id !== resolvedUserId);

    let calendarMatchedIds = otherIds;
    if (calendarName) {
      const { data: otherProfiles } = await supabase
        .from('profiles')
        .select('user_id')
        .in('user_id', otherIds)
        .eq('calendar', calendarName);

      if (otherProfiles && otherProfiles.length > 0) {
        calendarMatchedIds = otherProfiles.map((p) => p.user_id);
      }
    }

    for (const fallbackUserId of calendarMatchedIds) {
      console.log(
        `[nudgeFallback] Trying candidate ${fallbackUserId} for nudge attribution`
      );
      const fallback = await updateSmsBarberSuccess(
        fallbackUserId,
        appointmentDetails
      );
      if (fallback.success && !fallback.reason) {
        console.log(
          `[nudgeFallback] ✅ Attributed to fallback user ${fallbackUserId}`
        );
        return { ...fallback, attributedUserId: fallbackUserId };
      }
    }
  }

  return { ...primary, attributedUserId: resolvedUserId };
}

// ---------------------------------------------------------------------------
// Fetch appointment details, trying multiple access tokens if the first fails
// ---------------------------------------------------------------------------

async function fetchAppointmentDetails(
  appointmentId: string,
  tokens: { user_id: string; access_token: string }[]
): Promise<any | null> {
  for (const token of tokens) {
    try {
      const response = await fetch(
        `${ACUITY_API_BASE}/appointments/${appointmentId}`,
        { headers: { Authorization: `Bearer ${token.access_token}` } }
      );

      if (response.ok) {
        return await response.json();
      }

      console.warn(
        `[fetchAppointment] Token for ${token.user_id} returned ${response.status} — trying next`
      );
    } catch (err) {
      console.warn(
        `[fetchAppointment] Token for ${token.user_id} threw — trying next:`,
        err
      );
    }
  }

  return null;
}

// ===========================================================================
// Main webhook handler
// ===========================================================================

export async function POST(req: NextRequest) {
  try {
    console.log('\n=== ACUITY WEBHOOK RECEIVED ===');
    
    const body = await req.text();
    console.log('\nRaw Body:', body);
    
    const formData = new URLSearchParams(body);
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value;
    });
    
    console.log('\nParsed Form Data:', JSON.stringify(data, null, 2));
    
    const action = data.action;
    const appointmentId = data.id;
    const calendarId = data.calendarID;
    
    console.log('\n--- Webhook Details ---');
    console.log('Action:', action);
    console.log('Appointment ID:', appointmentId);
    console.log('Calendar ID:', calendarId);
    
    if (!appointmentId || !calendarId) {
      console.log('Missing appointment ID or calendar ID');
      return NextResponse.json({ ok: true });
    }
    
    const { data: tokens, error: tokenError } = await supabase
      .from('acuity_tokens')
      .select('user_id, access_token')
      .eq('calendar_id', calendarId);

    if (tokenError || !tokens || tokens.length === 0) {
      console.error('Could not find user for calendar_id:', calendarId);
      console.error('Error:', tokenError);
      return NextResponse.json({ ok: true });
    }

    console.log(
      `\nFound ${tokens.length} token(s) for calendar_id ${calendarId}:`,
      tokens.map((t) => t.user_id)
    );

    const appointmentDetails = await fetchAppointmentDetails(appointmentId, tokens);

    if (!appointmentDetails) {
      console.error('Failed to fetch appointment with any available token');
      return NextResponse.json({ ok: true });
    }

    console.log('\n--- Appointment Details ---');
    console.log(JSON.stringify(appointmentDetails, null, 2));

    const { userId: resolvedUserId, allCandidateUserIds } =
      await resolveBarberUserId(
        supabase,
        tokens.map((t) => t.user_id),
        appointmentDetails.calendar
      );

    console.log(`\n✅ Resolved barber: ${resolvedUserId}`);

    // -----------------------------------------------------------------------
    // Nudge attribution (appointment.scheduled only)
    // -----------------------------------------------------------------------
    if (action === 'appointment.scheduled') {
      console.log('\n--- Checking SMS Campaign Attribution ---');

      const nudgeResult = await attributeNudgeWithFallback(
        resolvedUserId,
        allCandidateUserIds,
        appointmentDetails.calendar,
        appointmentDetails
      );

      const attributedUserId = nudgeResult.attributedUserId;

      if (nudgeResult.success && !nudgeResult.reason) {
        console.log(
          `✅ SMS campaign attribution tracked (user: ${attributedUserId})`
        );

        const clientPhone = appointmentDetails.phone;
        if (clientPhone) {
          const normalizedPhone = normalizePhone(clientPhone);

          const [{ data: clientRows }, { data: profileData }] =
            await Promise.all([
              supabase
                .from('acuity_clients')
                .select('first_name, last_name, phone_normalized')
                .eq('user_id', attributedUserId)
                .eq('phone_normalized', normalizedPhone),
              supabase
                .from('profiles')
                .select('full_name')
                .eq('user_id', attributedUserId)
                .single(),
            ]);

          const clientData = clientRows?.[0] ?? null;
          const barberName = profileData?.full_name ?? 'Unknown Barber';
          const clientName = clientData
            ? `${clientData.first_name ?? ''} ${clientData.last_name ?? ''}`.trim()
            : `${appointmentDetails.firstName ?? ''} ${appointmentDetails.lastName ?? ''}`.trim();
          const clientNumber =
            clientData?.phone_normalized ?? normalizedPhone ?? clientPhone;

          const { error: logError } = await supabase
            .from('system_logs')
            .insert({
              source: 'SYSTEM',
              action: 'barber_nudge_success',
              status: 'success',
              details: `${barberName}: ${clientName} (${clientNumber}) booked`,
            });

          if (logError) {
            console.error('Failed to write system log:', logError);
          }
        }
      } else {
        console.log(
          `ℹ️  Not attributed to SMS campaign: ${nudgeResult.reason}`
        );
      }
    }

    // -----------------------------------------------------------------------
    // Update barber client (next_future_appointment)
    // -----------------------------------------------------------------------
    const shouldRefreshAvailability = [
      'appointment.scheduled',
      'appointment.rescheduled',
      'appointment.canceled',
      'appointment.changed',
    ].includes(action);

    if (
      [
        'appointment.scheduled',
        'appointment.rescheduled',
        'appointment.canceled',
      ].includes(action)
    ) {
      const result = await updateBarberClient(
        supabase,
        resolvedUserId,
        action,
        appointmentDetails
      );
      if (result.success) {
        console.log('✅ next_future_appointment updated');
      } else {
        console.log(`ℹ️  updateBarberClient skipped: ${result.reason}`);
      }
    }

    // -----------------------------------------------------------------------
    // Refresh availability
    // -----------------------------------------------------------------------
    if (shouldRefreshAvailability) {
      const weekOffsets = getRelevantAvailabilityWeekOffsets(
        action,
        typeof appointmentDetails.datetime === 'string'
          ? appointmentDetails.datetime
          : undefined
      );

      await refreshAvailabilityForOpenBookings(resolvedUserId, weekOffsets);
    }
        
    console.log('\n=== END WEBHOOK ===\n');
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Error processing Acuity webhook:', error);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}