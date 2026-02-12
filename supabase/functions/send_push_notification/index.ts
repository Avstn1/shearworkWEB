// supabase/functions/send-push-notification/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

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

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

interface TokenWithMessage {
  token: string;
  message: {
    to: string;
    sound: string;
    title: string;
    body: string;
    data: {
      reference?: string;
      reference_type?: string;
    };
  };
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

    // Get ALL push tokens for this user
    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', user_id);

    // Skip if no tokens found
    if (tokenError || !tokens || tokens.length === 0) {
      console.log(`No push tokens found for user ${user_id}`);
      return new Response(JSON.stringify({ skipped: 'No push tokens' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Deduplicate tokens
    const uniqueTokens = [...new Set(tokens.map(t => t.token))];

    // Prepare messages with token tracking
    const tokensWithMessages: TokenWithMessage[] = uniqueTokens.map((token) => ({
      token,
      message: {
        to: token,
        sound: 'default',
        title: header,
        body: message,
        data: {
          reference,
          reference_type,
        },
      },
    }));

    // Split into batches of 100
    const batches: TokenWithMessage[][] = [];
    for (let i = 0; i < tokensWithMessages.length; i += BATCH_SIZE) {
      batches.push(tokensWithMessages.slice(i, i + BATCH_SIZE));
    }

    const invalidTokens: string[] = [];
    const allResults: any[] = [];

    // Process each batch
    for (const batch of batches) {
      const messages = batch.map(item => item.message);
      
      const pushResponse = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const pushResult = await pushResponse.json();
      allResults.push(pushResult);

      // Process results for this batch
      if (pushResult.data && Array.isArray(pushResult.data)) {
        pushResult.data.forEach((ticket: ExpoPushTicket, index: number) => {
          if (ticket.status === 'error') {
            const errorType = ticket.details?.error || ticket.message || '';
            
            // Only delete tokens for device-level errors
            if (
              errorType === 'DeviceNotRegistered' ||
              errorType === 'PushTokenInvalid'
            ) {
              invalidTokens.push(batch[index].token);
            }
          }
        });
      }
    }

    // Delete invalid tokens from database
    if (invalidTokens.length > 0) {
      const { error: deleteError } = await supabase
        .from('push_tokens')
        .delete()
        .in('token', invalidTokens);

      if (deleteError) {
        console.error('Error deleting invalid tokens:', deleteError);
      } else {
        console.log(`Deleted ${invalidTokens.length} invalid tokens`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      totalTokens: tokens.length,
      uniqueTokens: uniqueTokens.length,
      batchCount: batches.length,
      invalidTokensDeleted: invalidTokens.length,
      results: allResults
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