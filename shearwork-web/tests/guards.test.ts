import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import twilio from 'twilio'
import {
  isCronOrServiceRequest,
  isInternalRequest,
  isServiceRequest,
  safeEqual,
  verifyTwilioRequest,
} from '@/lib/api/guards'

const ENV = { ...process.env }

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.CRON_SECRET = 'cron-secret'
  process.env.TWILIO_AUTH_TOKEN = 'twilio-token'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.corva.ca'
  delete process.env.ALLOW_ANON_INTERNAL_CALLS
  delete process.env.TWILIO_WEBHOOK_VALIDATION
})

afterEach(() => {
  process.env = { ...ENV }
})

const withAuth = (value?: string) =>
  new Request('https://www.corva.ca/api/x', { headers: value ? { authorization: `Bearer ${value}` } : {} })

describe('secret comparison', () => {
  it('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual(undefined, undefined)).toBe(false)
  })

  it('service role detection', () => {
    expect(isServiceRequest(withAuth('service-key'))).toBe(true)
    expect(isServiceRequest(withAuth('anon-key'))).toBe(false)
    expect(isServiceRequest(withAuth())).toBe(false)
  })

  it('cron accepts CRON_SECRET or service key, nothing else', () => {
    expect(isCronOrServiceRequest(withAuth('cron-secret'))).toBe(true)
    expect(isCronOrServiceRequest(withAuth('service-key'))).toBe(true)
    expect(isCronOrServiceRequest(withAuth('anon-key'))).toBe(false)
  })

  it('cron rejects everything when CRON_SECRET is unset (no empty-secret match)', () => {
    delete process.env.CRON_SECRET
    expect(isCronOrServiceRequest(withAuth(''))).toBe(false)
    expect(isCronOrServiceRequest(withAuth('undefined'))).toBe(false)
  })

  it('internal routes reject the public anon key unless explicitly allowed', () => {
    expect(isInternalRequest(withAuth('anon-key'))).toBe(false)
    process.env.ALLOW_ANON_INTERNAL_CALLS = 'true'
    expect(isInternalRequest(withAuth('anon-key'))).toBe(true)
    expect(isInternalRequest(withAuth('random'))).toBe(false)
  })
})

describe('Twilio webhook signatures', () => {
  const params = { From: '+15555550100', Body: 'yes', MessageSid: 'SM123' }

  const twilioRequest = (signedUrl: string, requestUrl: string, signature?: string, headers: Record<string, string> = {}) => {
    const sig = signature ?? twilio.getExpectedTwilioSignature('twilio-token', signedUrl, params)
    return new Request(requestUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': sig, ...headers },
      body: new URLSearchParams(params).toString(),
    })
  }

  it('accepts a correctly signed request and returns its params', async () => {
    const url = 'https://www.corva.ca/api/barber-nudge'
    expect(await verifyTwilioRequest(twilioRequest(url, url))).toEqual(params)
  })

  it('accepts the public URL when the server sees an internal URL (proxy / Vercel)', async () => {
    const signed = 'https://www.corva.ca/api/client-messaging/sms-status?messageId=m1&user_id=u1&purpose=campaign'
    const internal = 'http://localhost:3000/api/client-messaging/sms-status?messageId=m1&user_id=u1&purpose=campaign'
    expect(await verifyTwilioRequest(twilioRequest(signed, internal))).toEqual(params)
  })

  it('rejects a forged reply (no signature)', async () => {
    const req = new Request('https://www.corva.ca/api/barber-nudge', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    })
    expect(await verifyTwilioRequest(req)).toBeNull()
  })

  it('rejects a bad signature and tampered query params', async () => {
    const url = 'https://www.corva.ca/api/barber-nudge'
    expect(await verifyTwilioRequest(twilioRequest(url, url, 'bm90LXZhbGlk'))).toBeNull()
    const signed = 'https://www.corva.ca/api/client-messaging/sms-status?user_id=victim'
    const tampered = 'https://www.corva.ca/api/client-messaging/sms-status?user_id=attacker'
    expect(await verifyTwilioRequest(twilioRequest(signed, tampered))).toBeNull()
  })

  it('escape hatch skips validation only when explicitly turned off', async () => {
    process.env.TWILIO_WEBHOOK_VALIDATION = 'off'
    const req = new Request('https://www.corva.ca/api/barber-nudge', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    })
    expect(await verifyTwilioRequest(req)).toEqual(params)
  })
})
