import { SupabaseClient } from '@supabase/supabase-js';

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (raw.trimStart().startsWith('+') && digits.length >= 11) return `+${digits}`;
  return `+${digits}`;
}

interface AcuityAppointment {
  id: number;
  phone?: string;
  datetime?: string;
  canceled?: boolean;
  [key: string]: unknown;
}

interface UpdateBarberClientResult {
  success: boolean;
  reason?: string;
}

async function findClients(
  supabase: SupabaseClient,
  userId: string,
  normalizedPhone: string
): Promise<{ client_id: string; next_future_appointment: string | null }[]> {
  // Try primary phone first
  const { data: primary, error: primaryError } = await supabase
    .from('acuity_clients')
    .select('client_id, next_future_appointment')
    .eq('user_id', userId)
    .eq('phone_normalized', normalizedPhone);

  if (primaryError) throw new Error(`DB error: ${primaryError.message}`);
  if (primary && primary.length > 0) return primary;

  // Fall back to secondary_phone_number
  const { data: secondary, error: secondaryError } = await supabase
    .from('acuity_clients')
    .select('client_id, next_future_appointment')
    .eq('user_id', userId)
    .eq('secondary_phone_number', normalizedPhone);

  if (secondaryError) throw new Error(`DB error: ${secondaryError.message}`);
  return secondary ?? [];
}

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

  let clients: { client_id: string; next_future_appointment: string | null }[];
  try {
    clients = await findClients(supabase, userId, normalizedPhone);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[updateBarberClient] DB error looking up clients:', message);
    return { success: false, reason: message };
  }

  if (clients.length === 0) {
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
    if (apptDatetime <= now) {
      return { success: false, reason: 'Appointment is in the past — skipping' };
    }

    // Update all matching clients
    for (const client of clients) {
      const existing = client.next_future_appointment
        ? new Date(client.next_future_appointment)
        : null;

      if (existing && existing <= apptDatetime) {
        console.log(
          `[updateBarberClient] ℹ️  Skipping client ${client.client_id} — existing next_future_appointment is already sooner`
        );
        continue;
      }

      const { error: updateError } = await supabase
        .from('acuity_clients')
        .update({ next_future_appointment: apptDatetime.toISOString() })
        .eq('user_id', userId)
        .eq('client_id', client.client_id);

      if (updateError) {
        console.error('[updateBarberClient] Failed to update next_future_appointment:', updateError);
        continue;
      }

      console.log(
        `[updateBarberClient] ✅ Set next_future_appointment → ${apptDatetime.toISOString()} for client ${client.client_id}`
      );
    }

    return { success: true };
  }

  if (action === 'appointment.canceled') {
    // Update all matching clients
    for (const client of clients) {
      const existing = client.next_future_appointment
        ? new Date(client.next_future_appointment)
        : null;

      if (!existing) {
        console.log(
          `[updateBarberClient] ℹ️  Skipping client ${client.client_id} — no next_future_appointment set`
        );
        continue;
      }

      const diffMs = Math.abs(existing.getTime() - apptDatetime.getTime());
      const ONE_MINUTE_MS = 60 * 1000;

      if (diffMs > ONE_MINUTE_MS) {
        console.log(
          `[updateBarberClient] ℹ️  Skipping client ${client.client_id} — canceled appointment does not match stored next_future_appointment`
        );
        continue;
      }

      const { error: clearError } = await supabase
        .from('acuity_clients')
        .update({ next_future_appointment: null })
        .eq('user_id', userId)
        .eq('client_id', client.client_id);

      if (clearError) {
        console.error('[updateBarberClient] Failed to clear next_future_appointment:', clearError);
        continue;
      }

      console.log(
        `[updateBarberClient] ✅ Cleared next_future_appointment for client ${client.client_id}`
      );
    }

    return { success: true };
  }

  return { success: false, reason: `Unhandled action: ${action}` };
}