'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/utils/supabaseClient'
import SignOutButton from './SignOutButton'

interface ProfileData {
  full_name: string
  avatar_url: string
  role: string
  email: string
}

interface UserProfileProps {
  /** When true, only shows Sign Out button (hides Settings link) - used during onboarding */
  signOutOnly?: boolean
}

export default function UserProfile({ signOutOnly = false }: UserProfileProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const className = 'tutorial-hide-profile'
    if (open) {
      document.body.classList.add(className)
    } else {
      document.body.classList.remove(className)
    }

    return () => {
      document.body.classList.remove(className)
    }
  }, [open])

  // 🔹 Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 🔹 Fetch profile info
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, role')
        .eq('user_id', user.id)
        .single()

      if (!error && data) {
        setProfile({
          full_name: data.full_name,
          avatar_url: data.avatar_url,
          role: data.role,
          email: user.email ?? '',
        })
      }
    }

    fetchProfile()
  }, [])

  const menuVariants = {
    open: { opacity: 1, y: 0, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
    closed: { opacity: 0, y: -10, transition: { staggerChildren: 0.05, staggerDirection: -1 } },
  }

  const itemVariants = {
    open: { opacity: 1, y: 0 },
    closed: { opacity: 0, y: -10 },
  }

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      {/* Avatar button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Account menu"
        className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/[0.12] bg-raised transition-colors hover:border-white/[0.2]"
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Avatar"
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <span className="text-sm font-semibold text-ivory">
            {profile?.full_name?.[0]?.toUpperCase() || 'U'}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuVariants}
            ref={dropdownRef}
            className="modal-surface absolute top-full right-0 z-[9999] mt-2 w-72 origin-top-right p-4"
            style={{
              transformOrigin: 'top right',
              maxWidth: 'calc(100vw - 1rem)', // ensures it never overflows screen width
            }}
          >
            <motion.div
              variants={itemVariants}
              className="flex flex-col items-center space-y-1 text-ivory"
            >
              <div className="mb-2 h-14 w-14 overflow-hidden rounded-full border border-white/[0.12] bg-raised">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-ivory">
                    {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              <span className="text-[15px] font-semibold text-ivory">
                {profile?.full_name || 'User'}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {profile?.role || 'Barber'}
              </span>
              <span className="break-words text-[13px] text-gray-400">
                {profile?.email || ''}
              </span>
            </motion.div>

            <motion.hr
              variants={itemVariants}
              className="my-3 border-white/[0.07]"
            />

            {/* Hide Settings link during onboarding (signOutOnly mode) */}
            {!signOutOnly && (
              <motion.div variants={itemVariants}>
                <Link
                  href="/settings"
                  className="btn btn-glass btn-sm mb-2 w-full"
                >
                  Settings
                </Link>
              </motion.div>
            )}

            <motion.div variants={itemVariants}>
              <SignOutButton className="w-full" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
