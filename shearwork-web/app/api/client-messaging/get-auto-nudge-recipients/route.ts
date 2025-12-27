import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    const userId = searchParams.get('userId');

    if (!messageId || !userId) {
      return NextResponse.json(
        { error: 'messageId and userId are required' },
        { status: 400 }
      );
    }

    // First, get the scheduled message to get the cron schedule
    const { data: scheduledMessage, error: scheduleError } = await supabase
      .from('sms_scheduled_messages')
      .select('cron, cron_text')
      .eq('id', messageId)
      .eq('user_id', userId)
      .in('purpose', ['auto-nudge'])
      .single();

    if (scheduleError || !scheduledMessage) {
      console.error('Error fetching scheduled message:', scheduleError);
      return NextResponse.json(
        { error: 'Auto-nudge message not found' },
        { status: 404 }
      );
    }

    // Fetch all recipients for this message
    const { data: recipients, error } = await supabase
      .from('sms_sent')
      .select('phone_normalized, is_sent, reason, created_at, client_id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .in('purpose', ['client_sms'])
      .order('is_sent', { ascending: false }) 
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recipients:', error);
      return NextResponse.json(
        { error: 'Failed to fetch recipients' },
        { status: 500 }
      );
    }

    // Get client names from acuity_clients_testing table via client_id
    const clientIds = recipients
      ?.filter(r => r.client_id)
      .map(r => r.client_id) || [];

    let clientNames: Record<string, { first_name: string; last_name: string }> = {};

    if (clientIds.length > 0) {
      const { data: clients, error: clientsError } = await supabase
        .from('acuity_clients')
        .select('client_id, first_name, last_name')
        .in('client_id', clientIds);

      if (!clientsError && clients) {
        clientNames = clients.reduce((acc, client) => {
          acc[client.client_id] = {
            first_name: client.first_name,
            last_name: client.last_name
          };
          return acc;
        }, {} as Record<string, { first_name: string; last_name: string }>);
      }
    }

    // Combine recipients with client names
    const recipientsWithNames = recipients?.map(recipient => ({
      ...recipient,
      first_name: recipient.client_id ? clientNames[recipient.client_id]?.first_name : null,
      last_name: recipient.client_id ? clientNames[recipient.client_id]?.last_name : null,
    })) || [];

    // Calculate stats
    const totalSent = recipients?.length || 0;
    const successful = recipients?.filter(r => r.is_sent).length || 0;
    const failed = recipients?.filter(r => !r.is_sent).length || 0;

    return NextResponse.json({
      success: true,
      recipients: recipientsWithNames,
      cron: scheduledMessage.cron,
      cronText: scheduledMessage.cron_text,
      stats: {
        total: totalSent,
        successful,
        failed,
      },
    });

  } catch (error) {
    console.error('Unexpected error in get-auto-nudge-recipients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}