// /lib/smsPause.ts

/**
 * Kill switch for outbound Twilio SMS (client nudges, campaigns, scheduled sends).
 * Set to false to resume sending. OTP codes and onboarding confirmations are not affected.
 * Mirrors supabase/functions/_shared/smsPause.ts — flip both together.
 */
export const SMS_SENDS_PAUSED = true

export function smsPausedResponse(source: string) {
  console.warn(`⏸️ [${source}] SMS sending is paused (SMS_SENDS_PAUSED); skipping`)
  return Response.json({ success: true, skipped: true, reason: 'sms_paused' }, { status: 200 })
}
