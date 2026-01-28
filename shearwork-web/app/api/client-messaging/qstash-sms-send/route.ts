/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
import { qstashClient } from '@/lib/qstashClient'
import pMap from "p-map"
import { isTrialActive } from '@/utils/trial'
import { pullAvailability } from '@/lib/booking/availability/orchestrator'
import { DEFAULT_PRIMARY_SERVICE, normalizeServiceName } from '@/lib/booking/serviceNormalization'

export type Recipients = {
  phone_normalized: string;
  full_name: string;
  client_id?: string | null;
  primary_service?: string | null;
};

type AvailabilitySlotRow = {
  appointment_type_name?: string | null
  slot_date: string
  start_time: string
  start_at?: string | null
  timezone?: string | null
}

type AvailabilityLookup = {
  availabilityCount: Map<string, number>
  slotsByService: Map<string, AvailabilitySlotRow[]>
}

const SLOT_SUGGESTION_LIMIT = 3

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID

async function handler(request: Request) {
  try {
    // Get parameters from query
    const { searchParams } = new URL(request.url)
    const messageId = searchParams.get('messageId')
    const action = searchParams.get('action')

    if (!messageId) {
      console.error('❌ Missing messageId parameter')
      return NextResponse.json(
        { success: false, error: 'Missing messageId parameter' },
        { status: 400 }
      )
    }

    // Validate Twilio credentials
    if (!accountSid || !authToken || !messagingServiceSid) {
      console.error('❌ Missing Twilio credentials')
      return NextResponse.json(
        { success: false, error: 'SMS service not configured' },
        { status: 500 }
      )
    }

    // Determine status based on action parameter
    const isTest = action === 'test'
    const targetStatus = isTest ? 'DRAFT' : 'ACCEPTED'
    let purpose;

    // Fetch the scheduled message from database
    const { data: scheduledMessage, error } = await supabase
      .from('sms_scheduled_messages')
      .select('*')
      .eq('id', messageId)
      .eq('status', targetStatus)
      .single()

    if (error || !scheduledMessage) {
      console.error('❌ Failed to fetch scheduled message:', error)
      return NextResponse.json(
        { success: false, error: `Message not found with status ${targetStatus}` },
        { status: 404 }
      )
    }

    let profile: { 
      phone: string | null
      full_name: string | null
      available_credits: number | null
      trial_active?: boolean | null
      trial_start?: string | null
      trial_end?: string | null
      stripe_subscription_status?: string | null
    } | null = null

    if (isTest || scheduledMessage.purpose === 'auto-nudge') {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('phone, full_name, available_credits, trial_active, trial_start, trial_end, stripe_subscription_status')
        .eq('user_id', scheduledMessage.user_id)
        .single()

      if (profileError || !profileData) {
        console.error('❌ Failed to fetch profile:', profileError)
        return NextResponse.json(
          { success: false, error: 'User profile not found' },
          { status: 404 }
        )
      }

      profile = profileData
    }

    const isTrialUser = isTrialActive(profile ?? undefined)
    if (isTrialUser && scheduledMessage.purpose === 'auto-nudge') {
      return NextResponse.json(
        { success: false, error: 'Auto-Nudge is available after upgrading' },
        { status: 403 }
      )
    }

  const torontoNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const todayToronto = new Date(torontoNow.getFullYear(), torontoNow.getMonth(), torontoNow.getDate())

  if (scheduledMessage.start_date) {
    const startDate = new Date(scheduledMessage.start_date + 'T00:00:00')
    if (startDate > todayToronto) {
      console.log('⏭️ Skipping: Campaign has not started yet (start_date is in the future)')
      return NextResponse.json({
        success: true,
        message: 'Skipped: Campaign has not started yet',
        messageId,
        timestamp: new Date().toISOString(),
      })
    }
  }

  if (scheduledMessage.end_date) {
    const endDate = new Date(scheduledMessage.end_date + 'T00:00:00')
    if (endDate < todayToronto) {
      console.log('⏭️ Skipping: Campaign has ended (end_date is in the past)')
      return NextResponse.json({
        success: true,
        message: 'Skipped: Campaign has ended',
        messageId,
        timestamp: new Date().toISOString(),
      })
    }
  }

    // Fetch recipients based on mode (test vs scheduled message send).
    let recipients: Recipients[] = []
    // Lazily loaded availability lookup used for auto-nudge filtering and slot suggestions.
    let availabilityLookup: AvailabilityLookup | null = null

    if (isTest) {
      // Test mode: Send only to the message creator
      purpose = 'test_message'
      if (!profile?.phone) {
        console.error('❌ Failed to fetch user profile or phone not set')
        return NextResponse.json(
          { success: false, error: 'User phone number not found. Please set your phone number in profile settings.' },
          { status: 404 }
        )
      }

      if ((profile.available_credits ?? 0) < 1) {
        return NextResponse.json(
          { success: false, error: 'Insufficient credits' },
          { status: 402 }
        )
      }

      const oldAvailable = profile.available_credits || 0
      const newAvailable = oldAvailable - 1

      const { error: creditUpdateError } = await supabase
        .from('profiles')
        .update({ available_credits: newAvailable })
        .eq('user_id', scheduledMessage.user_id)

      if (creditUpdateError) {
        console.error('❌ Failed to update credits:', creditUpdateError)
        return NextResponse.json(
          { success: false, error: 'Failed to update credits' },
          { status: 500 }
        )
      }

      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: scheduledMessage.user_id,
          action: `Test message - ${scheduledMessage.title || 'Message'}`,
          old_available: oldAvailable,
          new_available: newAvailable,
          old_reserved: 0,
          new_reserved: 0,
          reference_id: scheduledMessage.id,
          created_at: new Date().toISOString(),
        })

      if (transactionError) {
        console.error('❌ Failed to log test message transaction:', transactionError)
      }

      recipients = [{
        phone_normalized: profile.phone,
        full_name: profile.full_name || 'User'
      }]
      
    } else { 
      purpose = 'client_sms'

      const algorithm = scheduledMessage.purpose === 'mass' 
        ? 'mass' 
        : scheduledMessage.purpose === 'campaign' 
          ? 'campaign' 
          : 'auto-nudge';
      const limit = scheduledMessage.message_limit || 100;

      console.log(`📊 Fetching recipients with ${algorithm} algorithm, limit: ${limit}`);

      const apiUrl = scheduledMessage.visiting_type 
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/client-messaging/preview-recipients?limit=${limit}&userId=${scheduledMessage.user_id}&visitingType=${scheduledMessage.visiting_type}&algorithm=${algorithm}`
        : `${process.env.NEXT_PUBLIC_SITE_URL}/api/client-messaging/preview-recipients?limit=${limit}&userId=${scheduledMessage.user_id}&algorithm=${algorithm}&messageId=${messageId}`;
        
      console.log('🔗 API URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Failed to fetch recipients:', errorText);
        throw new Error('Failed to load recipients');
      }

      const data = await response.json();
      console.log('✅ Recipients fetched:', {
        count: data.phoneNumbers?.length || 0,
        algorithm,
        limit
      });

      const { error: finalClientsToMessageError } = await supabase
        .from('sms_scheduled_messages')
        .update({ final_clients_to_message: data.phoneNumbers?.length })
        .eq('id', scheduledMessage.id);

      if (finalClientsToMessageError) {
        console.log('Failed to update final_clients_to_message.\n' + error)
      }

      const { error: markRunningError } = await supabase
        .from('sms_scheduled_messages')
        .update({ is_running: true })
        .eq('id', scheduledMessage.id);

      if (markRunningError) {
        console.error('Failed to mark campaign as running:', markRunningError);
      }

      // START RECURSIVE PROGRESS TRACKING (checks every 3 seconds)
      console.log('⏰ Starting progress tracking with 3-second intervals');
      try {
        await qstashClient.publishJSON({
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/client-messaging/check-sms-progress`,
          body: { message_id: scheduledMessage.id },
          delay: 3,
        });
        console.log('✅ Started progress tracking');
      } catch (trackingError: any) {
        console.error('❌ Failed to start progress tracking:', trackingError);
      }

      recipients = data.phoneNumbers || [];

      if (recipients.length === 0) {
        console.warn('⚠️ No recipients found for this message');
        return NextResponse.json({
          success: true,
          message: 'No recipients found',
          messageId,
          recipientCount: 0,
          timestamp: new Date().toISOString(),
        })
      }

      if (scheduledMessage.purpose === 'auto-nudge') {
        // Auto-nudge: pull availability once and reuse it for filtering + message suggestions.
        availabilityLookup = await loadAvailabilityForNudges(scheduledMessage.user_id)
        recipients = filterRecipientsByAvailability(recipients, availabilityLookup)

        if (recipients.length === 0) {
          console.warn('⚠️ No recipients with matching availability');
          return NextResponse.json({
            success: true,
            message: 'No recipients with matching availability',
            messageId,
            recipientCount: 0,
            timestamp: new Date().toISOString(),
          })
        }
      }

      console.log('📱 Sending to', recipients.length, 'recipients');
    }
    
    // Enqueue SMS messages
    const queue = qstashClient.queue({
      queueName: `sms-queue-${scheduledMessage.user_id}`,
    })    

    console.log('📤 Enqueueing', recipients.length, 'SMS messages');

    console.log(`MessageId: ${scheduledMessage.id}`)

    await pMap(
      recipients,
      recipient =>
        queue.enqueueJSON({
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/client-messaging/enqueue-sms`,
          body: {
            user_id: scheduledMessage.user_id,
            messageId: scheduledMessage.id,
            // Auto-nudge messages get slot suggestions appended per recipient.
            message: scheduledMessage.purpose === 'auto-nudge'
              ? buildMessageWithSuggestions(scheduledMessage.message, recipient, availabilityLookup)
              : scheduledMessage.message,
            phone_normalized: recipient.phone_normalized,
            purpose: purpose
          }
        }),
      { concurrency: 15 }
    )

    return NextResponse.json({
      success: true,
      message: 'SMS send job completed',
      messageId,
      recipientCount: recipients.length,
      timestamp: new Date().toISOString(),
    })

  } catch (err: any) {
    console.error('❌ SMS send error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

// Loads the freshest availability so we can:
// 1) avoid nudging when no slots exist, and
// 2) attach a few suggested times to each nudge.
async function loadAvailabilityForNudges(userId: string): Promise<AvailabilityLookup | null> {
  try {
    const availability = await pullAvailability(supabase, userId, { forceRefresh: true })

    if (!availability.success) {
      console.error('Availability refresh failed:', availability.errors)
      return null
    }

    const acuityFetchedAt = availability.sources?.acuity?.fetchedAt || availability.fetchedAt

    // Auto-nudge currently runs on Acuity clients, so we only load Acuity slots here.
    // This avoids mixing Square availability with Acuity client services.
    const { data: slots, error } = await supabase
      .from('availability_slots')
      .select('appointment_type_name, slot_date, start_time, start_at, timezone')
      .eq('user_id', userId)
      .eq('source', 'acuity')
      .eq('fetched_at', acuityFetchedAt)
      .gte('slot_date', availability.range.startDate)
      .lte('slot_date', availability.range.endDate)

    if (error) {
      console.error('Failed to load availability slots:', error)
      return null
    }

    return buildAvailabilityLookup(slots || [])
  } catch (error) {
    console.error('Failed to load availability for nudges:', error)
    return null
  }
}

// Converts raw slot rows into quick lookup maps for filtering + suggestions.
function buildAvailabilityLookup(slots: AvailabilitySlotRow[]): AvailabilityLookup {
  const availabilityCount = new Map<string, number>()
  const slotsByService = new Map<string, AvailabilitySlotRow[]>()
  const seenByService = new Map<string, Set<string>>()

  for (const slot of slots) {
    const serviceName = normalizeServiceName(slot.appointment_type_name)
    const key = `${slot.slot_date}|${slot.start_time}`
    const seen = seenByService.get(serviceName) ?? new Set<string>()

    // Collapse duplicate time entries per service so suggestions stay clean.
    if (seen.has(key)) continue

    seen.add(key)
    seenByService.set(serviceName, seen)
    availabilityCount.set(serviceName, (availabilityCount.get(serviceName) || 0) + 1)

    const serviceSlots = slotsByService.get(serviceName) ?? []
    serviceSlots.push(slot)
    slotsByService.set(serviceName, serviceSlots)
  }

  // Sort each service's slots so we can safely take the first N.
  for (const serviceSlots of slotsByService.values()) {
    serviceSlots.sort((a, b) => getSlotSortValue(a) - getSlotSortValue(b))
  }

  return { availabilityCount, slotsByService }
}

// Returns only recipients who have availability for their primary service,
// falling back to Haircut if their service has no slots.
function filterRecipientsByAvailability(
  recipients: Recipients[],
  availabilityLookup: AvailabilityLookup | null
): Recipients[] {
  if (recipients.length === 0) return recipients
  if (!availabilityLookup) return recipients
  if (availabilityLookup.availabilityCount.size === 0) return []

  // Fall back to default Haircut availability if a client's primary service is unavailable.
  const haircutCount = availabilityLookup.availabilityCount.get(DEFAULT_PRIMARY_SERVICE) || 0

  return recipients.filter((recipient) => {
    const serviceName = normalizeServiceName(recipient.primary_service ?? DEFAULT_PRIMARY_SERVICE)
    const serviceCount = availabilityLookup.availabilityCount.get(serviceName) || 0

    if (serviceCount > 0) return true
    if (haircutCount > 0) return true

    return false
  })
}

// Appends a compact slot suggestion string to the user's configured message.
function buildMessageWithSuggestions(
  baseMessage: string,
  recipient: Recipients,
  availabilityLookup: AvailabilityLookup | null
): string {
  if (!availabilityLookup) return baseMessage

  const labels = getSuggestedSlotLabels(recipient, availabilityLookup)
  if (labels.length === 0) return baseMessage

  // Append suggestions instead of replacing the user's configured message.
  return `${baseMessage}\nSuggested times: ${labels.join(', ')}`
}

// Picks the top N slots for this recipient's service (or Haircut fallback).
function getSuggestedSlotLabels(
  recipient: Recipients,
  availabilityLookup: AvailabilityLookup
): string[] {
  const serviceName = normalizeServiceName(recipient.primary_service ?? DEFAULT_PRIMARY_SERVICE)
  const serviceSlots = availabilityLookup.slotsByService.get(serviceName) || []
  const fallbackSlots = availabilityLookup.slotsByService.get(DEFAULT_PRIMARY_SERVICE) || []
  const slots = serviceSlots.length > 0 ? serviceSlots : fallbackSlots

  return slots
    .slice(0, SLOT_SUGGESTION_LIMIT)
    .map((slot) => formatSlotLabel(slot))
    .filter((label): label is string => Boolean(label))
}

// Formats a single slot label for SMS (short weekday + time).
function formatSlotLabel(slot: AvailabilitySlotRow): string | null {
  const date = slot.start_at
    ? new Date(slot.start_at)
    : new Date(`${slot.slot_date}T${slot.start_time}:00`)

  if (Number.isNaN(date.getTime())) {
    return `${slot.slot_date} ${slot.start_time}`
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }

  if (slot.timezone) {
    formatOptions.timeZone = slot.timezone
  }

  try {
    return date.toLocaleString('en-US', formatOptions)
  } catch {
    return date.toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
}

// Provides a stable sort value so the earliest slots come first.
function getSlotSortValue(slot: AvailabilitySlotRow): number {
  if (slot.start_at) {
    const startAtValue = Date.parse(slot.start_at)
    if (!Number.isNaN(startAtValue)) return startAtValue
  }

  const fallbackValue = Date.parse(`${slot.slot_date}T${slot.start_time}:00`)
  return Number.isNaN(fallbackValue) ? Number.MAX_SAFE_INTEGER : fallbackValue
}

// Export POST with conditional signature verification
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  if (action === 'test' || action === 'mass_test') {
    return handler(request)
  }
  
  return verifySignatureAppRouter(handler)(request)
}
