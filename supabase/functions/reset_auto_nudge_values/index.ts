// SUPABASE EDGE FUNCTION - Reset Auto-Nudge Messages Monthly
// CRON JOB: 0 0 1 * * (Runs at midnight on the 1st of every month)

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get("NEXT_PUBLIC_SUPABASE_URL") ?? '', 
  Deno.env.get("SERVICE_ROLE_KEY") ?? '', 
)

Deno.serve(async (req) => {
  try {
    const now = new Date();
    console.log(`🔄 Starting auto-nudge reset for ${now.toISOString()}`);

    // Reset auto-nudge messages
    const { data, error } = await supabase
      .from('sms_scheduled_messages')
      .update({
        success: 0,
        fail: 0,
        final_clients_to_message: null,
        is_finished: false
      })
      .eq('purpose', 'auto-nudge')
      .select('id, user_id, title');

    if (error) {
      console.error('❌ Error resetting auto-nudge messages:', error);
      throw error;
    }

    console.log(`✅ Successfully reset ${data?.length || 0} auto-nudge messages`);
    
    // Log which messages were reset
    if (data && data.length > 0) {
      data.forEach(msg => {
        console.log(`  - Reset message: ${msg.title} (ID: ${msg.id}, User: ${msg.user_id})`);
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        messages_reset: data?.length || 0,
        timestamp: now.toISOString()
      }), 
      { 
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (err) {
    console.error('❌ Fatal error:', err);
    return new Response(
      String(err?.message ?? err), 
      { status: 500 }
    );
  }
});