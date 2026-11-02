// /lib/featureFlags.ts

/**
 * Temporarily switch off client nudging from the app UI (the dashboard "Nudge clients"
 * button). Set to false to bring it back. Outbound SMS itself is paused separately in
 * lib/smsPause.ts.
 */
export const NUDGING_PAUSED = true
