// lib/acuity_webhooks/update_sms_barber_success.ts
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

function getPreviousISOWeek(): string {
  const now = new Date();
  const lastWeek = new Date(now);
  lastWeek.setDate(now.getDate() - 7);
  return getISOWeek(lastWeek);
}

function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  // Remove +1 or 1 prefix
  const normalized = phone.replace(/^\+?1/, '');
  return normalized || null;
}

function parseToUTCTimestamp(datetimeStr: string): string {
  // Parse Acuity datetime format (e.g., "2026-02-01T16:30:00-0500") to UTC timestamptz
  try {
    const date = new Date(datetimeStr);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    // Format as PostgreSQL timestamptz: "2026-01-31 21:30:00+00"
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00');
  } catch (error) {
    console.error('Error parsing datetime:', datetimeStr, error);
    // Return current time as fallback
    return new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '+00');
  }
}

export async function updateSmsBarberSuccess(
  userId: string,
  appointmentDetails: any
): Promise<{ success: boolean; reason?: string }> {
  try {
    console.log(`\n=== UPDATE SMS BARBER SUCCESS ===`);
    console.log(`User ID: ${userId}`);
    console.log(`Appointment ID: ${appointmentDetails.id}`);

    // Get user's sms_engaged_current_week status
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('sms_engaged_current_week')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      console.log('Profile not found');
      return { success: false, reason: 'Profile not found' };
    }

    // Determine which ISO week to use
    const currentISOWeek = getISOWeek();
    const previousISOWeek = getPreviousISOWeek();
    
    let targetISOWeek: string;
    
    if (profile.sms_engaged_current_week) {
      targetISOWeek = currentISOWeek;
    } else {
      // Check if there's a record for previous week
      const { data: previousRecord } = await supabase
        .from('barber_nudge_success')
        .select('id')
        .eq('user_id', userId)
        .eq('iso_week_number', previousISOWeek)
        .single();
      
      if (!previousRecord) {
        console.log('No engagement this week and no record for previous week - exiting');
        return { success: true, reason: 'No relevant SMS campaign' };
      }
      
      targetISOWeek = previousISOWeek;
    }

    console.log(`Target ISO week: ${targetISOWeek}`);

    // Get the scheduled message for this week
    const title = `${userId}_${targetISOWeek}`;
    const { data: scheduledMessage, error: messageError } = await supabase
      .from('sms_scheduled_messages')
      .select('id')
      .eq('title', title)
      .single();

    if (messageError || !scheduledMessage) {
      console.log(`No scheduled message found with title: ${title}`);
      return { success: false, reason: 'No scheduled message' };
    }

    const messageId = scheduledMessage.id;

    // Normalize the appointment phone number
    const appointmentPhone = normalizePhone(appointmentDetails.phone);
    if (!appointmentPhone) {
      console.log('No phone number in appointment');
      return { success: false, reason: 'No phone number' };
    }

    // Check if SMS was sent to this phone number for this campaign
    const { data: sentMessage, error: sentError } = await supabase
      .from('sms_sent')
      .select('phone_normalized, created_at, is_sent')
      .eq('message_id', messageId)
      .eq('phone_normalized', `+1${appointmentPhone}`)
      .single();

    if (sentError || !sentMessage) {
      console.log(`No SMS sent to phone: +1${appointmentPhone} for message_id: ${messageId}`);
      return { success: false, reason: 'No SMS sent to this client' };
    }

    // Check if appointment was created after SMS was sent
    const smsCreatedAt = new Date(sentMessage.created_at).toLocaleString('en-CA', { 
      timeZone: 'America/Toronto' 
    });
    const appointmentCreatedAt = appointmentDetails.datetimeCreated;

    if (!appointmentCreatedAt || appointmentCreatedAt <= smsCreatedAt) {
      console.log(`Appointment created before SMS was sent`);
      console.log(`SMS sent: ${smsCreatedAt}, Appointment created: ${appointmentCreatedAt}`);
      return { success: false, reason: 'Appointment created before SMS' };
    }

    console.log(`✅ Appointment created after SMS was sent`);

    // Get client_id from acuity_clients
    const { data: client, error: clientError } = await supabase
      .from('acuity_clients')
      .select('client_id')
      .eq('user_id', userId)
      .eq('phone_normalized', `+1${appointmentPhone}`)
      .single();

    if (clientError || !client) {
      console.log(`Client not found in acuity_clients for phone: +1${appointmentPhone}`);
      return { success: false, reason: 'Client not found' };
    }

    const clientId = client.client_id;
    const service = appointmentDetails.type || 'Unknown';
    const price = Math.round(Number(appointmentDetails.price)) || 0;
    const appointmentDate = parseToUTCTimestamp(appointmentDetails.datetime);

    // Get total messages delivered for this campaign
    const { data: sentMessages } = await supabase
      .from('sms_sent')
      .select('is_sent')
      .eq('message_id', messageId);

    const messagesDelivered = sentMessages?.filter(msg => msg.is_sent).length || 0;

    // Check if record exists for this week
    const { data: existing } = await supabase
      .from('barber_nudge_success')
      .select('id, client_ids, services, prices, appointment_dates')
      .eq('user_id', userId)
      .eq('iso_week_number', targetISOWeek)
      .single();

    if (existing) {
      // Update existing record
      const existingClientIds = existing.client_ids || [];
      const existingServices = existing.services || [];
      const existingPrices = existing.prices || [];
      const existingAppointmentDates = existing.appointment_dates || [];

      // Only add if client not already in the list
      if (!existingClientIds.includes(clientId)) {
        const mergedClientIds = [...existingClientIds, clientId];
        const mergedServices = [...existingServices, service];
        const mergedPrices = [...existingPrices, price];
        const mergedAppointmentDates = [...existingAppointmentDates, appointmentDate];

        await supabase
          .from('barber_nudge_success')
          .update({
            messages_delivered: messagesDelivered,
            client_ids: mergedClientIds,
            services: mergedServices,
            prices: mergedPrices,
            appointment_dates: mergedAppointmentDates,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        console.log(`✅ Updated barber_nudge_success for user ${userId}`);
        
        // Create notification
        const readableDatetime = new Date(appointmentDetails.datetime).toLocaleString('en-CA', {
          timeZone: 'America/Toronto',
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            header: "SMS Auto-nudge success!",
            message: `${appointmentDetails.firstName} booked your opening at ${readableDatetime}.`,
            reference_type: 'sms_auto_nudge',
            show: false
          });
        
        return { success: true };
      } else {
        console.log(`Client ${clientId} already in barber_nudge_success`);
        return { success: true, reason: 'Client already tracked' };
      }
    } else {
      // Create new record
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
      
      // Create notification
      const readableDatetime = new Date(appointmentDetails.datetime).toLocaleString('en-CA', {
        timeZone: 'America/Toronto',
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          header: "SMS Auto-nudge success!",
          message: `${appointmentDetails.firstName} booked your opening at ${readableDatetime}.`,
          reference_type: 'sms_auto_nudge',
          show: false
        });
      
      return { success: true };
    }

  } catch (error) {
    console.error('Error in updateSmsBarberSuccess:', error);
    return { success: false, reason: String(error) };
  }
}