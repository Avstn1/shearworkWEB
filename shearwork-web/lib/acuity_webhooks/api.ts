// lib/acuity_webhooks/api.ts
/**
 * Acuity Webhooks API
 * Import these functions in your routes to manage webhooks programmatically
 */

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
  errorCount?: number;
  errorTime?: string;
  errorMessage?: string;
}

/**
 * Create webhooks for a user
 * Call this when a user connects their Acuity account
 */
export async function createWebhooksForUser(
  userId: string,
  accessToken: string,
  webhookUrl?: string
): Promise<{ success: boolean; webhooks?: WebhookResponse[]; error?: any }> {
  const targetUrl = webhookUrl || process.env.NEXT_PUBLIC_SITE_URL + 'api/acuity/appointment-webhook';
  
  const events: WebhookSubscription['event'][] = [
    'appointment.scheduled',
    'appointment.rescheduled',
    'appointment.canceled'
  ];
  
  const createdWebhooks: WebhookResponse[] = [];
  
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
          target: targetUrl
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to create webhook for ${userId}, event ${event}:`, error);
        continue;
      }
      
      const webhook: WebhookResponse = await response.json();
      createdWebhooks.push(webhook);
      
    } catch (error) {
      console.error(`Error creating webhook for ${userId}, event ${event}:`, error);
    }
  }
  
  // Fetch all webhooks and save to database
  try {
    const allWebhooks = await listWebhooksForUser(accessToken);
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    await supabase
      .from('acuity_tokens')
      .update({ 
        webhooks_data: allWebhooks,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
      
    return { success: true, webhooks: allWebhooks };
  } catch (error) {
    console.error(`Failed to save webhooks to database for ${userId}:`, error);
    return { success: false, error };
  }
}

/**
 * Delete all webhooks for a user
 * Call this when a user disconnects their Acuity account or deletes their account
 */
export async function deleteAllWebhooksForUser(
  userId: string,
  accessToken: string
): Promise<{ success: boolean; deletedCount?: number; error?: any }> {
  try {
    const webhooks = await listWebhooksForUser(accessToken);
    
    if (!webhooks || webhooks.length === 0) {
      return { success: true, deletedCount: 0 };
    }
    
    let deletedCount = 0;
    
    for (const webhook of webhooks) {
      const deleted = await deleteWebhook(accessToken, webhook.id);
      if (deleted) {
        deletedCount++;
      }
    }
    
    // Update database to clear webhooks_data
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    await supabase
      .from('acuity_tokens')
      .update({ 
        webhooks_data: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    return { success: true, deletedCount };
  } catch (error) {
    console.error(`Failed to delete webhooks for ${userId}:`, error);
    return { success: false, error };
  }
}

/**
 * List all webhooks for a user
 */
export async function listWebhooksForUser(
  accessToken: string
): Promise<WebhookResponse[]> {
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

/**
 * Delete a specific webhook
 */
export async function deleteWebhook(
  accessToken: string,
  webhookId: number
): Promise<boolean> {
  const response = await fetch(`${ACUITY_API_BASE}/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    }
  });
  
  return response.ok;
}

/**
 * Sync webhooks from Acuity to database
 * Call this to refresh the webhooks_data in the database
 */
export async function syncWebhooksToDatabase(
  userId: string,
  accessToken: string
): Promise<{ success: boolean; webhooks?: WebhookResponse[]; error?: any }> {
  try {
    const webhooks = await listWebhooksForUser(accessToken);
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    await supabase
      .from('acuity_tokens')
      .update({ 
        webhooks_data: webhooks,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    return { success: true, webhooks };
  } catch (error) {
    console.error(`Failed to sync webhooks for ${userId}:`, error);
    return { success: false, error };
  }
}