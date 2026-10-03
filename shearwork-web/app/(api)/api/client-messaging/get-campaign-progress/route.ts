// /app/(api)/api/client-messaging/get-campaign-progress/route.ts

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
    const messageIds = searchParams.get('messageIds'); // Comma-separated IDs

    // Build query
    let query = supabase
      .from('sms_scheduled_messages')
      .select('id, success, fail, final_clients_to_message, is_finished, status, cron')
      .eq('user_id', userId);

    // Filter by specific message IDs if provided
    if (messageIds) {
      const ids = messageIds.split(',');
      query = query.in('id', ids);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching campaign progress:', error);
      return NextResponse.json(
        { error: 'Failed to fetch campaign progress' },
        { status: 500 }
      );
    }

    // Transform data into progress objects
    const progressData = messages?.map(msg => {
      const total = msg.success + msg.fail;
      const percentage = msg.final_clients_to_message > 0
        ? Math.round((total / msg.final_clients_to_message) * 100)
        : 0;

      // Check if campaign is currently active (scheduled time has passed and not finished)
      const scheduledTime = new Date(msg.cron);
      const now = new Date();
      const isActive = msg.status === 'ACCEPTED' && scheduledTime <= now && !msg.is_finished;

      return {
        id: msg.id,
        success: msg.success,
        fail: msg.fail,
        total,
        expected: msg.final_clients_to_message,
        percentage,
        is_finished: msg.is_finished,
        is_active: isActive,
      };
    }) || [];

    return NextResponse.json({
      success: true,
      progress: progressData,
    });

  } catch (error) {
    console.error('Unexpected error in get-campaign-progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}