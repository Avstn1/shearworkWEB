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

export default function UserProfile() {
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
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-10 h-10 rounded-full overflow-hidden bg-gradient-to-r from-amber-400/30 to-lime-500/30 border border-white/10 shadow-md hover:shadow-lg backdrop-blur-md transition-all"
      >
        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt="Avatar"
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <span className="text-white font-bold text-lg">
            {profile?.full_name?.[0]?.toUpperCase() || 'U'}
          </span>
        )}
      </motion.button>

      {/* Dropdown menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuVariants}
            ref={dropdownRef}
            className="absolute top-full right-0 mt-3 w-72 bg-[#1a1e18]/90 border border-white/10 rounded-2xl shadow-2xl p-4 z-[9999] backdrop-blur-xl origin-top-right"
            style={{
              transformOrigin: 'top right',
              maxWidth: 'calc(100vw - 1rem)', // ensures it never overflows screen width
            }}
          >
            <motion.div
              variants={itemVariants}
              className="flex flex-col items-center text-[var(--text-bright)] space-y-1"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-r from-lime-400/30 to-amber-400/30 border border-white/10 shadow-md mb-2">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-xl text-white font-bold">
                    {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              <span className="font-semibold text-lg text-amber-200">
                {profile?.full_name || 'User'}
              </span>
              <span className="text-xs text-gray-400 uppercase tracking-wide">
                {profile?.role || 'Barber'}
              </span>
              <span className="text-sm text-lime-200/80 break-words">
                {profile?.email || ''}
              </span>
            </motion.div>

            <motion.hr
              variants={itemVariants}
              className="my-3 border-white/10"
            />

            <motion.div variants={itemVariants}>
              <Link
                href="/settings"
                className="block w-full text-center py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-amber-400/30 to-lime-500/30 border border-white/10 text-white hover:shadow-md hover:scale-[1.02] transition-all"
              >
                ⚙️ Settings
              </Link>
            </motion.div>

            <motion.div variants={itemVariants}>
              <SignOutButton className="w-full bg-white/10 border border-white/10 text-white py-2 rounded-lg text-sm font-semibold hover:bg-white/20 hover:scale-[1.02] transition-all" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
