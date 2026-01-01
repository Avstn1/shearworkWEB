import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const messageId = searchParams.get('messageId');
    const message = searchParams.get('message');
    const cron = searchParams.get('cron');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // MODE 1: Get specific campaign recipients (when messageId, message, and cron are provided)
    if (messageId && message && cron) {
      return await getCampaignRecipients(supabase, userId, messageId, message, cron);
    }

    // MODE 2: Get all auto-nudge campaign history (when only userId is provided)
    return await getAutoNudgeHistory(supabase, userId);

  } catch (error) {
    console.error('Unexpected error in get-auto-nudge-recipients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// MODE 1: Get recipients for a specific campaign run
async function getCampaignRecipients(
  supabase: any,
  userId: string,
  messageId: string,
  message: string,
  cron: string
) {
  // Fetch all recipients for this specific campaign run
  const { data: recipients, error } = await supabase
    .from('sms_sent')
    .select('phone_normalized, is_sent, reason, created_at, client_id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('message', message)
    .eq('cron', cron)
    .order('is_sent', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recipients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipients' },
      { status: 500 }
    );
  }

  // Get client names from acuity_clients table
  const clientIds = recipients
    ?.filter((r: any) => r.client_id)
    .map((r: any) => r.client_id) || [];

  let clientNames: Record<string, { first_name: string; last_name: string }> = {};

  if (clientIds.length > 0) {
    const { data: clients, error: clientsError } = await supabase
      .from('acuity_clients')
      .select('client_id, first_name, last_name')
      .in('client_id', clientIds);

    if (!clientsError && clients) {
      clientNames = clients.reduce((acc: any, client: any) => {
        acc[client.client_id] = {
          first_name: client.first_name,
          last_name: client.last_name
        };
        return acc;
      }, {} as Record<string, { first_name: string; last_name: string }>);
    }
  }

  // Combine recipients with client names
  const recipientsWithNames = recipients?.map((recipient: any) => ({
    ...recipient,
    first_name: recipient.client_id ? clientNames[recipient.client_id]?.first_name : null,
    last_name: recipient.client_id ? clientNames[recipient.client_id]?.last_name : null,
  })) || [];

  // Calculate stats
  const totalSent = recipients?.length || 0;
  const successful = recipients?.filter((r: any) => r.is_sent).length || 0;
  const failed = recipients?.filter((r: any) => !r.is_sent).length || 0;

  // Parse cron to generate human-readable text
  const cronText = parseCronToText(cron);

  return NextResponse.json({
    success: true,
    recipients: recipientsWithNames,
    cron,
    cronText,
    message,
    stats: {
      total: totalSent,
      successful,
      failed,
    },
  });
}

// MODE 2: Get all auto-nudge campaign history grouped by message_id, message, and cron - UPDATED. USE LATER
async function getAutoNudgeHistory(supabase: any, userId: string) {
  // Fetch all sms_sent records for this user WHERE the parent campaign has purpose = 'auto-nudge'
  const { data: sentMessages, error } = await supabase
    .from('sms_sent')
    .select(`
      message_id, 
      message, 
      cron, 
      is_sent, 
      created_at,
      sms_scheduled_messages!inner(purpose)
    `)
    .eq('user_id', userId)
    .eq('purpose', 'client_sms')
    .eq('sms_scheduled_messages.purpose', 'auto-nudge')
    .not('message_id', 'is', null)
    .not('message', 'is', null)
    .not('cron', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching sent messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auto-nudge history' },
      { status: 500 }
    );
  }

  // Rest of the function remains the same...
  // Group by message_id + message + cron
  const groupedCampaigns = new Map<string, {
    message_id: string;
    message: string;
    cron: string;
    title: string;
    success: number;
    fail: number;
    total: number;
    final_clients_to_message: number;
    last_sent: string;
  }>();

  sentMessages?.forEach((msg: any) => {
    const key = `${msg.message_id}|${msg.message}|${msg.cron}`;
    
    if (!groupedCampaigns.has(key)) {
      groupedCampaigns.set(key, {
        message_id: msg.message_id,
        message: msg.message,
        cron: msg.cron,
        title: '',
        success: 0,
        fail: 0,
        total: 0,
        final_clients_to_message: 0,
        last_sent: msg.created_at,
      });
    }

    const campaign = groupedCampaigns.get(key)!;
    campaign.total += 1;
    
    if (msg.is_sent) {
      campaign.success += 1;
    } else {
      campaign.fail += 1;
    }

    if (new Date(msg.created_at) > new Date(campaign.last_sent)) {
      campaign.last_sent = msg.created_at;
    }
  });

  // Fetch titles from sms_scheduled_messages (with auto-nudge filter for safety)
  const messageIds = Array.from(new Set(
    Array.from(groupedCampaigns.values()).map(c => c.message_id)
  ));

  if (messageIds.length > 0) {
    const { data: scheduledMessages } = await supabase
      .from('sms_scheduled_messages')
      .select('id, title, final_clients_to_message')
      .in('id', messageIds)
      .eq('purpose', 'auto-nudge'); // Additional safety filter

    const messageDataMap = new Map<string, { title: string; final_clients_to_message: number }>(
      scheduledMessages?.map((sm: any) => [sm.id, { 
        title: sm.title, 
        final_clients_to_message: sm.final_clients_to_message 
      }]) || []
    );

    groupedCampaigns.forEach(campaign => {
      const messageData = messageDataMap.get(campaign.message_id);
      campaign.title = messageData?.title || 'Untitled Message';
      campaign.final_clients_to_message = messageData?.final_clients_to_message || 0;
    });
  }

  const campaigns = Array.from(groupedCampaigns.values())
    .sort((a, b) => new Date(b.last_sent).getTime() - new Date(a.last_sent).getTime())
    .map(campaign => ({
      ...campaign,
      cron_text: parseCronToText(campaign.cron),
    }));

  return NextResponse.json({
    success: true,
    campaigns,
  });
}

function parseCronToText(cron: string): string {
  try {
    const parts = cron.split(' ');
    if (parts.length < 5) return cron;

    const minute = parts[0];
    const hour = parts[1];
    const dayOfMonth = parts[2];

    // Convert 24-hour to 12-hour format
    let hour12 = parseInt(hour);
    let period = 'AM';
    
    if (hour12 === 0) {
      hour12 = 12;
    } else if (hour12 === 12) {
      period = 'PM';
    } else if (hour12 > 12) {
      hour12 = hour12 - 12;
      period = 'PM';
    }

    const timeStr = `${hour12}:${minute.padStart(2, '0')} ${period}`;
    
    if (dayOfMonth === '*') {
      return `Every day at ${timeStr}`;
    } else {
      const daySuffix = getDaySuffix(parseInt(dayOfMonth));
      return `Monthly on the ${dayOfMonth}${daySuffix} at ${timeStr}`;
    }
  } catch (error) {
    return cron;
  }
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}