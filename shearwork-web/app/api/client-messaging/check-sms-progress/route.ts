import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await request.json();
    const { message_id } = body;

    if (!message_id) {
      return NextResponse.json(
        { error: 'message_id is required' },
        { status: 400 }
      );
    }

    // Step 1: Count successful and failed SMS sends
    const { data: sentMessages, error: fetchError } = await supabase
      .from('sms_sent')
      .select('is_sent, user_id')
      .eq('message_id', message_id);

    if (fetchError) {
      console.error('Error fetching sms_sent records:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch SMS records' },
        { status: 500 }
      );
    }

    if (!sentMessages || sentMessages.length === 0) {
      return NextResponse.json(
        { error: 'No SMS records found for this message_id' },
        { status: 404 }
      );
    }

    const successCount = sentMessages.filter(msg => msg.is_sent === true).length;
    const failCount = sentMessages.filter(msg => msg.is_sent === false).length;
    const totalCount = successCount + failCount;
    const userId = sentMessages[0].user_id;

    // Step 2: Get the scheduled message to check final_clients_to_message
    const { data: scheduledMessage, error: scheduledMessageError } = await supabase
      .from('sms_scheduled_messages')
      .select('final_clients_to_message')
      .eq('id', message_id)
      .single();

    if (scheduledMessageError || !scheduledMessage) {
      console.error('Error fetching scheduled message:', scheduledMessageError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled message' },
        { status: 500 }
      );
    }

    // Check if all messages have been sent
    const allSent = totalCount >= scheduledMessage.final_clients_to_message;

    // Step 3: Update sms_scheduled_messages with success and fail counts
    const updateData: any = {
      success: successCount,
      fail: failCount,
    };

    // Mark as finished if all messages sent
    if (allSent) {
      updateData.is_finished = true;
    }

    const { error: updateMessageError } = await supabase
      .from('sms_scheduled_messages')
      .update(updateData)
      .eq('id', message_id);

    if (updateMessageError) {
      console.error('Error updating sms_scheduled_messages:', updateMessageError);
      return NextResponse.json(
        { error: 'Failed to update message stats' },
        { status: 500 }
      );
    }

    // Step 4: Get current user credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('reserved_credits, available_credits')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    // Step 5: Calculate new credit values
    // Remove all attempts (success + fail) from reserved_credits
    const newReservedCredits = Math.max(0, profile.reserved_credits - totalCount);
    
    // Refund failed attempts to available_credits
    const newAvailableCredits = profile.available_credits + failCount;

    // Step 6: Update user credits
    const { error: updateCreditsError } = await supabase
      .from('profiles')
      .update({
        reserved_credits: newReservedCredits,
        available_credits: newAvailableCredits,
      })
      .eq('user_id', userId);

    if (updateCreditsError) {
      console.error('Error updating user credits:', updateCreditsError);
      return NextResponse.json(
        { error: 'Failed to update user credits' },
        { status: 500 }
      );
    }

    // Step 7: Handle completion or reschedule
    if (allSent) {
      // All messages sent - create notification
      console.log('✅ All messages sent, creating completion notification');
      
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          header: 'SMS Campaign Completed',
          message: `Your SMS campaign has finished sending. ${successCount} successful, ${failCount} failed out of ${totalCount} total messages.`,
          reference: message_id,
          reference_type: 'sms_campaign',
        });

      if (notificationError) {
        console.error('Error creating notification:', notificationError);
        // Don't fail the entire request if notification fails
      }
    } else {
      // Not all messages sent yet - reschedule another check in 3 seconds
      console.log(`📊 Progress: ${totalCount}/${scheduledMessage.final_clients_to_message} - Rescheduling check in 3 seconds`);
      
      try {
        await qstashClient.publishJSON({
          url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/client-messaging/check-sms-progress`,
          body: { message_id },
          delay: 3, // Check again in 3 seconds
        });
      } catch (rescheduleError) {
        console.error('Failed to reschedule progress check:', rescheduleError);
        // Don't fail the entire request if rescheduling fails
      }
    }

    return NextResponse.json({
      success: true,
      message_id,
      all_sent: allSent,
      stats: {
        success: successCount,
        fail: failCount,
        total: totalCount,
        expected: scheduledMessage.final_clients_to_message,
      },
      credits: {
        reserved_credits: newReservedCredits,
        available_credits: newAvailableCredits,
        refunded: failCount,
      },
    });
  } catch (error) {
    console.error('Unexpected error in check-sms-progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}