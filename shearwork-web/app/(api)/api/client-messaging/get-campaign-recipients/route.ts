// /app/(api)/api/client-messaging/get-campaign-recipients/route.ts

import { createSupabaseAdminClient } from '@/lib/supabaseServer';
import { getAuthenticatedUser } from '@/utils/api-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Only the logged-in barber's own campaigns (a userId query param is ignored)
    const { user } = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }
    const userId = user.id;
    const supabase = createSupabaseAdminClient();
    
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    // Fetch all recipients for this message
    const { data: recipients, error } = await supabase
      .from('sms_sent')
      .select('phone_normalized, is_sent, reason, created_at, client_id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('purpose', 'client_sms')
      .order('is_sent', { ascending: false }) // Successful sends first
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recipients:', error);
      return NextResponse.json(
        { error: 'Failed to fetch recipients' },
        { status: 500 }
      );
    }

    // Get client names from appointments table via client_id
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
      stats: {
        total: totalSent,
        successful,
        failed,
      },
    });

  } catch (error) {
    console.error('Unexpected error in get-campaign-recipients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}