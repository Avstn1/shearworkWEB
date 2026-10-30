/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X, Grid, UserCog, CreditCard, FileText, ChartBar, Coins, Calendar, Megaphone, MessageCircleReply, BookText } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import UserProfile from '@/components/UserProfile'
import TipsDropdown from '@/components/ManageTipsButton'
import Tooltip from '@/components/Wrappers/Tooltip'
import NotificationsDropdown from '@/components/NotificationsDropdown'
import NewFeaturesModal from '@/components/Dashboard/NewFeaturesModal'
import CreditsModal from '@/components/Dashboard/CreditsModal'
import { useAuth } from '@/contexts/AuthContext'
import { ButtonLink } from '@/components/ui/Button'
import { BrandMark } from '@/components/ui/BrandMark'

// Color palette matching React Native app
const COLORS = {
  background: '#161913',
  cardBg: '#181b15',
  navBg: '#1a1d17', 
  surface: 'rgba(247, 245, 239, 0.05)',
  surfaceSolid: '#161A13',
  glassBorder: 'rgba(247, 245, 239, 0.09)',
  text: '#F4F3EC',
  textMuted: 'rgba(244, 243, 236, 0.62)',
  green: '#aab39a',
  greenLight: '#8e9a78',
  greenGlow: 'rgba(170, 179, 154, 0.4)',
}

type HoverEvent = React.MouseEvent<HTMLElement>

/** Menu links: green text + tint on hover */
const hoverHighlight = {
  onMouseEnter: (e: HoverEvent) => {
    e.currentTarget.style.color = COLORS.green
    e.currentTarget.style.backgroundColor = 'rgba(170, 179, 154, 0.1)'
  },
  onMouseLeave: (e: HoverEvent) => {
    e.currentTarget.style.color = COLORS.text
    e.currentTarget.style.backgroundColor = 'transparent'
  },
}

/** Icon buttons: surface background on hover */
const hoverSurface = {
  onMouseEnter: (e: HoverEvent) => { e.currentTarget.style.backgroundColor = COLORS.surfaceSolid },
  onMouseLeave: (e: HoverEvent) => { e.currentTarget.style.backgroundColor = 'transparent' },
}

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
  }, [])

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

  const desktopIcons = (
    <></>
  )

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
      return (
        <>
          <Link 
            href="/admin/feature-maker" 
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
            style={{ color: COLORS.text }}
            {...hoverHighlight}
          >
            <Megaphone className="w-5 h-5" />
            <span>Feature Maker</span>
          </Link>
          
          <Link 
            href="/admin/syslogs" 
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
            style={{ color: COLORS.text }}
            {...hoverHighlight}
          >
            <FileText className="w-5 h-5" />
            <span>System Logs</span>
          </Link>

          <Link 
            href="/admin/analytics" 
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
            style={{ color: COLORS.text }}
            {...hoverHighlight}
          >
            <ChartBar className="w-5 h-5" />
            <span>Analytics</span>
          </Link>

          <Link 
            href="/admin/nudge-engagement" 
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
            style={{ color: COLORS.text }}
            {...hoverHighlight}
          >
            <ChartBar className="w-5 h-5" />
            <span>Barber Nudge Engagement</span>
          </Link>
          

          <Link 
            href="/dashboard" 
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
            style={{ color: COLORS.text }}
            {...hoverHighlight}
          >
            <Grid className="w-5 h-5" />
            <span>Dashboard</span>
          </Link>
        </>
      )
    }

    return (
      <>
        {/* --- NON-ADMIN MOBILE MENU --- */}
        <Link 
          href="/dashboard" 
          onClick={() => setOpen(false)} 
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
          style={{ color: COLORS.text }}
          {...hoverHighlight}
        >
          <Grid className="w-5 h-5" /> 
          <span>Dashboard</span>
        </Link>
        <Link 
          href="/analytics" 
          onClick={() => setOpen(false)} 
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
          style={{ color: COLORS.text }}
          {...hoverHighlight}
        >
          <ChartBar className="w-5 h-5" /> 
          <span>Analytics</span>
        </Link>
        <Link 
          href="/client-manager" 
          onClick={() => setOpen(false)} 
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
          style={{ color: COLORS.text }}
          {...hoverHighlight}
        >
          <UserCog className="w-5 h-5" /> 
          <span>Client Manager</span>
        </Link>
        <Link 
          href="/appointment-manager" 
          onClick={() => setOpen(false)} 
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
          style={{ color: COLORS.text }}
          {...hoverHighlight}
        >
          <Calendar className="w-5 h-5" /> 
          <span>Appointment Manager</span>
        </Link>
        <Link 
          href="/expenses" 
          onClick={() => setOpen(false)} 
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
          style={{ color: COLORS.text }}
          {...hoverHighlight}
        >
          <CreditCard className="w-5 h-5" /> 
          <span>Expenses</span>
        </Link>
        <button 
          onClick={() => {
            setShowCreditsModal(true)
            setOpen(false)
          }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full text-left"
          style={{ color: COLORS.text }}
          {...hoverHighlight}
        >
          <Coins className="w-5 h-5" /> 
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
        <Link href="/admin/documentation" className="relative flex flex-col items-center group hidden md:flex">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'transparent' }}
            {...hoverSurface}
          >
            <BookText className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>

        <Link href="/admin/nudge-engagement" className="relative flex flex-col items-center group hidden md:flex">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'transparent' }}
            {...hoverSurface}
          >
            <MessageCircleReply className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>
          
        <Link href="/admin/feature-maker" className="relative flex flex-col items-center group hidden md:flex">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'transparent' }}
            {...hoverSurface}
          >
            <Megaphone className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>

        <Link href="/admin/syslogs" className="relative flex flex-col items-center group hidden md:flex">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'transparent' }}
            {...hoverSurface}
          >
            <FileText className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>

        <Link href="/admin/analytics" className="relative flex flex-col items-center group hidden md:flex">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'transparent' }}
            {...hoverSurface}
          >
            <ChartBar className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>
        
        <Link href="/dashboard" className="relative flex flex-col items-center group hidden md:flex">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'transparent' }}
            {...hoverSurface}
          >
            <Grid className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>

        <UserProfile />
      </>
    )
  } else {
    rightSideContent = (
      <>
        {/* --- NON-ADMIN CONTENT --- */}
        {desktopIcons}
        <Tooltip label="Credits">
          <button 
            onClick={() => setShowCreditsModal(true)}
            className="relative flex flex-col items-center group"
          >
            <div 
              className="p-2 rounded-full transition-colors"
              style={{
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = COLORS.surfaceSolid
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <Coins className="w-6 h-6" style={{ color: COLORS.text }} />
            </div>
          </button>
        </Tooltip>
        <NotificationsDropdown userId={user.id} />
        <UserProfile />
      </>
    )
  }

  return (
    <>
      <nav 
        ref={navRef}
        className="fixed top-0 w-full z-50 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_rgb(247_245_239/0.06),0_12px_32px_-20px_rgb(0_0_0/0.8)]"
        style={{
          backgroundColor: 'rgba(14, 17, 12, 0.72)',
        }}
      >
        <div className="w-full px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center relative">
          {/* --- LEFT: Logo --- */}
          <Link 
            href="/" 
            className="flex items-center gap-0"
          >
            <BrandMark className="h-9 w-9 text-sage-bright drop-shadow-[0_0_14px_rgb(170_179_154/0.45)]" />
            <span className="sr-only">Corva</span>
            <span
              aria-hidden="true"
              className="text-[clamp(1.25rem,4vw,1.65rem)] -ml-0.5 font-semibold tracking-tight bg-gradient-to-r from-ivory via-sage-bright to-sage bg-clip-text text-transparent"
            >
              orva
            </span>
          </Link>

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
                borderRight: `1px solid rgba(170, 179, 154, 0.2)`,
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
                <div className="flex items-center gap-0">
                  <BrandMark className="h-8 w-8 text-sage-bright drop-shadow-[0_0_12px_rgb(170_179_154/0.45)]" />
                  <span className="text-xl -ml-0.5 font-semibold tracking-tight bg-gradient-to-r from-ivory via-sage-bright to-sage bg-clip-text text-transparent">
                    orva
                  </span>
                </div>
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

      <CreditsModal
        isOpen={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
      />
    </>
  )
}
