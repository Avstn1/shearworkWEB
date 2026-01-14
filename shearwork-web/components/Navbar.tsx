/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Menu, X, Grid, UserCog, CreditCard, FileText, ChartBar, Coins, Calendar, Megaphone } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import UserProfile from '@/components/UserProfile'
import TipsDropdown from '@/components/ManageTipsButton'
import Tooltip from '@/components/Wrappers/Tooltip'
import NotificationsDropdown from '@/components/NotificationsDropdown'
import NewFeaturesModal from '@/components/Dashboard/NewFeaturesModal'
import CreditsModal from '@/components/Dashboard/CreditsModal'

// Color palette matching React Native app
const COLORS = {
  background: '#181818',
  cardBg: '#1a1a1a',
  navBg: '#1b1d1b', 
  surface: 'rgba(37, 37, 37, 0.6)',
  surfaceSolid: '#252525',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.6)',
  green: '#73aa57',
  greenLight: '#5b8f52',
  greenGlow: 'rgba(115, 170, 87, 0.4)',
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [showFeaturesModal, setShowFeaturesModal] = useState(false)
  const [hasUnreadFeatures, setHasUnreadFeatures] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch user role helper
  const fetchUserRole = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .single()

      if (profileError) throw profileError
      setUserRole(profileData.role)
    } catch (err: any) {
      console.error('Error fetching user role:', err.message)
    }
  }

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Error fetching session:', sessionError.message)
          setUser(null)
          return
        }

        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchUserRole(session.user.id)
        }
      } catch (err: any) {
        console.error('Unexpected error fetching user:', err.message)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session?.user || null)
        
        // Fetch role when signing in
        if (session?.user) {
          await fetchUserRole(session.user.id)
        }
      }
      
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setUserRole(null)
      }
    })

    return () => subscription.subscription.unsubscribe()
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
  }, [user])

  useEffect(() => {
    if (hasUnreadFeatures && user?.id) {
      setShowFeaturesModal(true)
    }

    checkUnreadFeatures()
  }, [hasUnreadFeatures, user?.id])

  const checkUnreadFeatures = async () => {
    if (!user?.id) return

    try {
      // Get user's last read timestamp
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('last_read_feature_updates')
        .eq('user_id', user.id)
        .single()

      if (profileError) throw profileError

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

      const lastRead = profileData?.last_read_feature_updates
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
          <Link 
            href="/login" 
            onClick={() => setOpen(false)} 
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
            style={{ color: COLORS.text }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.color = COLORS.green
              e.currentTarget.style.backgroundColor = 'rgba(115, 170, 87, 0.1)'
            }}
            onMouseLeave={(e) => { 
              e.currentTarget.style.color = COLORS.text
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
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
            onMouseEnter={(e) => { 
              e.currentTarget.style.color = COLORS.green
              e.currentTarget.style.backgroundColor = 'rgba(115, 170, 87, 0.1)'
            }}
            onMouseLeave={(e) => { 
              e.currentTarget.style.color = COLORS.text
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Megaphone className="w-5 h-5" />
            <span>Feature Maker</span>
          </Link>
          
          <Link 
            href="/admin/syslogs" 
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
            style={{ color: COLORS.text }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.color = COLORS.green
              e.currentTarget.style.backgroundColor = 'rgba(115, 170, 87, 0.1)'
            }}
            onMouseLeave={(e) => { 
              e.currentTarget.style.color = COLORS.text
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <FileText className="w-5 h-5" />
            <span>System Logs</span>
          </Link>

          <Link 
            href="/admin/analytics" 
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
            style={{ color: COLORS.text }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.color = COLORS.green
              e.currentTarget.style.backgroundColor = 'rgba(115, 170, 87, 0.1)'
            }}
            onMouseLeave={(e) => { 
              e.currentTarget.style.color = COLORS.text
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <ChartBar className="w-5 h-5" />
            <span>Analytics</span>
          </Link>

          <Link 
            href="/dashboard" 
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
            style={{ color: COLORS.text }}
            onMouseEnter={(e) => { 
              e.currentTarget.style.color = COLORS.green
              e.currentTarget.style.backgroundColor = 'rgba(115, 170, 87, 0.1)'
            }}
            onMouseLeave={(e) => { 
              e.currentTarget.style.color = COLORS.text
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
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
          onMouseEnter={(e) => { 
            e.currentTarget.style.color = COLORS.green
            e.currentTarget.style.backgroundColor = 'rgba(115, 170, 87, 0.1)'
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.color = COLORS.text
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <Grid className="w-5 h-5" /> 
          <span>Dashboard</span>
        </Link>
        <Link 
          href="/client-manager" 
          onClick={() => setOpen(false)} 
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
          style={{ color: COLORS.text }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.color = COLORS.green
            e.currentTarget.style.backgroundColor = 'rgba(115, 170, 87, 0.1)'
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.color = COLORS.text
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <UserCog className="w-5 h-5" /> 
          <span>Client Manager</span>
        </Link>
        <Link 
          href="/appointment-manager" 
          onClick={() => setOpen(false)} 
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
          style={{ color: COLORS.text }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.color = COLORS.green
            e.currentTarget.style.backgroundColor = 'rgba(115, 170, 87, 0.1)'
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.color = COLORS.text
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <Calendar className="w-5 h-5" /> 
          <span>Appointment Manager</span>
        </Link>
        <Link 
          href="/expenses" 
          onClick={() => setOpen(false)} 
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition w-full"
          style={{ color: COLORS.text }}
          onMouseEnter={(e) => { 
            e.currentTarget.style.color = COLORS.green
            e.currentTarget.style.backgroundColor = 'rgba(115, 170, 87, 0.1)'
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.color = COLORS.text
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
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
          onMouseEnter={(e) => { 
            e.currentTarget.style.color = COLORS.green
            e.currentTarget.style.backgroundColor = 'rgba(115, 170, 87, 0.1)'
          }}
          onMouseLeave={(e) => { 
            e.currentTarget.style.color = COLORS.text
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <Coins className="w-5 h-5" /> 
          <span>Credits</span>
        </button>
      </>
    )
  }

  let rightSideContent

  if (!user) {
    rightSideContent = (
      <div className="hidden md:flex items-center gap-4 text-[clamp(0.8rem,2vw,1rem)]">
        <Link 
          href="/login" 
          className="transition font-medium"
          style={{ color: COLORS.text }}
          onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.green }}
          onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.text }}
        >
          Sign In
        </Link>
        <Link 
          href="/signup" 
          className="px-4 sm:px-5 py-1 sm:py-2 rounded-md font-semibold hover:scale-105 transition"
          style={{ 
            backgroundColor: COLORS.green,
            color: '#000000',
          }}
        >
          Sign Up
        </Link>
      </div>
    )
  } else if (userRole === 'Admin') {
    rightSideContent = (
      <>
        {/* --- ADMIN CONTENT --- */}
        <Link href="/admin/feature-maker" className="relative flex flex-col items-center group hidden md:flex">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.surfaceSolid }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <Megaphone className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>

        <Link href="/admin/syslogs" className="relative flex flex-col items-center group hidden md:flex">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.surfaceSolid }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <FileText className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>

        <Link href="/admin/analytics" className="relative flex flex-col items-center group hidden md:flex">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.surfaceSolid }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <ChartBar className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>
        
        <Link href="/dashboard" className="relative flex flex-col items-center group hidden md:flex">
          <div 
            className="p-2 rounded-full transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.surfaceSolid }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
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
        className="fixed top-0 w-full z-50 backdrop-blur-md shadow-sm"
        style={{
          backgroundColor: `${COLORS.navBg}f0`,
          borderBottom: `1px solid rgba(115, 170, 87, 0.2)`,
        }}
      >
        <div className="w-full px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center relative">
          {/* --- LEFT: Logo --- */}
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

          {/* --- RIGHT SIDE --- */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            {rightSideContent}
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
                borderRight: `1px solid rgba(115, 170, 87, 0.2)`,
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
                  <img 
                    src="/images/corvalogo.png" 
                    alt="Corva Logo" 
                    className="h-10 w-auto"
                  />
                  <span className="text-xl -ml-1 font-bold bg-gradient-to-r from-[#3CE55F] via-[#2ED743] to-[#3CE55F] bg-clip-text text-transparent">
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