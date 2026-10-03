import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  adjustCredits,
  computeSettlement,
  grantTrialBonus,
  InsufficientCreditsError,
} from '@/lib/credits'
import { fakeSupabase } from './helpers/fakeSupabase'

const asClient = (fake: ReturnType<typeof fakeSupabase>) => fake as unknown as SupabaseClient

describe('computeSettlement', () => {
  it('server-tracked reservation: charge successes, refund the rest', () => {
    expect(computeSettlement({ credits_reserved: 50, message_limit: 60, final_clients_to_message: 45 }, 40, 5))
      .toEqual({ releaseReserved: 50, refundAvailable: 10 })
  })

  it('never charges more than was reserved', () => {
    expect(computeSettlement({ credits_reserved: 10 }, 25, 0)).toEqual({ releaseReserved: 10, refundAvailable: 0 })
  })

  it('legacy rows keep the old formula (underflow + failures)', () => {
    expect(computeSettlement({ credits_reserved: 0, message_limit: 50, final_clients_to_message: 45 }, 44, 1))
      .toEqual({ releaseReserved: 50, refundAvailable: 6 })
    expect(computeSettlement({ message_limit: 50, final_clients_to_message: 45 }, 44, 1))
      .toEqual({ releaseReserved: 50, refundAvailable: 6 })
  })

  it('handles missing numbers without going negative', () => {
    expect(computeSettlement({}, 0, 0)).toEqual({ releaseReserved: 0, refundAvailable: 0 })
  })
})

describe('adjustCredits', () => {
  it('calls the atomic RPC with the idempotency key', async () => {
    const db = fakeSupabase(op =>
      op.rpc === 'adjust_credits'
        ? { data: [{ applied: true, old_available: 5, new_available: 15, old_reserved: 0, new_reserved: 0 }] }
        : {}
    )
    const result = await adjustCredits(
      { userId: 'u1', availableDelta: 10, action: 'Credits purchased', idempotencyKey: 'stripe_pi:pi_1' },
      asClient(db)
    )
    expect(result).toEqual({ applied: true, oldAvailable: 5, newAvailable: 15, oldReserved: 0, newReserved: 0 })
    expect(db.ops).toHaveLength(1)
    expect(db.ops[0].payload).toMatchObject({
      p_user_id: 'u1', p_available_delta: 10, p_reserved_delta: 0, p_idempotency_key: 'stripe_pi:pi_1',
    })
  })

  it('reports a replayed key as not applied', async () => {
    const db = fakeSupabase(() => ({
      data: [{ applied: false, old_available: 15, new_available: 15, old_reserved: 0, new_reserved: 0 }],
    }))
    const result = await adjustCredits({ userId: 'u1', availableDelta: 10, action: 'x', idempotencyKey: 'k' }, asClient(db))
    expect(result.applied).toBe(false)
  })

  it('maps the insufficient-credits error', async () => {
    const db = fakeSupabase(() => ({ error: { code: 'P0001', message: 'insufficient credits' } }))
    await expect(adjustCredits({ userId: 'u1', availableDelta: -5, action: 'x' }, asClient(db)))
      .rejects.toBeInstanceOf(InsufficientCreditsError)
  })

  it('falls back to read-modify-write when the migration is not applied', async () => {
    const db = fakeSupabase(op => {
      if (op.rpc) return { error: { code: 'PGRST202', message: 'function not found' } }
      if (op.table === 'profiles' && op.action === 'select') return { data: { available_credits: 3, reserved_credits: 7 } }
      return {}
    })
    const result = await adjustCredits(
      { userId: 'u1', availableDelta: 2, reservedDelta: -7, action: 'Campaign finished' },
      asClient(db)
    )
    expect(result).toMatchObject({ applied: true, newAvailable: 5, newReserved: 0 })
    const update = db.ops.find(o => o.table === 'profiles' && o.action === 'update')
    expect(update?.payload).toMatchObject({ available_credits: 5, reserved_credits: 0 })
    expect(db.ops.some(o => o.table === 'credit_transactions' && o.action === 'insert')).toBe(true)
  })

  it('fallback refuses to go below zero', async () => {
    const db = fakeSupabase(op => {
      if (op.rpc) return { error: { code: 'PGRST202', message: 'missing' } }
      if (op.action === 'select') return { data: { available_credits: 0, reserved_credits: 0 } }
      return {}
    })
    await expect(adjustCredits({ userId: 'u1', availableDelta: -1, action: 'Test message' }, asClient(db)))
      .rejects.toBeInstanceOf(InsufficientCreditsError)
  })
})

describe('grantTrialBonus', () => {
  it('does nothing if a legacy trial_bonus row exists', async () => {
    const db = fakeSupabase(op => (op.table === 'credit_transactions' ? { data: [{ id: 't1' }] } : {}))
    expect(await grantTrialBonus('u1', null, asClient(db))).toBe(false)
    expect(db.ops.some(o => o.rpc)).toBe(false)
  })

  it('grants 10 credits once, keyed per user', async () => {
    const db = fakeSupabase(op => {
      if (op.table === 'credit_transactions') return { data: [] }
      if (op.rpc) return { data: [{ applied: true, old_available: 0, new_available: 10, old_reserved: 0, new_reserved: 0 }] }
      return {}
    })
    expect(await grantTrialBonus('u1', 'cs_1', asClient(db))).toBe(true)
    expect(db.ops.find(o => o.rpc)?.payload).toMatchObject({
      p_available_delta: 10, p_action: 'trial_bonus', p_idempotency_key: 'trial_bonus:u1', p_reference_id: 'cs_1',
    })
  })
})
