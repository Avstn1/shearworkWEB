// supabase/functions/_shared/smsPause.ts

/**
 * Kill switch for outbound Twilio SMS from edge functions.
 * Set to false (and redeploy the functions) to resume sending.
 * Mirrors shearwork-web/lib/smsPause.ts — flip both together.
 */
export const SMS_SENDS_PAUSED = true

export function smsPausedResponse(source: string) {
  console.warn(`[${source}] SMS sending is paused (SMS_SENDS_PAUSED); skipping`)
  return new Response(JSON.stringify({ message: 'Skipped - SMS sending paused' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
