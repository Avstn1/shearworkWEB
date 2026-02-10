// scripts/setup_acuity_webhooks.ts
import { resolve } from 'path';

// Load environment variables from .env.local only in development
if (process.env.NODE_ENV !== 'production') {
  const dotenv = await import('dotenv');
  dotenv.config({ path: resolve(process.cwd(), '.env.local') });
}

import { createClient } from '@supabase/supabase-js';
import { createWebhooksForUser } from '../api';

async function setupWebhooksForAllBarbers(webhookUrl: string) {
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
    
    const result = await createWebhooksForUser(
      token.user_id,
      token.access_token,
      webhookUrl
    );
    
    results.push({
      userId: token.user_id,
      success: result.success,
      webhooks: result.webhooks,
      error: result.error
    });
  }
  
  return { success: true, results };
}

async function main() {
  const webhookUrl = process.env.NEXT_PUBLIC_SITE_URL + 'api/acuity/appointment-webhook';
  
  console.log(`Setting up webhooks with target: ${webhookUrl}`);
  
  const result = await setupWebhooksForAllBarbers(webhookUrl);
  
  console.log('\nResults:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);