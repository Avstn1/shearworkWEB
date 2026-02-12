import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { searchParams } = new URL(request.url);
    const messageIds = searchParams.get('messageIds'); // Comma-separated IDs
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

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