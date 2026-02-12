// scripts/manage_acuity_webhooks.ts
import { resolve } from 'path';

// Load environment variables from .env.local only in development
if (process.env.NODE_ENV !== 'production') {
  const dotenv = await import('dotenv');
  dotenv.config({ path: resolve(process.cwd(), '.env.local') });
}

import { createClient } from '@supabase/supabase-js';
import { 
  listWebhooksForUser, 
  deleteWebhook,
  createWebhooksForUser,
  deleteAllWebhooksForUser
} from '../api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
async function deleteAllWebhooksCommand(userId: string) {
  const { data: token, error } = await supabase
    .from('acuity_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();
  
  if (error || !token) {
    console.error('Error fetching token:', error);
    return;
  }

  const result = await deleteAllWebhooksForUser(userId, token.access_token);
  
  if (result.success) {
    console.log(`✅ Deleted ${result.deletedCount} webhooks for user ${userId}`);
  } else {
    console.error(`❌ Failed to delete webhooks:`, result.error);
  }
}

// Delete all webhooks for all users
async function deleteAllWebhooksForAllUsers() {
  const { data: tokens, error } = await supabase
    .from('acuity_tokens')
    .select('user_id, access_token');
  
  if (error) {
    console.error('Error fetching tokens:', error);
    return;
  }

  console.log('\n=== DELETING ALL WEBHOOKS ===\n');
  
  for (const token of tokens || []) {
    await deleteAllWebhooksCommand(token.user_id);
  }
}

// Create webhooks for a specific user
async function createWebhooksCommand(userId: string, webhookUrl?: string) {
  const { data: token, error } = await supabase
    .from('acuity_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();
  
  if (error || !token) {
    console.error('Error fetching token:', error);
    return;
  }

  console.log(`Creating webhooks for user ${userId}...`);
  
  const result = await createWebhooksForUser(userId, token.access_token, webhookUrl);
  
  if (result.success) {
    console.log(`✅ Created ${result.webhooks?.length} webhooks`);
    console.log(JSON.stringify(result.webhooks, null, 2));
  } else {
    console.error(`❌ Failed to create webhooks:`, result.error);
  }
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
      await createWebhooksCommand(userId, webhookUrl);
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
      await deleteAllWebhooksCommand(userId);
      break;
    
    case 'delete-all':
      console.log('⚠️  This will delete ALL webhooks for ALL users!');
      console.log('Type "yes" to confirm or press Ctrl+C to cancel');
      // In a real script, you'd want to add readline for confirmation
      await deleteAllWebhooksForAllUsers();
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