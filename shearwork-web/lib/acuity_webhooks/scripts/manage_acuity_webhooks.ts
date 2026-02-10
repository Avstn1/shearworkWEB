// scripts/manage_acuity_webhooks.ts
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { listWebhooksForUser, deleteWebhook } from '../setup_webhooks';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACUITY_API_BASE = 'https://acuityscheduling.com/api/v1';

interface WebhookSubscription {
  event: 'appointment.scheduled' | 'appointment.rescheduled' | 'appointment.canceled' | 'appointment.changed' | 'order.completed';
  target: string;
}

// List all webhooks for all users
async function listAllWebhooks() {
  const { data: tokens, error } = await supabase
    .from('acuity_tokens')
    .select('user_id, access_token');
  
  if (error) {
    console.error('Error fetching tokens:', error);
    return;
  }

  console.log('\n=== WEBHOOKS FOR ALL USERS ===\n');
  
  for (const token of tokens || []) {
    try {
      const webhooks = await listWebhooksForUser(token.access_token);
      console.log(`User: ${token.user_id}`);
      console.log('Webhooks:', JSON.stringify(webhooks, null, 2));
      console.log('---\n');
      
      // Save webhooks data to database
      await supabase
        .from('acuity_tokens')
        .update({ 
          webhooks_data: webhooks,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', token.user_id);
        
    } catch (error) {
      console.error(`Failed to list webhooks for ${token.user_id}:`, error);
    }
  }
}

// Delete a specific webhook by ID for a specific user
async function deleteWebhookForUser(userId: string, webhookId: number) {
  const { data: token, error } = await supabase
    .from('acuity_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();
  
  if (error || !token) {
    console.error('Error fetching token:', error);
    return;
  }

  const success = await deleteWebhook(token.access_token, webhookId);
  
  if (success) {
    console.log(`✅ Deleted webhook ${webhookId} for user ${userId}`);
  } else {
    console.log(`❌ Failed to delete webhook ${webhookId} for user ${userId}`);
  }
}

// Delete all webhooks for a specific user
async function deleteAllWebhooksForUser(userId: string) {
  const { data: token, error } = await supabase
    .from('acuity_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();
  
  if (error || !token) {
    console.error('Error fetching token:', error);
    return;
  }

  try {
    const webhooks = await listWebhooksForUser(token.access_token);
    
    if (!webhooks || webhooks.length === 0) {
      console.log(`No webhooks found for user ${userId}`);
      return;
    }

    console.log(`Deleting ${webhooks.length} webhooks for user ${userId}...`);
    
    for (const webhook of webhooks) {
      const success = await deleteWebhook(token.access_token, webhook.id);
      if (success) {
        console.log(`  ✅ Deleted webhook ${webhook.id} (${webhook.event})`);
      } else {
        console.log(`  ❌ Failed to delete webhook ${webhook.id}`);
      }
    }
  } catch (error) {
    console.error(`Failed to delete webhooks for ${userId}:`, error);
  }
}

// Delete all webhooks for all users
async function deleteAllWebhooks() {
  const { data: tokens, error } = await supabase
    .from('acuity_tokens')
    .select('user_id, access_token');
  
  if (error) {
    console.error('Error fetching tokens:', error);
    return;
  }

  console.log('\n=== DELETING ALL WEBHOOKS ===\n');
  
  for (const token of tokens || []) {
    await deleteAllWebhooksForUser(token.user_id);
  }
}

// Create webhooks for a specific user
async function createWebhooksForUser(userId: string, webhookUrl: string) {
  const { data: token, error } = await supabase
    .from('acuity_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();
  
  if (error || !token) {
    console.error('Error fetching token:', error);
    return;
  }

  const events: WebhookSubscription['event'][] = [
    'appointment.scheduled',
    'appointment.rescheduled',
    'appointment.canceled'
  ];
  
  console.log(`Creating webhooks for user ${userId}...`);
  const results = [];
  
  for (const event of events) {
    try {
      const response = await fetch(`${ACUITY_API_BASE}/webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event,
          target: webhookUrl
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error(`  ❌ Failed to create ${event}:`, error);
        results.push({ event, success: false, error });
        continue;
      }
      
      const webhook = await response.json();
      console.log(`  ✅ Created ${event} (webhook ID: ${webhook.id})`);
      results.push({ event, success: true, webhookId: webhook.id });
      
    } catch (error) {
      console.error(`  ❌ Error creating ${event}:`, error);
      results.push({ event, success: false, error: (error as Error).message });
    }
  }
  
  // Update the database with the new webhooks
  try {
    const allWebhooks = await listWebhooksForUser(token.access_token);
    await supabase
      .from('acuity_tokens')
      .update({ 
        webhooks_data: allWebhooks,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    console.log(`\n✅ Updated webhooks_data in database for user ${userId}`);
  } catch (error) {
    console.error('Failed to update database:', error);
  }
  
  return results;
}

// Main function with command line arguments
async function main() {
  const command = process.argv[2];
  const userId = process.argv[3];
  const webhookId = process.argv[4] ? parseInt(process.argv[4]) : undefined;

  switch (command) {
    case 'list':
      await listAllWebhooks();
      break;
    
    case 'create-user':
      if (!userId) {
        console.log('Usage: npx tsx scripts/manage_acuity_webhooks.ts create-user <user_id> [webhook_url]');
        return;
      }
      const webhookUrl = process.argv[4] || process.env.NEXT_PUBLIC_SITE_URL + 'api/acuity/appointment-webhook';
      await createWebhooksForUser(userId, webhookUrl);
      break;
    
    case 'delete-one':
      if (!userId || !webhookId) {
        console.log('Usage: npx tsx scripts/manage_acuity_webhooks.ts delete-one <user_id> <webhook_id>');
        return;
      }
      await deleteWebhookForUser(userId, webhookId);
      break;
    
    case 'delete-user':
      if (!userId) {
        console.log('Usage: npx tsx scripts/manage_acuity_webhooks.ts delete-user <user_id>');
        return;
      }
      await deleteAllWebhooksForUser(userId);
      break;
    
    case 'delete-all':
      await deleteAllWebhooks();
      console.log('All webhooks deleted for all users');
      break;
    
    default:
      console.log('Available commands:');
      console.log('  list                              - List all webhooks for all users');
      console.log('  create-user <user_id> [url]       - Create webhooks for a specific user');
      console.log('  delete-one <user_id> <webhook_id> - Delete a specific webhook');
      console.log('  delete-user <user_id>             - Delete all webhooks for a user');
      console.log('  delete-all                        - Delete all webhooks for all users');
  }
}

main().catch(console.error);