// lib/credits.ts
// Single entry point for changing a user's credit balance. Uses the atomic
// public.adjust_credits() RPC (see supabase/migrations/*_credits_and_profile_hardening.sql)
// and falls back to the legacy read-modify-write path if the migration is not applied yet.
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { TRIAL_BONUS_CREDITS } from '@/lib/constants/trial'

export interface AdjustCreditsInput {
  userId: string
  availableDelta?: number
  reservedDelta?: number
  action: string
  referenceId?: string | null
  /** Same key twice = applied once. Use for webhooks, callbacks and settlements. */
  idempotencyKey?: string | null
  allowNegative?: boolean
}

export interface AdjustCreditsResult {
  applied: boolean
  oldAvailable: number
  newAvailable: number
  oldReserved: number
  newReserved: number
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super('Insufficient credits')
    this.name = 'InsufficientCreditsError'
  }
}

const RPC_MISSING_CODES = new Set(['PGRST202', '42883'])

export async function adjustCredits(
  input: AdjustCreditsInput,
  supabase: SupabaseClient = createSupabaseAdminClient()
): Promise<AdjustCreditsResult> {
  const { data, error } = await supabase.rpc('adjust_credits', {
    p_user_id: input.userId,
    p_available_delta: input.availableDelta ?? 0,
    p_reserved_delta: input.reservedDelta ?? 0,
    p_action: input.action,
    p_reference_id: input.referenceId ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
    p_allow_negative: input.allowNegative ?? false,
  })

  if (error) {
    if (error.code === 'P0001') throw new InsufficientCreditsError()
    if (RPC_MISSING_CODES.has(error.code ?? '')) {
      console.warn('⚠️ adjust_credits RPC missing - apply the credits migration. Using fallback.')
      return adjustCreditsFallback(input, supabase)
    }
    throw new Error(`adjust_credits failed: ${error.message}`)
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    applied: Boolean(row?.applied),
    oldAvailable: Number(row?.old_available ?? 0),
    newAvailable: Number(row?.new_available ?? 0),
    oldReserved: Number(row?.old_reserved ?? 0),
    newReserved: Number(row?.new_reserved ?? 0),
  }
}

async function adjustCreditsFallback(
  input: AdjustCreditsInput,
  supabase: SupabaseClient
): Promise<AdjustCreditsResult> {
  if (input.referenceId) {
    const { data: existing } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('user_id', input.userId)
      .eq('action', input.action)
      .eq('reference_id', input.referenceId)
      .limit(1)
    if (input.idempotencyKey && existing && existing.length > 0) {
      const { data: p } = await supabase
        .from('profiles')
        .select('available_credits, reserved_credits')
        .eq('user_id', input.userId)
        .single()
      const av = Number(p?.available_credits ?? 0)
      const res = Number(p?.reserved_credits ?? 0)
      return { applied: false, oldAvailable: av, newAvailable: av, oldReserved: res, newReserved: res }
    }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('available_credits, reserved_credits')
    .eq('user_id', input.userId)
    .single()
  if (error || !profile) throw new Error(`Profile not found for ${input.userId}`)

  const oldAvailable = Number(profile.available_credits ?? 0)
  const oldReserved = Number(profile.reserved_credits ?? 0)
  const newAvailable = oldAvailable + (input.availableDelta ?? 0)
  const newReserved = Math.max(0, oldReserved + (input.reservedDelta ?? 0))
  if (newAvailable < 0 && !input.allowNegative) throw new InsufficientCreditsError()

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ available_credits: newAvailable, reserved_credits: newReserved, updated_at: new Date().toISOString() })
    .eq('user_id', input.userId)
  if (updateError) throw new Error(`Failed to update credits: ${updateError.message}`)

  await supabase.from('credit_transactions').insert({
    user_id: input.userId,
    action: input.action,
    old_available: Math.round(oldAvailable),
    new_available: Math.round(newAvailable),
    old_reserved: Math.round(oldReserved),
    new_reserved: Math.round(newReserved),
    reference_id: input.referenceId ?? null,
    created_at: new Date().toISOString(),
  })

  return { applied: true, oldAvailable, newAvailable, oldReserved, newReserved }
}

/**
 * Credits to release from reserved and refund to available when a campaign finishes.
 * - credits_reserved > 0 (reserved by the server): charge only successful sends.
 * - legacy rows reserved before credits_reserved existed: release message_limit and
 *   refund the underflow (message_limit - final_clients_to_message) plus failures.
 */
export function computeSettlement(
  msg: {
    message_limit?: number | null
    final_clients_to_message?: number | null
    credits_reserved?: number | null
  },
  successCount: number,
  failCount: number
): { releaseReserved: number; refundAvailable: number } {
  const reserved = Math.max(0, msg.credits_reserved ?? 0)
  if (reserved > 0) {
    const charged = Math.min(Math.max(0, successCount), reserved)
    return { releaseReserved: reserved, refundAvailable: reserved - charged }
  }

  const limit = Math.max(0, msg.message_limit ?? 0)
  const finalCount = Math.max(0, msg.final_clients_to_message ?? 0)
  const underflow = Math.max(0, limit - finalCount)
  return { releaseReserved: limit, refundAvailable: underflow + Math.max(0, failCount) }
}

/**
 * Grants the one-time trial bonus. Safe to call from every trial entry point
 * (no-card trial, Stripe trial checkout): a user only ever receives it once.
 * Returns true when credits were added by this call.
 */
export async function grantTrialBonus(
  userId: string,
  referenceId: string | null = null,
  supabase: SupabaseClient = createSupabaseAdminClient()
): Promise<boolean> {
  // Bonuses granted before idempotency keys existed are logged with action 'trial_bonus'
  const { data: existing, error } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('action', 'trial_bonus')
    .limit(1)
  if (error) throw new Error(`Failed to check trial bonus: ${error.message}`)
  if (existing && existing.length > 0) return false

  const result = await adjustCredits({
    userId,
    availableDelta: TRIAL_BONUS_CREDITS,
    action: 'trial_bonus',
    referenceId,
    idempotencyKey: `trial_bonus:${userId}`,
  }, supabase)
  return result.applied
}
