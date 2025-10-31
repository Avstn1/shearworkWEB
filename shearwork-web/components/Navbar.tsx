'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import UserProfile from '@/components/UserProfile'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      try {
        // ✅ Use getSession instead of getUser to avoid "Auth session missing!" errors
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Error fetching session:', sessionError.message)
          setUser(null)
        } else if (!session) {
          console.warn('No active Supabase session found.')
          setUser(null)
        } else {
          setUser(session.user)
        }
      } catch (err: any) {
        console.error('Unexpected error fetching user:', err.message)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // ✅ Listen for auth changes (login/logout)
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  if (loading) return null

  return (
    <nav className="fixed top-0 w-full z-50 bg-[var(--navbar)]/90 backdrop-blur-md shadow-sm">
      {/* Tighter horizontal spacing so logo and profile hug edges */}
      <div className="w-full px-4 py-4 flex justify-between items-center">
        {/* --- LEFT: Logo --- */}
        <Link href="/" className="text-2xl font-bold text-[var(--accent-3)]">
          ✂️ ShearWork
        </Link>

        {/* --- WHEN USER IS LOGGED OUT --- */}
        {!user && (
          <>
            {/* Desktop Links */}
            <div className="hidden md:flex gap-8 text-[var(--foreground)]">
              <a href="#features" className="hover:text-[var(--highlight)]">Features</a>
              <a href="#pricing" className="hover:text-[var(--highlight)]">Pricing</a>
              <a href="#contact" className="hover:text-[var(--highlight)]">Contact</a>
            </div>

            {/* Desktop Auth Buttons */}
            <div className="hidden md:flex gap-3">
              <Link
                href="/login"
                className="px-4 py-2 rounded-md border border-[var(--accent-2)] text-[var(--accent-3)] hover:bg-[var(--accent-2)] hover:text-[var(--text-bright)] transition"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded-md bg-[var(--highlight)] text-[var(--accent-4)] font-semibold hover:scale-105 transition"
              >
                Sign Up
              </Link>
            </div>
          </>
        )}

        {/* --- WHEN USER IS LOGGED IN --- */}
        {user && (
          <div className="hidden md:flex items-center gap-6 ml-auto">
            <Link
              href="/dashboard"
              className="text-[var(--foreground)] hover:text-[var(--highlight)] font-medium"
            >
              Dashboard
            </Link>
            <div className="flex-shrink-0">
              <UserProfile />
            </div>
          </div>
        )}

        {/* Mobile menu button */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {/* --- MOBILE MENU --- */}
      {open && (
        <div className="md:hidden bg-[var(--background)] border-t border-[var(--accent-2)]">
          <div className="flex flex-col items-center py-4 space-y-4">
            {!user ? (
              <>
                <a href="#features" onClick={() => setOpen(false)}>Features</a>
                <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
                <a href="#contact" onClick={() => setOpen(false)}>Contact</a>
                <Link href="/login" onClick={() => setOpen(false)}>Sign In</Link>
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="bg-[var(--highlight)] px-4 py-2 rounded-md text-[var(--accent-4)]"
                >
                  Sign Up
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link>
                <div className="w-full flex justify-center">
                  <UserProfile />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
