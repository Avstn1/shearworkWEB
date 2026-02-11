// scripts/backfill_calendar_ids.ts
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const ACUITY_API_BASE = 'https://acuityscheduling.com/api/v1';

// Load environment variables
async function loadEnv() {
  if (process.env.NODE_ENV !== 'production') {
    const dotenv = await import('dotenv');
    dotenv.config({ path: resolve(process.cwd(), '.env.local') });
  }
}

async function fetchCalendarIdForUser(accessToken: string): Promise<string | null> {
  try {
    // Fetch calendars for this user
    const response = await fetch(`${ACUITY_API_BASE}/calendars`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch calendars:', await response.text());
      return null;
    }
    
    const calendars = await response.json();
    
    // Most users will have one calendar, take the first one
    // If they have multiple, we'll use the first one (can be adjusted if needed)
    if (calendars && calendars.length > 0) {
      return calendars[0].id.toString();
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching calendar:', error);
    return null;
  }
}

async function backfillCalendarIds() {
  console.log('Starting calendar ID backfill...\n');
  
  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Get all users with Acuity tokens that don't have calendar_id
  const { data: tokens, error } = await supabase
    .from('acuity_tokens')
    .select('user_id, access_token, calendar_id')
    .is('calendar_id', null);
  
  if (error) {
    console.error('Error fetching tokens:', error);
    return;
  }
  
  if (!tokens || tokens.length === 0) {
    console.log('✅ No tokens need backfilling. All users already have calendar_id set.');
    return;
  }
  
  console.log(`Found ${tokens.length} users without calendar_id\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const token of tokens) {
    console.log(`Processing user ${token.user_id}...`);
    
    const calendarId = await fetchCalendarIdForUser(token.access_token);
    
    if (!calendarId) {
      console.log(`  ❌ Failed to fetch calendar ID`);
      failCount++;
      continue;
    }
    
    // Update the database
    const { error: updateError } = await supabase
      .from('acuity_tokens')
      .update({ 
        calendar_id: calendarId,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', token.user_id);
    
    if (updateError) {
      console.log(`  ❌ Failed to update database:`, updateError);
      failCount++;
    } else {
      console.log(`  ✅ Set calendar_id to ${calendarId}`);
      successCount++;
    }
  }
  
  console.log('\n=== Backfill Complete ===');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${tokens.length}`);
}

async function main() {
  await loadEnv();
  await backfillCalendarIds();
}

main().catch(console.error);