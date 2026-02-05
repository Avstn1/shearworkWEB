// supabase/functions/send-push-notification/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
  type: 'INSERT';
  table: string;
  schema: string;
  record: {
    id: string;
    user_id: string;
    header: string;
    message: string;
    reference?: string;
    reference_type?: string;
  };
  old_record: null;
}

Deno.serve(async (req) => {
  try {
    const payload: NotificationPayload = await req.json();
    
    // Only process INSERT events
    if (payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ skipped: 'Not an INSERT event' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { user_id, header, message, reference, reference_type } = payload.record;

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the most recent push token for this user
    const { data: tokenData, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', user_id)
      .order('last_used_at', { ascending: false })
      .limit(1)
      .single();

    // Skip if no token found
    if (tokenError || !tokenData?.token) {
      console.log(`No push token found for user ${user_id}`);
      return new Response(JSON.stringify({ skipped: 'No push token' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Send push notification
    const expoPushMessage = {
      to: tokenData.token,
      sound: 'default',
      title: header,
      body: message,
      data: {
        reference,
        reference_type,
      },
    };

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expoPushMessage),
    });

    const pushResult = await pushResponse.json();

    return new Response(JSON.stringify({ 
      success: true, 
      pushResult 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error sending push notification:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});