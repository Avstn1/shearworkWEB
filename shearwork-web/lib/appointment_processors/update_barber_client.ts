import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Normalizes a phone number to E.164 format: +11111111111
 * Handles formats like: +14379991171, 4379991171, 14379991171, (437) 999-1171, etc.
 */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Strip everything except digits and leading +
  const digits = raw.replace(/\D/g, '');

  if (!digits) return null;

  // Already 11 digits starting with 1 → prepend +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // 10 digits → assume North American, prepend +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Already had a + and 11+ digits (e.g. international) → just re-attach +
  if (raw.trimStart().startsWith('+') && digits.length >= 11) {
    return `+${digits}`;
  }

  // Fallback: return whatever we have with +
  return `+${digits}`;
}

interface AcuityAppointment {
  id: number;
  phone?: string;
  datetime?: string;   // ISO string, e.g. "2026-03-14T09:15:00-0400"
  canceled?: boolean;
  [key: string]: unknown;
}

interface UpdateBarberClientResult {
  success: boolean;
  reason?: string;
}

/**
 * Updates acuity_clients.next_future_appointment based on a webhook event.
 *
 * - appointment.scheduled / appointment.rescheduled:
 *     Sets next_future_appointment to appointmentDetails.datetime (if in the future).
 *     If the incoming appointment is earlier than the currently stored value, it wins.
 *     If later, we leave the existing value alone (another sooner appointment may exist).
 *
 * - appointment.canceled:
 *     Clears next_future_appointment only if it matches this appointment's datetime
 *     (within a 1-minute window).  
 */
export async function updateBarberClient(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  appointmentDetails: AcuityAppointment
): Promise<UpdateBarberClientResult> {
  const rawPhone = appointmentDetails.phone;
  const normalizedPhone = normalizePhone(rawPhone);

  if (!normalizedPhone) {
    return { success: false, reason: 'No phone number on appointment' };
  }

  // Resolve the client row
  const { data: client, error: clientError } = await supabase
    .from('acuity_clients')
    .select('client_id, next_future_appointment')
    .eq('user_id', userId)
    .eq('phone_normalized', normalizedPhone)
    .maybeSingle();

  if (clientError) {
    console.error('[updateBarberClient] DB error looking up client:', clientError);
    return { success: false, reason: `DB error: ${clientError.message}` };
  }

  if (!client) {
    return { success: false, reason: `No client found for phone ${normalizedPhone}` };
  }

  const apptDatetime = appointmentDetails.datetime
    ? new Date(appointmentDetails.datetime)
    : null;

  if (!apptDatetime || isNaN(apptDatetime.getTime())) {
    return { success: false, reason: 'Invalid or missing appointment datetime' };
  }

  const now = new Date();

  if (action === 'appointment.scheduled' || action === 'appointment.rescheduled') {
    // Only care about future appointments
    if (apptDatetime <= now) {
      return { success: false, reason: 'Appointment is in the past — skipping' };
    }

    const existing = client.next_future_appointment
      ? new Date(client.next_future_appointment)
      : null;

    // Only update if this appointment is sooner than what's already stored
    if (existing && existing <= apptDatetime) {
      return {
        success: false,
        reason: 'Existing next_future_appointment is already sooner — no update needed',
      };
    }

    const { error: updateError } = await supabase
      .from('acuity_clients')
      .update({ next_future_appointment: apptDatetime.toISOString() })
      .eq('user_id', userId)
      .eq('client_id', client.client_id);

    if (updateError) {
      console.error('[updateBarberClient] Failed to update next_future_appointment:', updateError);
      return { success: false, reason: `DB update error: ${updateError.message}` };
    }

    console.log(
      `[updateBarberClient] ✅ Set next_future_appointment → ${apptDatetime.toISOString()} for client ${client.client_id}`
    );
    return { success: true };
  }

  if (action === 'appointment.canceled') {
    const existing = client.next_future_appointment
      ? new Date(client.next_future_appointment)
      : null;

    if (!existing) {
      return { success: false, reason: 'No next_future_appointment set — nothing to clear' };
    }

    // Only clear if this canceled appointment matches the stored one (within 1 min)
    const diffMs = Math.abs(existing.getTime() - apptDatetime.getTime());
    const ONE_MINUTE_MS = 60 * 1000;

    if (diffMs > ONE_MINUTE_MS) {
      return {
        success: false,
        reason: 'Canceled appointment does not match stored next_future_appointment — leaving as-is',
      };
    }

    const { error: clearError } = await supabase
      .from('acuity_clients')
      .update({ next_future_appointment: null })
      .eq('user_id', userId)
      .eq('client_id', client.client_id);

    if (clearError) {
      console.error('[updateBarberClient] Failed to clear next_future_appointment:', clearError);
      return { success: false, reason: `DB clear error: ${clearError.message}` };
    }

    console.log(
      `[updateBarberClient] ✅ Cleared next_future_appointment for client ${client.client_id}`
    );
    return { success: true };
  }

  return { success: false, reason: `Unhandled action: ${action}` };
}