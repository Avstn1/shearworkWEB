'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
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
      if (userError || !user) {
        console.error('Error fetching user:', userError?.message)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, role')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error.message)
      } else {
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

  return (
    <div className="flex items-center space-x-3 relative">
      <span className="text-[var(--accent-3)] font-semibold">
        {profile?.full_name || 'User'}
      </span>

      <div className="relative" ref={dropdownRef}>
        <button
          className="rounded-full focus:outline-none"
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
        </button>

        {open && (
          <div className="absolute right-0 mt-3 w-64 bg-[var(--accent-1)] border border-[var(--accent-2)]/50 rounded-2xl shadow-lg z-50 p-4 flex flex-col space-y-4 animate-fadeIn">
            {/* Profile Info */}
            <div className="flex flex-col text-[var(--foreground)]">
              <span className="font-semibold text-lg text-[var(--accent-3)]">
                {profile?.full_name || 'User'}
              </span>
              <span className="text-[var(--text-muted)] text-sm">{profile?.role || 'Barber'}</span>
              <span className="text-[var(--text-muted)] text-sm break-words">
                {profile?.email || ''}
              </span>
            </div>

            {/* Settings Link */}
            <Link
              href="/settings"
              className="bg-[var(--accent-2)] hover:bg-[var(--accent-3)] text-[var(--text-bright)] font-semibold py-2 px-3 rounded-lg text-center transition"
            >
              Settings
            </Link>

            {/* Sign Out Button (already themed) */}
            <SignOutButton className="w-full" />
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.15s ease-out;
        }
      `}</style>
    </div>
  )
}
