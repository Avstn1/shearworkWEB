// /app/(api)/api/client-messaging/check-sms-progress/route.ts
//
// QStash-driven progress loop for a running campaign. When every recipient has a
// result, the campaign is settled exactly once: the reserved credits are released
// and everything that was not a successful send is refunded.

import { NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { createSupabaseAdminClient } from '@/lib/supabaseServer';
import { qstashClient } from '@/lib/qstashClient';
import { adjustCredits, computeSettlement } from '@/lib/credits';

type ScheduledMessage = {
  title: string | null;
  purpose: string | null;
  message_limit: number | null;
  final_clients_to_message: number | null;
  is_finished: boolean | null;
  credits_reserved?: number | null;
};

async function handler(request: Request) {
  try {
    const supabase = createSupabaseAdminClient();
    const { message_id } = await request.json();

    if (!message_id) {
      return NextResponse.json({ error: 'message_id is required' }, { status: 400 });
    }

    // Step 1: Count successful and failed SMS sends
    const { data: sentMessages, error: fetchError } = await supabase
      .from('sms_sent')
      .select('is_sent, user_id')
      .eq('message_id', message_id)
      .neq('purpose', 'test_message');

    if (fetchError) {
      console.error('Error fetching sms_sent records:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch SMS records' }, { status: 500 });
    }

    if (!sentMessages || sentMessages.length === 0) {
      return NextResponse.json({ error: 'No SMS records found for this message_id' }, { status: 404 });
    }

    const successCount = sentMessages.filter(msg => msg.is_sent === true).length;
    const failCount = sentMessages.filter(msg => msg.is_sent === false).length;
    const totalCount = successCount + failCount;
    const userId = sentMessages[0].user_id;

    // Step 2: Get the scheduled message (select * so this works before and after the
    // credits_reserved migration)
    const { data: scheduledMessage, error: scheduledMessageError } = await supabase
      .from('sms_scheduled_messages')
      .select('*')
      .eq('id', message_id)
      .single<ScheduledMessage>();

    if (scheduledMessageError || !scheduledMessage) {
      console.error('Error fetching scheduled message:', scheduledMessageError);
      return NextResponse.json({ error: 'Failed to fetch scheduled message' }, { status: 500 });
    }

    const expected = scheduledMessage.final_clients_to_message ?? 0;
    const allSent = totalCount >= expected;

    // Step 3: Always refresh the live counters
    const { error: updateMessageError } = await supabase
      .from('sms_scheduled_messages')
      .update({ success: successCount, fail: failCount })
      .eq('id', message_id);

    if (updateMessageError) {
      console.error('Error updating sms_scheduled_messages:', updateMessageError);
      return NextResponse.json({ error: 'Failed to update message stats' }, { status: 500 });
    }

    if (!allSent) {
      // Not all messages sent yet - check again in 3 seconds
      console.log(`📊 Progress: ${totalCount}/${expected} - Rescheduling check in 3 seconds`);
      try {
        await qstashClient.publishJSON({
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/client-messaging/check-sms-progress`,
          body: { message_id },
          delay: 3,
        });
      } catch (rescheduleError) {
        console.error('Failed to reschedule progress check:', rescheduleError);
      }
      return NextResponse.json({
        success: true,
        message_id,
        all_sent: false,
        stats: { success: successCount, fail: failCount, total: totalCount, expected },
      });
    }

    // Step 4: Claim the settlement. Only the request that flips is_finished
    // false -> true settles credits, so QStash retries and replays are no-ops.
    const finishUpdate: Record<string, unknown> = { is_finished: true, is_running: false };
    if ('credits_reserved' in scheduledMessage) finishUpdate.credits_reserved = 0;

    const { data: claimed, error: claimError } = await supabase
      .from('sms_scheduled_messages')
      .update(finishUpdate)
      .eq('id', message_id)
      .eq('is_finished', false)
      .select('id');

    if (claimError) {
      console.error('Error marking campaign finished:', claimError);
      return NextResponse.json({ error: 'Failed to finish campaign' }, { status: 500 });
    }

    if (!claimed || claimed.length === 0) {
      console.log(`ℹ️ Campaign ${message_id} already settled - skipping`);
      return NextResponse.json({ success: true, message_id, all_sent: true, already_settled: true });
    }

    // Step 5: Settle credits (auto-nudge messages are free)
    let credits: Record<string, unknown> = { message: 'Auto-nudge messages are free' };
    if (scheduledMessage.purpose !== 'auto-nudge') {
      const { releaseReserved, refundAvailable } = computeSettlement(scheduledMessage, successCount, failCount);
      try {
        const result = await adjustCredits({
          userId,
          availableDelta: refundAvailable,
          reservedDelta: -releaseReserved,
          action: `Campaign finished - ${scheduledMessage.title || 'Untitled'}`,
          referenceId: message_id,
        });
        credits = {
          reserved_credits: result.newReserved,
          available_credits: result.newAvailable,
          refunded: refundAvailable,
        };
      } catch (creditError) {
        console.error('Error settling campaign credits:', creditError);
        return NextResponse.json({ error: 'Failed to update user credits' }, { status: 500 });
      }
    }

    // Step 6: Notify the barber
    const notificationMessage = scheduledMessage.purpose === 'auto-nudge'
      ? `Your auto-nudge campaign has finished sending. ${successCount} successful, ${failCount} failed out of ${totalCount} total messages.`
      : `Your SMS campaign has finished sending. ${successCount} successful, ${failCount} failed out of ${totalCount} total messages.`;

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        header: scheduledMessage.purpose === 'auto-nudge' ? 'Auto-Nudge Completed' : 'SMS Campaign Completed',
        message: notificationMessage,
        reference: message_id,
        reference_type: 'sms_campaign',
      });

    if (notificationError) {
      console.error('Error creating notification:', notificationError);
    }

    return NextResponse.json({
      success: true,
      message_id,
      all_sent: true,
      stats: { success: successCount, fail: failCount, total: totalCount, expected },
      credits,
    });
  } catch (error) {
    console.error('Unexpected error in check-sms-progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
