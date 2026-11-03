/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X, Grid, UserCog, CreditCard, FileText, ChartBar, Coins, Calendar, Megaphone, MessageCircleReply, BookText, TrendingUp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import UserProfile from '@/components/UserProfile'
import TipsDropdown from '@/components/ManageTipsButton'
import Tooltip from '@/components/Wrappers/Tooltip'
import NotificationsDropdown from '@/components/NotificationsDropdown'
import NewFeaturesModal from '@/components/Dashboard/NewFeaturesModal'
import CreditsModal from '@/components/Dashboard/CreditsModal'
import { useAuth } from '@/contexts/AuthContext'
import { ButtonLink } from '@/components/ui/Button'

// Logged-out (marketing) mobile menu colours. The logged-in app chrome uses the
// Graphite tokens from globals.css instead.
const COLORS = {
  navBg: '#13171C',
  surfaceSolid: '#151920',
  text: '#EEF1F5',
  green: '#3DD27A',
}

type HoverEvent = React.MouseEvent<HTMLElement>

/** Logged-out menu links: green text + tint on hover */
const hoverHighlight = {
  onMouseEnter: (e: HoverEvent) => {
    e.currentTarget.style.color = COLORS.green
    e.currentTarget.style.backgroundColor = 'rgba(61, 210, 122, 0.1)'
  },
  onMouseLeave: (e: HoverEvent) => {
    e.currentTarget.style.color = COLORS.text
    e.currentTarget.style.backgroundColor = 'transparent'
  },
}

type NavItem = { href: string; icon: LucideIcon; label: string }

// Same items as the desktop Sidebar
const BARBER_NAV: NavItem[] = [
  { href: '/dashboard', icon: Grid, label: 'Dashboard' },
  { href: '/analytics', icon: TrendingUp, label: 'Analytics' },
  { href: '/client-manager', icon: UserCog, label: 'Client Manager' },
  { href: '/appointment-manager', icon: Calendar, label: 'Appointments' },
  { href: '/expenses', icon: CreditCard, label: 'Expenses' },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/feature-maker', icon: Megaphone, label: 'Feature Maker' },
  { href: '/admin/syslogs', icon: FileText, label: 'System Logs' },
  { href: '/admin/analytics', icon: ChartBar, label: 'Analytics' },
  { href: '/admin/nudge-engagement', icon: ChartBar, label: 'Barber Nudge Engagement' },
  { href: '/dashboard', icon: Grid, label: 'Dashboard' },
]

const ADMIN_TOOLBAR: NavItem[] = [
  { href: '/admin/documentation', icon: BookText, label: 'Documentation' },
  { href: '/admin/nudge-engagement', icon: MessageCircleReply, label: 'Nudge engagement' },
  { href: '/admin/feature-maker', icon: Megaphone, label: 'Feature maker' },
  { href: '/admin/syslogs', icon: FileText, label: 'System logs' },
  { href: '/admin/analytics', icon: ChartBar, label: 'Analytics' },
  { href: '/dashboard', icon: Grid, label: 'Dashboard' },
]

/** Square ghost icon button used across the logged-in bar */
const ICON_BTN = 'btn btn-ghost btn-sm h-9 w-9 !px-0'

/** Drawer row, matching components/Sidebar.tsx */
const drawerItemClass = (active: boolean) =>
  `relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors ${
    active ? 'bg-white/[0.06] text-ivory' : 'text-gray-400 hover:bg-white/[0.04] hover:text-ivory'
  }`

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [showFeaturesModal, setShowFeaturesModal] = useState(false)
  const [hasUnreadFeatures, setHasUnreadFeatures] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { user, profile } = useAuth()
  const userRole = profile?.role ?? null
  const pathname = usePathname()
  
  // During onboarding, only show the logo - hide all other navbar controls
  const isOnboardingOrPricing = pathname === '/pricing/return' || pathname === '/pricing' || (user && profile?.onboarded === false)
  const navRef = useRef<HTMLElement>(null)
  // Logged-in users get the slim app bar; logged-out visitors keep the marketing nav
  const isAppChrome = !!user
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  useEffect(() => {
    const updateNavbarHeight = () => {
      if (navRef.current) {
        document.documentElement.style.setProperty(
          '--navbar-height',
          `${navRef.current.offsetHeight}px`
        )
      }
    }
    updateNavbarHeight()
    window.addEventListener('resize', updateNavbarHeight)
    return () => window.removeEventListener('resize', updateNavbarHeight)
  }, [isAppChrome])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    else document.removeEventListener('mousedown', handleClickOutside)

    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    checkUnreadFeatures()
  }, [user?.id, profile?.last_read_feature_updates])

  const checkUnreadFeatures = async () => {
    if (!user?.id) {
      setHasUnreadFeatures(false)
      return
    }

    try {
      // Get most recent published feature update
      const { data: latestFeature, error: featureError } = await supabase
        .from('feature_updates')
        .select('updated_at')
        .eq('is_published', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (featureError && featureError.code !== 'PGRST116') throw featureError

      // Check if there are unread updates
      if (!latestFeature) {
        setHasUnreadFeatures(false)
        return
      }

      const lastRead = profile?.last_read_feature_updates
      const latestUpdate = latestFeature.updated_at

      setHasUnreadFeatures(!lastRead || new Date(lastRead) < new Date(latestUpdate))
    } catch (error) {
      console.error('Error checking unread features:', error)
    }
  }

  const renderDrawerLink = (item: NavItem) => {
    const Icon = item.icon
    const active = isActive(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={drawerItemClass(active)}
      >
        {active && <span className="absolute -left-3 top-2 bottom-2 w-0.5 rounded-r bg-sage" />}
        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-sage-bright' : ''}`} strokeWidth={1.75} />
        <span className="truncate">{item.label}</span>
      </Link>
    )
  }

  const renderMobileMenu = () => {
    if (!user) {
      return (
        <>
          <a
            href="/support"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
            style={{ color: COLORS.text }}
            {...hoverHighlight}
          >
            Contact Us
          </a>
          
          <Link 
            href="/login" 
            onClick={() => setOpen(false)} 
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
            style={{ color: COLORS.text }}
            {...hoverHighlight}
          >
            Sign In
          </Link>
          <Link 
            href="/signup" 
            onClick={() => setOpen(false)} 
            className="mx-4 px-4 py-3 rounded-lg font-semibold transition"
            style={{ 
              backgroundColor: COLORS.green,
              color: '#000000',
            }}
          >
            Sign Up
          </Link>
        </>
      )
    }

    if (userRole === 'Admin') {
      return <>{ADMIN_NAV.map(renderDrawerLink)}</>
    }

    return (
      <>
        {/* --- NON-ADMIN MOBILE MENU --- */}
        {BARBER_NAV.map(renderDrawerLink)}
        <button
          type="button"
          onClick={() => {
            setShowCreditsModal(true)
            setOpen(false)
          }}
          className={drawerItemClass(false)}
        >
          <Coins className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
          <span>Credits</span>
        </button>
      </>
    )
  }

  let rightSideContent

  // During onboarding, only show avatar with Sign Out option (no credits, notifications, settings)
  if (isOnboardingOrPricing) {
    rightSideContent = <UserProfile signOutOnly />
  } else if (!user) {
    rightSideContent = (
      <div className="hidden md:flex items-center gap-1.5">
        <Link href="/support" className="btn btn-ghost btn-sm">Contact us</Link>
        <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
        <ButtonLink href="/signup" size="sm" arrow className="ml-1.5">Start free trial</ButtonLink>
      </div>
    )
  } else if (userRole === 'Admin') {
    rightSideContent = (
      <>
        {/* --- ADMIN CONTENT --- */}
        <div className="hidden md:flex items-center gap-1">
          {ADMIN_TOOLBAR.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`${ICON_BTN} ${active ? '!bg-white/[0.06] !text-ivory' : ''}`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </Link>
            )
          })}
        </div>
        <span aria-hidden="true" className="mx-1.5 hidden h-6 w-px bg-white/[0.07] md:block" />
        <UserProfile />
      </>
    )
  } else {
    rightSideContent = (
      <>
        {/* --- NON-ADMIN CONTENT --- */}
        <Tooltip label="Credits">
          <button
            type="button"
            onClick={() => setShowCreditsModal(true)}
            aria-label="Credits"
            className={ICON_BTN}
          >
            <Coins className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </Tooltip>
        <NotificationsDropdown userId={user.id} />
        <span aria-hidden="true" className="mx-1.5 h-6 w-px bg-white/[0.07]" />
        <UserProfile />
      </>
    )
  }

  // Logo markup is shared by the marketing nav and the app bar; keep it unchanged
  const logo = (
    <Link 
      href="/" 
      className="flex items-center gap-0"
    >
      <img 
        src="/images/corvalogo.png" 
        alt="Corva Logo" 
        className="h-12 w-auto"
      />
      <span 
        className="text-[clamp(1.25rem,4vw,2rem)] -ml-1 font-bold bg-gradient-to-r from-[#3CE55F] via-[#2ED743] to-[#3CE55F] bg-clip-text text-transparent"
      >
        orva
      </span>
    </Link>
  )

  const drawerLogo = (
    <div className="flex items-center gap-0">
      <img 
        src="/images/corvalogo.png" 
        alt="Corva Logo" 
        className="h-10 w-auto"
      />
      <span className="text-xl -ml-1 font-bold bg-gradient-to-r from-[#3CE55F] via-[#2ED743] to-[#3CE55F] bg-clip-text text-transparent">
        orva
      </span>
    </div>
  )

  return (
    <>
      {isAppChrome ? (
        /* --- LOGGED-IN APP BAR: slim 64px charcoal bar with a bottom hairline --- */
        <nav
          ref={navRef}
          className="fixed top-0 w-full z-50 h-16 border-b border-white/[0.07] bg-canvas"
        >
          <div className="w-full h-full px-4 sm:px-6 flex justify-between items-center relative">
            {/* --- LEFT: Logo --- */}
            {logo}

            {/* --- RIGHT SIDE --- */}
            <div className="flex items-center gap-1 ml-auto">
              {rightSideContent}
              {/* Hide hamburger menu during onboarding */}
              {!isOnboardingOrPricing && (
                <button
                  type="button"
                  aria-label={open ? 'Close menu' : 'Open menu'}
                  aria-expanded={open}
                  className={`${ICON_BTN} md:hidden ml-1`}
                  onClick={() => setOpen(!open)}
                >
                  {open ? (
                    <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  ) : (
                    <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* --- MOBILE DRAWER (matches the desktop Sidebar) --- */}
          {open && (
            <>
              <div
                className="modal-backdrop md:hidden !z-40"
                onClick={() => setOpen(false)}
              />

              <div
                ref={menuRef}
                className="md:hidden fixed left-0 top-0 z-50 flex h-dvh w-72 max-w-[85vw] flex-col border-r border-white/[0.07] bg-[#11141A]"
                style={{ animation: 'slideInLeft 0.2s ease-out' }}
              >
                <style jsx>{`
                  @keyframes slideInLeft {
                    from {
                      transform: translateX(-100%);
                    }
                    to {
                      transform: translateX(0);
                    }
                  }
                `}</style>

                {/* Header */}
                <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
                  {drawerLogo}
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setOpen(false)}
                    className={ICON_BTN}
                  >
                    <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </button>
                </div>

                {/* Menu Items */}
                <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Main">
                  {renderMobileMenu()}
                </nav>

                {/* Footer */}
                <div className="shrink-0 space-y-3 border-t border-white/[0.07] px-3 py-4">
                  {userRole !== 'Admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowFeaturesModal(true)
                        setHasUnreadFeatures(false)
                        setOpen(false)
                      }}
                      className={drawerItemClass(false)}
                    >
                      <Megaphone className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                      <span>Feature updates</span>
                      {hasUnreadFeatures && (
                        <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-sage" />
                      )}
                    </button>
                  )}
                  <p className="px-3 text-[11px] text-gray-500">
                    © {new Date().getFullYear()} Corva ·{' '}
                    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">
                      Privacy
                    </a>
                  </p>
                </div>
              </div>
            </>
          )}
        </nav>
      ) : (
        /* --- LOGGED-OUT MARKETING NAV (unchanged) --- */
        <nav 
          ref={navRef}
          className="fixed top-0 w-full z-50 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_rgb(255_255_255/0.06),0_12px_32px_-20px_rgb(0_0_0/0.8)]"
          style={{
            backgroundColor: 'rgba(13, 16, 20, 0.85)',
          }}
        >
          <div className="w-full px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center relative">
            {/* --- LEFT: Logo --- */}
            {logo}

            {/* --- RIGHT SIDE --- */}
            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              {rightSideContent}
              {/* Hide hamburger menu during onboarding */}
              {!isOnboardingOrPricing && (
                <button
                  className="md:hidden p-[clamp(4px,1vw,8px)] rounded transition-colors"
                  style={{
                    backgroundColor: 'transparent',
                    color: COLORS.text,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = COLORS.surfaceSolid
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() => setOpen(!open)}
                >
                  {open ? (
                    <X className="w-[clamp(16px,4vw,24px)] h-[clamp(16px,4vw,24px)]" />
                  ) : (
                    <Menu className="w-[clamp(16px,4vw,24px)] h-[clamp(16px,4vw,24px)]" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* --- MOBILE MENU SIDEBAR --- */}
          {open && (
            <>
              {/* Backdrop */}
              <div 
                className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={() => setOpen(false)}
              />
              
              {/* Sidebar */}
              <div 
                ref={menuRef} 
                className="md:hidden fixed left-0 top-0 h-screen w-64 z-50 shadow-2xl"
                style={{
                  backgroundColor: COLORS.navBg,
                  borderRight: `1px solid rgba(61, 210, 122, 0.2)`,
                  animation: 'slideInLeft 0.3s ease-out',
                }}
              >
                <style jsx>{`
                  @keyframes slideInLeft {
                    from {
                      transform: translateX(-100%);
                    }
                    to {
                      transform: translateX(0);
                    }
                  }
                `}</style>
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  {drawerLogo}
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-lg transition-colors"
                    style={{
                      backgroundColor: 'transparent',
                      color: COLORS.text,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = COLORS.surfaceSolid
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Menu Items */}
                <div className="flex flex-col py-4 px-3 space-y-1">
                  {renderMobileMenu()}
                </div>
              </div>
            </>
          )}
        </nav>
      )}

      <CreditsModal
        isOpen={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
      />

      <NewFeaturesModal
        isOpen={showFeaturesModal}
        onClose={() => setShowFeaturesModal(false)}
        initialViewMode="barberView"
        userId={user?.id}
      />
    </>
  )
}
