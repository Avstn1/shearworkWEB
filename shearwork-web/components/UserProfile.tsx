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
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    <div className="relative flex items-center">
      <div ref={dropdownRef} className="relative group">
        {/* Avatar Button */}
        <motion.button
          whileHover={{ scale: 1.15, rotate: 5, boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}
          className="rounded-full focus:outline-none p-1"
          onClick={() => setOpen(!open)}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt="Avatar"
              className="w-10 h-10 rounded-full cursor-pointer hover:ring-2 hover:ring-[var(--accent-2)] transition"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[var(--accent-2)] flex items-center justify-center text-[var(--text-bright)] font-bold cursor-pointer hover:ring-2 hover:ring-[var(--accent-3)] transition">
              {profile?.full_name?.[0] || 'U'}
            </div>
          )}
        </motion.button>

        {/* Hover popup text */}
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          whileHover={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-sm text-white bg-black/85 backdrop-blur-sm border border-black/50 px-3 py-1 rounded-lg whitespace-nowrap shadow-lg pointer-events-none"
        >
          Profile
        </motion.span>

        {/* Dropdown menu */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial="closed"
              animate="open"
              exit="closed"
              variants={menuVariants}
              className="absolute right-0 mt-3 w-64 bg-black/90 backdrop-blur-sm border border-black/60 rounded-2xl shadow-2xl z-50 p-4 flex flex-col space-y-4"
            >
              <motion.div
                variants={itemVariants}
                className="flex flex-col text-[var(--foreground)]"
              >
                <span className="font-semibold text-lg text-[var(--accent-3)]">{profile?.full_name || 'User'}</span>
                <span className="text-[var(--text-muted)] text-sm">{profile?.role || 'Barber'}</span>
                <span className="text-[var(--text-muted)] text-sm break-words">{profile?.email || ''}</span>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Link
                  href="/settings"
                  className="block bg-[var(--accent-2)] hover:bg-[var(--accent-3)] text-[var(--text-bright)] font-semibold py-2 px-3 rounded-lg text-center transition transform hover:scale-105 shadow-md"
                >
                  Settings
                </Link>
              </motion.div>

              <motion.div variants={itemVariants}>
                <SignOutButton className="w-full transform hover:scale-105" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.15s ease-out; }
      `}</style>
    </div>
  )
}
