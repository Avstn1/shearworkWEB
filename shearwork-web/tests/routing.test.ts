import { describe, expect, it } from 'vitest'
import {
  matchesPath,
  resolveRedirect,
  sanitizeNextPath,
  type RoutingProfile,
} from '@/lib/auth/routing'

const DAY = 24 * 60 * 60 * 1000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString()

const paid: RoutingProfile = { role: 'Barber', onboarded: true, stripe_subscription_status: 'active' }
const stripeTrial: RoutingProfile = { role: 'Barber', onboarded: true, stripe_subscription_status: 'trialing' }
const cardlessTrial: RoutingProfile = {
  role: 'Barber', onboarded: true, trial_active: true, trial_start: iso(-5), trial_end: iso(16),
}
const expiredTrial: RoutingProfile = {
  role: 'Barber', onboarded: true, trial_active: true, trial_start: iso(-30), trial_end: iso(-9),
}
const canceled: RoutingProfile = { role: 'Barber', onboarded: true, stripe_subscription_status: 'canceled', trial_active: true }
const notOnboardedTrial: RoutingProfile = { ...cardlessTrial, onboarded: false }
const notOnboardedNoAccess: RoutingProfile = { role: 'Barber', onboarded: false }
const admin: RoutingProfile = { role: 'Admin', onboarded: true }

const go = (pathname: string, profile: RoutingProfile | null, opts: { search?: string; loggedIn?: boolean } = {}) =>
  resolveRedirect({ pathname, search: opts.search ?? '', isLoggedIn: opts.loggedIn ?? true, profile })

describe('reported bug: users bounced to /dashboard', () => {
  const appPages = ['/analytics', '/client-manager', '/appointment-manager', '/expenses', '/settings', '/dashboard']

  it.each(appPages)('paid user can open %s', page => {
    expect(go(page, paid)).toBeNull()
  })

  it.each(appPages)('trial user can open %s', page => {
    expect(go(page, cardlessTrial)).toBeNull()
    expect(go(page, stripeTrial)).toBeNull()
  })

  it('trial user can open /pricing to add a card (used to bounce to /dashboard)', () => {
    expect(go('/pricing', cardlessTrial)).toBeNull()
    expect(go('/pricing', stripeTrial)).toBeNull()
  })

  it('paying subscriber is still sent from /pricing to /dashboard', () => {
    expect(go('/pricing', paid)).toBe('/dashboard')
  })

  it('logged-out visitor goes to /login with the page they wanted, not / then /dashboard', () => {
    expect(go('/client-manager', null, { loggedIn: false, search: '?view=sms' }))
      .toBe('/login?next=%2Fclient-manager%3Fview%3Dsms')
  })

  it('logged-in user landing on /login?next= is sent back to that page', () => {
    expect(go('/login', paid, { search: '?next=%2Fclient-manager%3Fview%3Dsms' })).toBe('/client-manager?view=sms')
    expect(go('/login', paid)).toBe('/dashboard')
  })
})

describe('trial expiry', () => {
  it('expired card-less trial loses premium pages even though trial_active is still true', () => {
    expect(go('/client-manager', expiredTrial)).toBe('/pricing')
    expect(go('/pricing', expiredTrial)).toBeNull()
  })

  it('canceled subscription loses access regardless of trial flags', () => {
    expect(go('/dashboard', canceled)).toBe('/pricing')
  })
})

describe('logged out', () => {
  it.each(['/', '/login', '/signup', '/book', '/privacy-policy', '/support'])('%s is public', page => {
    expect(go(page, null, { loggedIn: false })).toBeNull()
  })

  it.each(['/dashboard', '/settings', '/admin/dashboard', '/pricing'])('%s requires login', page => {
    expect(go(page, null, { loggedIn: false })).toBe(`/login?next=${encodeURIComponent(page)}`)
  })

  it('/pricing/return is always allowed (Stripe return + mobile auth code)', () => {
    expect(go('/pricing/return', null, { loggedIn: false })).toBeNull()
  })
})

describe('onboarding', () => {
  it('not-onboarded user with access is kept in the /pricing/return wizard', () => {
    expect(go('/dashboard', notOnboardedTrial)).toBe('/pricing/return')
    expect(go('/client-manager', notOnboardedTrial)).toBe('/pricing/return')
    expect(go('/pricing', notOnboardedTrial)).toBe('/pricing/return')
    expect(go('/pricing/return', notOnboardedTrial)).toBeNull()
  })

  it('not-onboarded user without access is kept on /pricing', () => {
    expect(go('/dashboard', notOnboardedNoAccess)).toBe('/pricing')
    expect(go('/pricing', notOnboardedNoAccess)).toBeNull()
  })

  it('support and privacy pages stay readable mid-onboarding', () => {
    expect(go('/support', notOnboardedNoAccess)).toBeNull()
  })

  it('onboarded users skip /onboarding and the landing page', () => {
    expect(go('/onboarding', paid)).toBe('/dashboard')
    expect(go('/', paid)).toBe('/dashboard')
  })
})

describe('admin', () => {
  it('admins go to the admin dashboard from / and /dashboard', () => {
    expect(go('/', admin)).toBe('/admin/dashboard')
    expect(go('/dashboard', admin)).toBe('/admin/dashboard')
  })

  it('admins can open other pages without a subscription', () => {
    expect(go('/client-manager', admin)).toBeNull()
    expect(go('/admin/qstash', admin)).toBeNull()
  })

  it('role check is case-insensitive', () => {
    expect(go('/', { ...admin, role: 'admin' })).toBe('/admin/dashboard')
  })

  it('non-admins are kept out of /admin', () => {
    expect(go('/admin/dashboard', paid)).toBe('/dashboard')
    expect(go('/admin/syslogs', cardlessTrial)).toBe('/dashboard')
  })
})

describe('no redirect loops', () => {
  const profiles: Array<[string, RoutingProfile | null, boolean]> = [
    ['logged out', null, false],
    ['paid', paid, true],
    ['stripe trial', stripeTrial, true],
    ['card-less trial', cardlessTrial, true],
    ['expired trial', expiredTrial, true],
    ['canceled', canceled, true],
    ['not onboarded + trial', notOnboardedTrial, true],
    ['not onboarded, no access', notOnboardedNoAccess, true],
    ['admin', admin, true],
    ['profile failed to load', null, true],
  ]
  const pages = [
    '/', '/login', '/signup', '/onboarding', '/pricing', '/pricing/return', '/dashboard',
    '/analytics', '/client-manager', '/appointment-manager', '/expenses', '/settings',
    '/admin/dashboard', '/book', '/support', '/privacy-policy',
  ]

  it.each(profiles)('%s: every page settles within 3 hops', (_name, profile, loggedIn) => {
    for (const start of pages) {
      let current = start
      const seen = new Set<string>()
      for (let hop = 0; hop < 4; hop++) {
        const [pathname, search = ''] = current.split(/(?=\?)/)
        const next = resolveRedirect({ pathname, search, isLoggedIn: loggedIn, profile })
        if (!next) break
        expect(seen.has(next), `loop from ${start} via ${current}`).toBe(false)
        seen.add(current)
        current = next
        expect(hop, `too many hops from ${start}`).toBeLessThan(3)
      }
    }
  })
})

describe('helpers', () => {
  it('matchesPath only matches whole segments', () => {
    expect(matchesPath('/settings', '/settings')).toBe(true)
    expect(matchesPath('/settings/billing', '/settings')).toBe(true)
    expect(matchesPath('/settings-old', '/settings')).toBe(false)
    expect(matchesPath('/pricing/return', '/pricing')).toBe(true)
  })

  it('sanitizeNextPath rejects open redirects and auth pages', () => {
    expect(sanitizeNextPath('/client-manager')).toBe('/client-manager')
    expect(sanitizeNextPath('//evil.com')).toBeNull()
    expect(sanitizeNextPath('/\\evil.com')).toBeNull()
    expect(sanitizeNextPath('https://evil.com')).toBeNull()
    expect(sanitizeNextPath('/login')).toBeNull()
    expect(sanitizeNextPath(null)).toBeNull()
  })
})
