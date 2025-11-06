'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { Menu, X, Grid, UserCog, CreditCard } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import UserProfile from '@/components/UserProfile'
import TipsDropdown from '@/components/TipsDropdown'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
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
        } else {
          setUser(session?.user ?? null)
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

  // Close mobile menu when clicking outside
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
      <Link href="/dashboard" className="relative flex flex-col items-center group hidden md:flex">
        <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors">
          <Grid className="w-6 h-6 text-[var(--foreground)]" />
        </div>
      </Link>
      <Link href="/user-editor" className="relative flex flex-col items-center group hidden md:flex">
        <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors">
          <UserCog className="w-6 h-6 text-[var(--foreground)]" />
        </div>
      </Link>
      <Link href="/expenses" className="relative flex flex-col items-center group hidden md:flex">
        <div className="p-2 rounded-full hover:bg-[var(--highlight)] transition-colors">
          <CreditCard className="w-6 h-6 text-[var(--foreground)]" />
        </div>
      </Link>
    </>
  )

  return (
    <nav className="fixed top-0 w-full z-50 bg-[var(--navbar)]/90 backdrop-blur-md shadow-sm">
      <div className="w-full px-6 py-4 flex justify-between items-center relative">
        {/* --- LEFT: Logo --- */}
        <Link href="/" className="text-2xl font-bold text-[var(--highlight)]">
          ✂️ ShearWork
        </Link>

        {/* --- CENTER: Links (only when signed out) --- */}
        {!user && (
          <div className="hidden md:flex gap-8 text-[var(--foreground)] absolute left-1/2 -translate-x-1/2">
            <a href="#features" className="hover:text-[var(--highlight)]">Features</a>
            <a href="#pricing" className="hover:text-[var(--highlight)]">Pricing</a>
            <a href="#contact" className="hover:text-[var(--highlight)]">Contact</a>
          </div>
        )}

        {/* --- RIGHT SIDE --- */}
        <div className="flex items-center gap-4 ml-auto">
          {user ? (
            <>
              {desktopIcons}
              <TipsDropdown barberId={user.id} />
              <UserProfile />
              <button
                className="md:hidden p-2 rounded hover:bg-[var(--highlight)] transition-colors"
                onClick={() => setOpen(!open)}
              >
                {open ? <X /> : <Menu />}
              </button>
            </>
          ) : (
            <>
              {/* Sign In / Sign Up (right side desktop) */}
              <div className="hidden md:flex items-center gap-4">
                <Link
                  href="/login"
                  className="hover:text-[var(--highlight)] transition font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="bg-[var(--highlight)] text-[var(--accent-4)] px-5 py-2 rounded-md font-semibold hover:scale-105 transition"
                >
                  Sign Up
                </Link>
              </div>

              {/* Mobile menu toggle */}
              <button
                className="md:hidden p-2 rounded hover:bg-[var(--highlight)] transition-colors"
                onClick={() => setOpen(!open)}
              >
                {open ? <X /> : <Menu />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* --- MOBILE MENU --- */}
      {open && (
        <div
          ref={menuRef}
          className="md:hidden bg-[var(--background)] border-t border-[var(--accent-2)] w-full shadow-lg"
        >
          <div className="flex flex-col items-center py-4 space-y-4">
            {!user ? (
              <>
                <a href="#features" onClick={() => setOpen(false)} className="text-lg hover:text-[var(--highlight)] transition">Features</a>
                <a href="#pricing" onClick={() => setOpen(false)} className="text-lg hover:text-[var(--highlight)] transition">Pricing</a>
                <a href="#contact" onClick={() => setOpen(false)} className="text-lg hover:text-[var(--highlight)] transition">Contact</a>
                <Link href="/login" onClick={() => setOpen(false)} className="text-lg hover:text-[var(--highlight)] transition">Sign In</Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="text-lg bg-[var(--highlight)] px-6 py-2 rounded-md text-[var(--accent-4)] font-semibold hover:scale-105 transition">Sign Up</Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 text-lg hover:text-[var(--highlight)] transition">
                  <Grid className="w-6 h-6" /> Dashboard
                </Link>
                <Link href="/user-editor" onClick={() => setOpen(false)} className="flex items-center gap-2 text-lg hover:text-[var(--highlight)] transition">
                  <UserCog className="w-6 h-6" /> User Editor
                </Link>
                <Link href="/expenses" onClick={() => setOpen(false)} className="flex items-center gap-2 text-lg hover:text-[var(--highlight)] transition">
                  <CreditCard className="w-6 h-6" /> Expenses
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
