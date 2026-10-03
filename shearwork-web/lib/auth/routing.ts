// lib/auth/routing.ts
// The single source of truth for page access. Used by proxy.ts (server, authoritative)
// and LayoutWrapper (client, keeps soft navigations consistent). Pure: no I/O.
import { isTrialActive, type TrialProfile } from '@/utils/trial'

export type RoutingProfile = TrialProfile & {
  role?: string | null
  onboarded?: boolean | null
}

export interface RoutingInput {
  pathname: string
  /** Search string including the leading "?" (used to build ?next= on login redirects) */
  search?: string
  isLoggedIn: boolean
  /** null = logged in but the profile row could not be loaded */
  profile: RoutingProfile | null
}

/** Pages anyone can open without logging in. */
const PUBLIC_PATHS = ['/', '/login', '/signup', '/book', '/privacy-policy', '/support']

/** Reachable by logged-in users before they finish onboarding. */
const ONBOARDING_PATHS = ['/pricing', '/pricing/return']

/** Pages that require an active subscription or trial. */
export const PREMIUM_PATHS = [
  '/dashboard',
  '/analytics',
  '/client-manager',
  '/appointment-manager',
  '/expenses',
  '/settings',
  '/account',
  '/premium',
  '/user-editor',
]

/** Exact match or a sub-path: '/settings' matches '/settings/x' but not '/settings-old'. */
export function matchesPath(pathname: string, base: string): boolean {
  if (base === '/') return pathname === '/'
  return pathname === base || pathname.startsWith(`${base}/`)
}

const matchesAny = (pathname: string, bases: string[]) =>
  bases.some(base => matchesPath(pathname, base))

export const isPublicPath = (pathname: string) => matchesAny(pathname, PUBLIC_PATHS)

export function isAdminRole(role?: string | null): boolean {
  return role?.toLowerCase() === 'admin'
}

/** Paid subscription or a trial that has not ended. */
export function hasPremiumAccess(profile: RoutingProfile | null): boolean {
  return profile?.stripe_subscription_status === 'active' || isTrialActive(profile)
}

/** Only allow same-site relative paths as post-login destinations. */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  if (matchesPath(next, '/login') || matchesPath(next, '/signup')) return null
  return next
}

export function loginRedirect(pathname: string, search = ''): string {
  if (pathname === '/') return '/login'
  return `/login?next=${encodeURIComponent(`${pathname}${search}`)}`
}

/**
 * Returns where the user must be sent instead of `pathname`, or null if they may stay.
 *
 * Rules, in order:
 * 1. /pricing/return handles its own state (Stripe return + mobile auth code) -> always allowed
 * 2. Logged out: public pages only, everything else -> /login?next=<page>
 * 3. Profile failed to load: don't guess, let the page show its error state
 * 4. Admins: '/' and '/dashboard' -> /admin/dashboard; everything else allowed
 * 5. Non-admins never see /admin
 * 6. Not onboarded: only the pricing/onboarding flow, which lives at /pricing/return
 *    once they have access (paid or trial) and at /pricing otherwise
 * 7. Onboarded: '/', /login, /signup, /onboarding -> /dashboard
 * 8. Paying subscribers: /pricing -> /dashboard (trial users keep /pricing to add a card)
 * 9. Premium pages without an active subscription or trial -> /pricing
 */
export function resolveRedirect({ pathname, search = '', isLoggedIn, profile }: RoutingInput): string | null {
  if (matchesPath(pathname, '/pricing/return')) return null

  if (!isLoggedIn) {
    return isPublicPath(pathname) ? null : loginRedirect(pathname, search)
  }

  if (!profile) return null

  if (isAdminRole(profile.role)) {
    return pathname === '/' || matchesPath(pathname, '/dashboard') ? '/admin/dashboard' : null
  }

  if (matchesPath(pathname, '/admin')) return '/dashboard'

  const access = hasPremiumAccess(profile)

  if (!profile.onboarded) {
    const onboardingHome = access ? '/pricing/return' : '/pricing'
    if (matchesAny(pathname, ONBOARDING_PATHS)) {
      return matchesPath(pathname, '/pricing') && access ? onboardingHome : null
    }
    // Public info pages stay readable mid-onboarding
    if (isPublicPath(pathname) && !['/', '/login', '/signup'].includes(pathname)) return null
    return onboardingHome
  }

  if (pathname === '/login' || pathname === '/signup') {
    // Send them back to the page that bounced them to login, not always the dashboard
    return sanitizeNextPath(new URLSearchParams(search).get('next')) ?? '/dashboard'
  }

  if (pathname === '/' || matchesPath(pathname, '/onboarding')) return '/dashboard'

  // Paying subscribers have nothing to buy; trial users keep /pricing to add a card
  if (profile.stripe_subscription_status === 'active' && pathname === '/pricing') return '/dashboard'

  if (!access && matchesAny(pathname, PREMIUM_PATHS)) return '/pricing'

  return null
}
