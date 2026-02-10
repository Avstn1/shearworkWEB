// lib/acuity_webhooks/setup_webhooks.ts
import { createClient } from '@supabase/supabase-js';

const ACUITY_API_BASE = 'https://acuityscheduling.com/api/v1';

interface WebhookSubscription {
  event: 'appointment.scheduled' | 'appointment.rescheduled' | 'appointment.canceled' | 'appointment.changed' | 'order.completed';
  target: string;
}

interface WebhookResponse {
  id: number;
  event: string;
  target: string;
  status: string;
}

async function setupWebhooksForUser(
  userId: string,
  accessToken: string,
  webhookUrl: string,
  supabase: any
) {
  const events: WebhookSubscription['event'][] = [
    'appointment.scheduled',
    'appointment.rescheduled',
    'appointment.canceled'
  ];
  
  const results = [];
  
  for (const event of events) {
    try {
      const response = await fetch(`${ACUITY_API_BASE}/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event,
          target: webhookUrl
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to create webhook for ${userId}, event ${event}:`, error);
        results.push({ event, success: false, error });
        continue;
      }
      
      const webhook: WebhookResponse = await response.json();
      results.push({ event, success: true, webhookId: webhook.id });
      
    } catch (error) {
      console.error(`Error creating webhook for ${userId}, event ${event}:`, error);
      results.push({ event, success: false, error: (error as Error).message });
    }
  }
  
  // Fetch all webhooks and save to database
  try {
    const allWebhooks = await listWebhooksForUser(accessToken);
    await supabase
      .from('acuity_tokens')
      .update({ 
        webhooks_data: allWebhooks,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    console.log(`  ✅ Saved webhooks to database for user ${userId}`);
  } catch (error) {
    console.error(`  ⚠️  Failed to save webhooks to database for ${userId}:`, error);
  }
  
  return results;
}

export async function setupWebhooksForAllBarbers(webhookUrl: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Get all users with Acuity tokens
  const { data: tokens, error } = await supabase
    .from('acuity_tokens')
    .select('user_id, access_token');
  
  if (error) {
    console.error('Error fetching acuity tokens:', error);
    return { success: false, error };
  }
  
  if (!tokens || tokens.length === 0) {
    console.log('No Acuity tokens found');
    return { success: true, results: [] };
  }
  
  const results = [];
  
  for (const token of tokens) {
    console.log(`Setting up webhooks for user ${token.user_id}...`);
    
    const webhookResults = await setupWebhooksForUser(
      token.user_id,
      token.access_token,
      webhookUrl,
      supabase
    );
    
    results.push({
      userId: token.user_id,
      webhooks: webhookResults
    });
  }
  
  return { success: true, results };
}

// Helper to list existing webhooks for a user
export async function listWebhooksForUser(accessToken: string) {
  const response = await fetch(`${ACUITY_API_BASE}/webhooks`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to list webhooks: ${await response.text()}`);
  }
  
  return await response.json();
}

// Helper to delete a webhook
export async function deleteWebhook(
  accessToken: string,
  webhookId: number
) {
  const response = await fetch(`${ACUITY_API_BASE}/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  });
  
  return response.ok;
}