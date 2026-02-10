// scripts/setup_acuity_webhooks.ts
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { setupWebhooksForAllBarbers } from '../setup_webhooks';

async function main() {
  // Validate environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('NEXT_PUBLIC_SUPABASE_URL is not set');
    console.log('Loaded env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('SITE')));
    return;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set');
    return;
  }
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    console.error('NEXT_PUBLIC_SITE_URL is not set');
    return;
  }

  const webhookUrl = process.env.NEXT_PUBLIC_SITE_URL + 'api/acuity/appointment-webhook';
  
  console.log(`Setting up webhooks with target: ${webhookUrl}`);
  
  const result = await setupWebhooksForAllBarbers(webhookUrl);
  
  console.log('\nResults:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);