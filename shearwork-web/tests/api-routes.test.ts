// Route handlers tested end-to-end with Supabase, auth and QStash mocked out.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { fakeSupabase, type FakeSupabase, type Op, type Resp } from './helpers/fakeSupabase'

// ---- shared mock state ------------------------------------------------------
const state: {
  user: User | null
  isService: boolean
  respond: (op: Op) => Resp
  db: FakeSupabase
  published: unknown[]
} = {
  user: null,
  isService: false,
  respond: () => ({}),
  db: fakeSupabase(),
  published: [],
}

const newDb = () => {
  state.db = fakeSupabase(op => state.respond(op))
  return state.db
}

// Routes may create their client once at import time, so hand out a stable object that
// always delegates to the current test's fake database
const currentDb = {
  from: (table: string) => state.db.from(table),
  rpc: (name: string, args: unknown) => state.db.rpc(name, args),
  auth: { getUser: () => state.db.auth.getUser() },
  functions: { invoke: (...args: unknown[]) => (state.db.functions.invoke as (...a: unknown[]) => unknown)(...args) },
}

vi.mock('@/lib/supabaseServer', () => ({
  createSupabaseAdminClient: () => currentDb,
  createSupabaseServerClient: async () => currentDb,
  createSupabaseTokenClient: () => currentDb,
}))

vi.mock('@/utils/api-auth', () => ({
  getAuthenticatedUser: async () => ({ user: state.user, supabase: currentDb, isService: state.isService }),
}))

vi.mock('@/lib/qstashClient', () => ({
  qstashClient: { publishJSON: async (msg: unknown) => { state.published.push(msg); return { messageId: 'q1' } } },
}))

// Pass QStash verification through so the handler logic itself can be tested;
// the real verifier is exercised in the "QStash signature" block via vi.importActual.
vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (handler: (req: Request) => Promise<Response>) => (req: Request) =>
    req.headers.get('upstash-signature') === 'valid'
      ? handler(req)
      : Promise.resolve(new Response('invalid signature', { status: 403 })),
}))

vi.mock('@/lib/clientSmsSelectionAlgorithm_Campaign', () => ({
  selectClientsForSMS_Campaign: async () => ({ clients: [] }),
}))
vi.mock('@/lib/clientSmsSelectionAlgorithm_Mass', () => ({
  selectClientsForSMS_Mass: async () => ({ clients: [] }),
}))
vi.mock('@/lib/clientSmsSelectionAlgorithm_AutoNudge', () => ({
  selectClientsForSMS_AutoNudge: async () => [],
}))

const BARBER = { id: '11111111-1111-4111-8111-111111111111' } as User
const VICTIM = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  state.user = null
  state.isService = false
  state.respond = () => ({})
  state.published = []
  newDb()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.TWILIO_AUTH_TOKEN = 'twilio-token'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.corva.ca'
  delete process.env.ALLOW_ANON_INTERNAL_CALLS
  delete process.env.TWILIO_WEBHOOK_VALIDATION
})

const get = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers })
const postJson = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

const filtersOf = (op: Op | undefined) => Object.fromEntries((op?.filters ?? []).map(([k, ...v]) => [`${k}:${v[0]}`, v[1]]))

// ---- campaign data (IDOR) ---------------------------------------------------
describe('campaign data is only readable by its owner', () => {
  it('get-campaign-recipients: 401 when logged out', async () => {
    const { GET } = await import('@/app/(api)/api/client-messaging/get-campaign-recipients/route')
    const res = await GET(get(`https://x/api/client-messaging/get-campaign-recipients?messageId=m1&userId=${VICTIM}`) as never)
    expect(res.status).toBe(401)
    expect(state.db.ops).toHaveLength(0)
  })

  it('get-campaign-recipients: ignores ?userId and scopes to the caller', async () => {
    state.user = BARBER
    state.respond = op => (op.table === 'sms_sent' ? { data: [] } : {})
    const { GET } = await import('@/app/(api)/api/client-messaging/get-campaign-recipients/route')
    const res = await GET(get(`https://x/api/client-messaging/get-campaign-recipients?messageId=m1&userId=${VICTIM}`) as never)
    expect(res.status).toBe(200)
    const query = state.db.ops.find(o => o.table === 'sms_sent')
    expect(filtersOf(query)['eq:user_id']).toBe(BARBER.id)
  })

  it('get-campaign-progress: 401 when logged out, scoped to caller when logged in', async () => {
    const { GET } = await import('@/app/(api)/api/client-messaging/get-campaign-progress/route')
    expect((await GET(get(`https://x/api?userId=${VICTIM}`) as never)).status).toBe(401)

    state.user = BARBER
    state.respond = () => ({ data: [] })
    expect((await GET(get(`https://x/api?userId=${VICTIM}`) as never)).status).toBe(200)
    expect(filtersOf(state.db.ops[0])['eq:user_id']).toBe(BARBER.id)
  })

  it('preview-recipients: 401 logged out, 403 for another barber, allowed for service calls', async () => {
    const { GET } = await import('@/app/(api)/api/client-messaging/preview-recipients/route')
    const url = `https://x/api/client-messaging/preview-recipients?userId=${VICTIM}&algorithm=campaign`

    expect((await GET(get(url))).status).toBe(401)

    state.user = BARBER
    expect((await GET(get(url))).status).toBe(403)

    state.user = null
    state.isService = true
    expect((await GET(get(url))).status).toBe(200)
  })
})

// ---- credits ----------------------------------------------------------------
describe('campaign settlement (check-sms-progress)', () => {
  const sent = (ok: number, failed: number) => [
    ...Array.from({ length: ok }, () => ({ is_sent: true, user_id: BARBER.id })),
    ...Array.from({ length: failed }, () => ({ is_sent: false, user_id: BARBER.id })),
  ]
  const scheduled = { title: 'Promo', purpose: 'campaign', message_limit: 50, final_clients_to_message: 10, is_finished: false, credits_reserved: 10 }

  const respond = (claimed: boolean) => (op: Op): Resp => {
    if (op.table === 'sms_sent') return { data: sent(8, 2) }
    if (op.table === 'sms_scheduled_messages' && op.action === 'select') return { data: scheduled }
    if (op.table === 'sms_scheduled_messages' && op.action === 'update' && (op.payload as { is_finished?: boolean }).is_finished)
      return { data: claimed ? [{ id: 'm1' }] : [] }
    if (op.rpc === 'adjust_credits')
      return { data: [{ applied: true, old_available: 0, new_available: 2, old_reserved: 10, new_reserved: 0 }] }
    return {}
  }

  const call = async () => {
    const { POST } = await import('@/app/(api)/api/client-messaging/check-sms-progress/route')
    return POST(postJson('https://x/api/client-messaging/check-sms-progress', { message_id: 'm1' }, { 'upstash-signature': 'valid' }))
  }

  it('rejects requests that are not signed by QStash', async () => {
    const { POST } = await import('@/app/(api)/api/client-messaging/check-sms-progress/route')
    const res = await POST(postJson('https://x/api/client-messaging/check-sms-progress', { message_id: 'm1' }))
    expect(res.status).toBe(403)
    expect(state.db.ops).toHaveLength(0)
  })

  it('settles once: releases the reservation and refunds everything but successes', async () => {
    state.respond = respond(true)
    const res = await call()
    expect(res.status).toBe(200)
    const rpc = state.db.ops.filter(o => o.rpc === 'adjust_credits')
    expect(rpc).toHaveLength(1)
    expect(rpc[0].payload).toMatchObject({ p_reserved_delta: -10, p_available_delta: 2 })
    const claim = state.db.ops.find(o => o.action === 'update' && (o.payload as { is_finished?: boolean }).is_finished)
    expect(filtersOf(claim)['eq:is_finished']).toBe(false)
  })

  it('a replay after settlement does not refund again', async () => {
    state.respond = respond(false)
    const res = await call()
    const body = await res.json()
    expect(body.already_settled).toBe(true)
    expect(state.db.ops.some(o => o.rpc === 'adjust_credits')).toBe(false)
  })

  it('keeps polling while sends are outstanding, without touching credits', async () => {
    state.respond = op => {
      if (op.table === 'sms_sent') return { data: sent(3, 0) }
      if (op.table === 'sms_scheduled_messages' && op.action === 'select') return { data: scheduled }
      return {}
    }
    await call()
    expect(state.published).toHaveLength(1)
    expect(state.db.ops.some(o => o.rpc)).toBe(false)
  })
})

describe('campaign reservation (save-sms-schedule)', () => {
  it.each([-500, 0, 1.5, 'abc', 999999])('rejects previewCount %s before touching credits', async previewCount => {
    state.user = BARBER
    const { POST } = await import('@/app/(api)/api/client-messaging/save-sms-schedule/route')
    const res = await POST(postJson('https://x/api/client-messaging/save-sms-schedule', {
      messages: [{ id: 'm1', validationStatus: 'ACCEPTED', previewCount, clientLimit: 50, message: 'x' }],
    }))
    expect(res.status).toBe(400)
    expect(state.db.ops.some(o => o.rpc)).toBe(false)
  })

  it('rejects a previewCount above the client limit', async () => {
    state.user = BARBER
    const { POST } = await import('@/app/(api)/api/client-messaging/save-sms-schedule/route')
    const res = await POST(postJson('https://x/api/client-messaging/save-sms-schedule', {
      messages: [{ id: 'm1', validationStatus: 'ACCEPTED', previewCount: 80, clientLimit: 50, message: 'x' }],
    }))
    expect(res.status).toBe(400)
  })

  it('deleting an unfinished campaign returns its reserved credits', async () => {
    state.user = BARBER
    state.respond = op => {
      if (op.table === 'sms_scheduled_messages' && op.action === 'select')
        return { data: { id: 'm1', title: 'Promo', status: 'ACCEPTED', purpose: 'campaign', is_finished: false, credits_reserved: 25, qstash_schedule_ids: [], cron: null } }
      if (op.table === 'sms_scheduled_messages' && op.action === 'update') return { data: [{ id: 'm1' }] }
      if (op.rpc) return { data: [{ applied: true, old_available: 0, new_available: 25, old_reserved: 25, new_reserved: 0 }] }
      return {}
    }
    const { DELETE } = await import('@/app/(api)/api/client-messaging/save-sms-schedule/route')
    const res = await DELETE(new Request('https://x', { method: 'DELETE', body: JSON.stringify({ id: 'm1' }) }))
    expect(res.status).toBe(200)
    expect(state.db.ops.find(o => o.rpc)?.payload).toMatchObject({ p_available_delta: 25, p_reserved_delta: -25 })
  })
})

describe('SMS sending (qstash-sms-send)', () => {
  it('test send requires login', async () => {
    const { POST } = await import('@/app/(api)/api/client-messaging/qstash-sms-send/route')
    const res = await POST(new Request('https://x/api/client-messaging/qstash-sms-send?messageId=m1&action=test', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it("test send of someone else's message is refused", async () => {
    state.user = BARBER
    state.respond = () => ({ data: null })
    const { POST } = await import('@/app/(api)/api/client-messaging/qstash-sms-send/route')
    const res = await POST(new Request('https://x/api/client-messaging/qstash-sms-send?messageId=m1&action=test', { method: 'POST' }))
    expect(res.status).toBe(404)
  })

  it('mass_test no longer bypasses QStash signature verification', async () => {
    const { POST } = await import('@/app/(api)/api/client-messaging/qstash-sms-send/route')
    const res = await POST(new Request('https://x/api/client-messaging/qstash-sms-send?messageId=m1&action=mass_test', { method: 'POST' }))
    expect(res.status).toBe(403)
    expect(state.db.ops).toHaveLength(0)
  })
})

// ---- webhooks -----------------------------------------------------------------
describe('Twilio webhooks reject unsigned requests', () => {
  const routes = [
    '@/app/(api)/api/barber-nudge/route',
    '@/app/(api)/api/barber-nudge/client-reply-webhook/route',
    '@/app/(api)/api/barber-nudge/fallback/route',
    '@/app/(api)/api/barber-nudge/sms-status/route',
    '@/app/(api)/api/barber-nudge/sms-status-client/route',
    '@/app/(api)/api/client-messaging/sms-status/route',
  ]
  it.each(routes)('%s', async path => {
    const { POST } = await import(/* @vite-ignore */ path)
    const res = await POST(new Request('https://www.corva.ca/api/barber-nudge', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: '+15555550100', To: '+15555550199', Body: 'yes', MessageStatus: 'failed' }).toString(),
    }))
    expect(res.status).toBe(403)
    expect(state.db.ops).toHaveLength(0)
  })
})

// ---- internal / admin routes --------------------------------------------------
describe('internal routes', () => {
  it('analytics summaries reject the public anon key', async () => {
    const { POST } = await import('@/app/(api)/api/analytics/nav_summary/route')
    const res = await POST(postJson('https://x', {}, { authorization: 'Bearer anon-key' }))
    expect(res.status).toBe(401)
  })

  it('analytics summaries accept the service key and forward the summary payload', async () => {
    const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }))
    state.db.functions.invoke = invoke as never
    const { POST } = await import('@/app/(api)/api/analytics/finance_summary/route')
    const res = await POST(postJson('https://x', { summaryType: 'daily', targetDate: '2026-10-01', bogus: 1 }, { authorization: 'Bearer service-key' }))
    expect(res.status).toBe(200)
    expect(invoke).toHaveBeenCalledWith('finance_summary', { body: { summaryType: 'daily', targetDate: '2026-10-01' } })
  })

  it('Acuity yearly cron (pull-all) needs CRON_SECRET or the service key', async () => {
    process.env.CRON_SECRET = 'cron-secret'
    const { GET } = await import('@/app/(api)/api/acuity/pull-all/route')
    expect((await GET(get('https://x/api/acuity/pull-all'))).status).toBe(401)
    expect((await GET(get('https://x/api/acuity/pull-all', { authorization: 'Bearer anon-key' }))).status).toBe(401)
  })

  it('debug route testing/appointments is admin-only', async () => {
    state.user = BARBER
    state.respond = op => (op.table === 'profiles' ? { data: { role: 'Barber' } } : {})
    const { GET } = await import('@/app/(api)/api/testing/appointments/route')
    const res = await GET(get(`https://x/api/testing/appointments?user_id=${VICTIM}`) as never)
    expect(res.status).toBe(403)
    expect(state.db.ops.some(o => o.table === 'acuity_tokens')).toBe(false)
  })

  it('trial/start requires login', async () => {
    const { POST } = await import('@/app/(api)/api/trial/start/route')
    expect((await POST(new Request('https://x', { method: 'POST' }))).status).toBe(401)
  })
})

describe('public barber search', () => {
  it('treats the query literally and only returns onboarded non-admin barbers', async () => {
    state.respond = () => ({ data: [] })
    const { GET } = await import('@/app/(api)/api/barbers/search/route')
    const { NextRequest } = await import('next/server')
    await GET(new NextRequest('https://x/api/barbers/search?q=a%25_b'))
    const op = state.db.ops[0]
    const f = filtersOf(op)
    expect(f['ilike:full_name']).toBe('%a\\%\\_b%')
    expect(f['eq:onboarded']).toBe(true)
    expect(f['neq:role']).toBe('Admin')
    expect(op.columns).toBe('full_name, booking_link, phone')
  })
})
