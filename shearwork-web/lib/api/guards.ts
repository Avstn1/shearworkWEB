// lib/api/guards.ts
// Request authenticity checks for API routes that are not called by a logged-in user:
// internal/service calls, Vercel cron, and Twilio webhooks. (QStash routes use
// verifySignatureAppRouter from @upstash/qstash/nextjs.)
import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import twilio from 'twilio'

export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

/** True when the request carries the Supabase service role key. */
export function isServiceRequest(request: Request): boolean {
  return safeEqual(bearer(request), process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/** True for Vercel cron (`Bearer $CRON_SECRET`) or service-role callers. */
export function isCronOrServiceRequest(request: Request): boolean {
  if (isServiceRequest(request)) return true
  const cronSecret = process.env.CRON_SECRET
  return Boolean(cronSecret) && safeEqual(bearer(request), cronSecret)
}

/**
 * Internal system routes (analytics aggregation, sync triggers) called by pg_cron /
 * edge functions. Accepts the service role key or CRON_SECRET. Legacy callers that
 * send the public anon key are only accepted while ALLOW_ANON_INTERNAL_CALLS=true.
 */
export function isInternalRequest(request: Request): boolean {
  if (isCronOrServiceRequest(request)) return true
  if (process.env.ALLOW_ANON_INTERNAL_CALLS === 'true') {
    const accepted = safeEqual(bearer(request), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    if (accepted) console.warn('⚠️ Internal route called with the anon key - switch the caller to CRON_SECRET')
    return accepted
  }
  return false
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

/**
 * All URLs Twilio may have signed for this request. Behind a proxy `request.url`
 * can differ from the public URL Twilio used, so we also try the forwarded host and
 * NEXT_PUBLIC_SITE_URL with the same path + query.
 */
export function twilioCandidateUrls(request: Request): string[] {
  const url = new URL(request.url)
  const pathAndQuery = `${url.pathname}${url.search}`
  const candidates = new Set<string>([request.url])

  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') ?? 'https'
    candidates.add(`${proto}://${forwardedHost}${pathAndQuery}`)
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) {
    candidates.add(`${siteUrl.replace(/\/$/, '')}${pathAndQuery}`)
  }

  return [...candidates]
}

/**
 * Verifies X-Twilio-Signature for a form-encoded webhook.
 * Returns the parsed form params when valid, or null when the signature is invalid.
 * Set TWILIO_WEBHOOK_VALIDATION=off only as an emergency escape hatch.
 */
export async function verifyTwilioRequest(
  request: Request
): Promise<Record<string, string> | null> {
  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => {
    params[key] = typeof value === 'string' ? value : ''
  })

  if (process.env.TWILIO_WEBHOOK_VALIDATION === 'off') {
    console.warn('⚠️ Twilio webhook signature validation is disabled')
    return params
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN
  const signature = request.headers.get('x-twilio-signature')
  if (!authToken || !signature) {
    console.error('❌ Twilio webhook rejected: missing signature or auth token')
    return null
  }

  const valid = twilioCandidateUrls(request).some(url =>
    twilio.validateRequest(authToken, signature, url, params)
  )

  if (!valid) {
    console.error('❌ Twilio webhook rejected: invalid signature for', request.url)
    return null
  }

  return params
}
