/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Menu, X, Grid, UserCog, CreditCard, FileText, ChartBar, Coins } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import UserProfile from '@/components/UserProfile'
import TipsDropdown from '@/components/TipsDropdown'
import Tooltip from '@/components/Wrappers/Tooltip'
import NotificationsDropdown from '@/components/NotificationsDropdown'
import Image from 'next/image'

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

async function logNavLinkClick(user_id: string, linkName: string) {
  const { error: insertError } = await supabase
    .from('system_logs')
    .insert({
      source: user_id,
      action: `clicked_${linkName}`,
      status: 'success',
      details: `Opened navigation link: ${linkName}`,
    });

  if (insertError) throw insertError;
}

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreditsModal, setShowCreditsModal] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null)

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
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', session.user.id)
            .single()

          if (profileError) throw profileError
          setUserRole(profileData.role)
        }
      } catch (err: any) {
        console.error('Unexpected error fetching user:', err.message)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
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

  if (loading) return null

const desktopIcons = (
    <>
      <Tooltip label="Dashboard">
        <Link href="/dashboard" className="relative flex flex-col items-center group hidden md:flex">
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
            onClick={() => {logNavLinkClick(user.id, 'dashboard')}}
          >
            <Grid className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>
      </Tooltip>

      <Tooltip label="Client Manager">
        <Link href="/client-manager" className="relative flex flex-col items-center group hidden md:flex">
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
            onClick={() => {logNavLinkClick(user.id, 'client-manager')}}
          >
            <UserCog className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>
      </Tooltip>

      <Tooltip label="Expenses">
        <Link href="/expenses" className="relative flex flex-col items-center group hidden md:flex">
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
            onClick={() => {logNavLinkClick(user.id, 'expenses')}}
          >
            <CreditCard className="w-6 h-6" style={{ color: COLORS.text }} />
          </div>
        </Link>
      </Tooltip>
      
      <Tooltip label="Credits">
        <button 
          onClick={() => setShowCreditsModal(true)}
          className="relative flex flex-col items-center group hidden md:flex"
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
    </>
  )

  const renderMobileMenu = () => {
    if (!user) {
      return (
        <>
          <Link 
            href="/login" 
            onClick={() => setOpen(false)} 
            className="transition"
            style={{ color: COLORS.text }}
            onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.green }}
            onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.text }}
          >
            Sign In
          </Link>
          <Link 
            href="/signup" 
            onClick={() => setOpen(false)} 
            className="px-4 sm:px-6 py-1 sm:py-2 rounded-md font-semibold hover:scale-105 transition"
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
    }

    return (
      <>
        {/* --- NON-ADMIN MOBILE MENU --- */}
        <Link 
          href="/dashboard" 
          onClick={() => setOpen(false)} 
          className="flex items-center gap-1 sm:gap-2 transition"
          style={{ color: COLORS.text }}
          onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.green }}
          onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.text }}
        >
          <Grid className="w-[clamp(16px,4vw,20px)] h-[clamp(16px,4vw,20px)]" /> Dashboard
        </Link>
        <Link 
          href="/client-manager" 
          onClick={() => setOpen(false)} 
          className="flex items-center gap-1 sm:gap-2 transition"
          style={{ color: COLORS.text }}
          onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.green }}
          onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.text }}
        >
          <UserCog className="w-[clamp(16px,4vw,20px)] h-[clamp(16px,4vw,20px)]" /> Client Manager
        </Link>
        <Link 
          href="/expenses" 
          onClick={() => setOpen(false)} 
          className="flex items-center gap-1 sm:gap-2 transition"
          style={{ color: COLORS.text }}
          onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.green }}
          onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.text }}
        >
          <CreditCard className="w-[clamp(16px,4vw,20px)] h-[clamp(16px,4vw,20px)]" /> Expenses
        </Link>
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
        backgroundColor: `${COLORS.navBg}f0`, // 94% opacity with greenish tint
        borderBottom: `1px solid rgba(115, 170, 87, 0.2)`, // Subtle green border
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
            alt="ShearWork Logo" 
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

      {/* --- MOBILE MENU --- */}
      {open && (
        <div 
          ref={menuRef} 
          className="md:hidden w-full shadow-lg"
          style={{
            backgroundColor: COLORS.navBg,
            borderTop: `1px solid rgba(115, 170, 87, 0.2)`,
          }}
        >
          <div className="flex flex-col items-center py-2 sm:py-4 space-y-2 sm:space-y-4 text-[clamp(0.9rem,3vw,1.2rem)]">
            {renderMobileMenu()}
          </div>
        </div>
      )}
    </nav>
    <CreditsModal
      isOpen={showCreditsModal}
      onClose={() => setShowCreditsModal(false)}
    />

    </>
  )
}