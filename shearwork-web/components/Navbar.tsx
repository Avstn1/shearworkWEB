/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Menu, X, Grid, UserCog, CreditCard, FileText, ChartBar } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import UserProfile from '@/components/UserProfile'
import TipsDropdown from '@/components/TipsDropdown'
import Tooltip from '@/components/Wrappers/Tooltip'
import NotificationsDropdown from '@/components/NotificationsDropdown'

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
  const menuRef = useRef<HTMLDivElement>(null)
  
  const [reportToOpen, setReportToOpen] = useState<{id: string, type: string} | null>(null)
  
  const handleOpenReport = (reportId: string, reportType: string) => {
    setReportToOpen({ id: reportId, type: reportType })
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
          <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors" onClick={() => {logNavLinkClick(user.id, 'expenses')}}>
            <Grid className="w-6 h-6 text-[var(--foreground)]" />
          </div>
        </Link>
      </Tooltip>
      <Tooltip label="User Editor">
        <Link href="/user-editor" className="relative flex flex-col items-center group hidden md:flex">
          <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors" onClick={() => {logNavLinkClick(user.id, 'expenses')}}>
            <UserCog className="w-6 h-6 text-[var(--foreground)]" />
          </div>
        </Link>
      </Tooltip>
      <Tooltip label="Expenses">
        <Link href="/expenses" className="relative flex flex-col items-center group hidden md:flex">
          <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors" onClick={() => {logNavLinkClick(user.id, 'expenses')}}>
            <CreditCard className="w-6 h-6 text-[var(--foreground)]" />
          </div>
        </Link>
      </Tooltip>
    </>
  )

  const renderMobileMenu = () => {
    if (!user) {
      return (
        <>
          <a href="#features" onClick={() => setOpen(false)} className="hover:text-[var(--highlight)] transition">Features</a>
          <a href="#pricing" onClick={() => setOpen(false)} className="hover:text-[var(--highlight)] transition">Pricing</a>
          <a href="#contact" onClick={() => setOpen(false)} className="hover:text-[var(--highlight)] transition">Contact</a>
          <Link href="/login" onClick={() => setOpen(false)} className="hover:text-[var(--highlight)] transition">Sign In</Link>
          <Link href="/signup" onClick={() => setOpen(false)} className="bg-[var(--highlight)] px-4 sm:px-6 py-1 sm:py-2 rounded-md text-[var(--accent-4)] font-semibold hover:scale-105 transition">Sign Up</Link>
        </>
      )
    }

    if (userRole === 'Admin') {
      return (
        <>
          <Link href="/admin/syslogs" className="relative flex flex-col items-center group hidden md:flex">
            <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors">
              <FileText className="w-6 h-6 text-[var(--foreground)]" />
            </div>
          </Link>

          <Link href="/admin/analytics" className="relative flex flex-col items-center group hidden md:flex">
            <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors">
              <ChartBar className="w-6 h-6 text-[var(--foreground)]" />
            </div>
          </Link>

          <Link href="/dashboard" className="relative flex flex-col items-center group hidden md:flex">
            <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors">
              <Grid className="w-6 h-6 text-[var(--foreground)]" />
            </div>
          </Link>

          <UserProfile />
        </>
      )
    }

    return (
      <>
        {/* --- NON-ADMIN MOBILE MENU --- */}
        <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-1 sm:gap-2 hover:text-[var(--highlight)] transition">
          <Grid className="w-[clamp(16px,4vw,20px)] h-[clamp(16px,4vw,20px)]" /> Dashboard
        </Link>
        <Link href="/user-editor" onClick={() => setOpen(false)} className="flex items-center gap-1 sm:gap-2 hover:text-[var(--highlight)] transition">
          <UserCog className="w-[clamp(16px,4vw,20px)] h-[clamp(16px,4vw,20px)]" /> User Editor
        </Link>
        <Link href="/expenses" onClick={() => setOpen(false)} className="flex items-center gap-1 sm:gap-2 hover:text-[var(--highlight)] transition">
          <CreditCard className="w-[clamp(16px,4vw,20px)] h-[clamp(16px,4vw,20px)]" /> Expenses
        </Link>
      </>
    )
  }

  let rightSideContent

  if (!user) {
    rightSideContent = (
      <div className="hidden md:flex items-center gap-4 text-[clamp(0.8rem,2vw,1rem)]">
        <Link href="/login" className="hover:text-[var(--highlight)] transition font-medium">Sign In</Link>
        <Link href="/signup" className="bg-[var(--highlight)] text-[var(--accent-4)] px-4 sm:px-5 py-1 sm:py-2 rounded-md font-semibold hover:scale-105 transition">Sign Up</Link>
      </div>
    )
  } else if (userRole === 'Admin') {
    rightSideContent = (
      <>
        {/* --- ADMIN CONTENT --- */}
        <Link href="/admin/syslogs" className="relative flex flex-col items-center group hidden md:flex">
          <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors">
            <FileText className="w-6 h-6 text-[var(--foreground)]" />
          </div>
        </Link>

        <Link href="/admin/analytics" className="relative flex flex-col items-center group hidden md:flex">
          <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors">
            <ChartBar className="w-6 h-6 text-[var(--foreground)]" />
          </div>
        </Link>
        <Link href="/dashboard" className="relative flex flex-col items-center group hidden md:flex">
          <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors">
            <Grid className="w-6 h-6 text-[var(--foreground)]" />
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
        {/* <NotificationsDropdown userId={user.id} /> */}
        <NotificationsDropdown 
          userId={user.id}
          onOpenReport={handleOpenReport}
        />
        {/* <TipsDropdown barberId={user.id} /> */}
        <UserProfile />
      </>
    )
  }

  return (
    <nav className="fixed top-0 w-full z-50 bg-[var(--navbar)]/90 backdrop-blur-md shadow-sm">
      <div className="w-full px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center relative">
        {/* --- LEFT: Logo --- */}
        <Link href="/" className="text-[clamp(1.25rem,4vw,2rem)] font-bold text-[var(--highlight)]">
          ✂️ ShearWork
        </Link>

        {/* --- CENTER: Links (only when signed out) --- */}
        {!user && (
          <div className="hidden md:flex gap-6 text-[var(--foreground)] absolute left-1/2 -translate-x-1/2 text-[clamp(0.8rem,2vw,1rem)]">
            <a href="#features" className="hover:text-[var(--highlight)]">Features</a>
            <a href="#pricing" className="hover:text-[var(--highlight)]">Pricing</a>
            <a href="#contact" className="hover:text-[var(--highlight)]">Contact</a>
          </div>
        )}

        {/* --- RIGHT SIDE --- */}
        <div className="flex items-center gap-2 sm:gap-4 ml-auto">
          {rightSideContent}
          <button
            className="md:hidden p-[clamp(4px,1vw,8px)] rounded hover:bg-[var(--highlight)] transition-colors"
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
        <div ref={menuRef} className="md:hidden bg-[var(--background)] border-t border-[var(--accent-2)] w-full shadow-lg">
          <div className="flex flex-col items-center py-2 sm:py-4 space-y-2 sm:space-y-4 text-[clamp(0.9rem,3vw,1.2rem)]">
            {renderMobileMenu()}
          </div>
        </div>
      )}
    </nav>
  )
}
