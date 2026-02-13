'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import EditableAvatar from '@/components/EditableAvatar'
import { supabase } from '@/utils/supabaseClient'

interface ProfileStepProps {
  fullName: string
  setFullName: (value: string) => void
  phoneNumber: string
  setPhoneNumber: (value: string) => void
  userType: 'barber' | 'owner' | ''
  setUserType: (value: 'barber' | 'owner' | '') => void
  selectedRole: { label: string; role: string; barber_type: string }
  setSelectedRole: (value: { label: string; role: string; barber_type: string }) => void
  commissionRate: number | ''
  setCommissionRate: (value: number | '') => void
  username: string
  setUsername: (value: string) => void
  usernameStatus: 'idle' | 'checking' | 'available' | 'taken'
  setUsernameStatus: (value: 'idle' | 'checking' | 'available' | 'taken') => void
  bookingLink: string
  setBookingLink: (value: string) => void
  avatarFile: File | null
  setAvatarFile: (file: File | null) => void
  avatarPreview: string | undefined
  setAvatarPreview: (url: string | undefined) => void
  showValidationErrors: boolean
  isProfileValid: boolean
  isCommissionValid: boolean
  isUsernameValid: boolean
  isPhoneNumberValid: boolean
  isBookingLinkValid: boolean
  onNext: () => void
}

export default function ProfileStep({
  fullName,
  setFullName,
  phoneNumber,
  setPhoneNumber,
  userType,
  setUserType,
  selectedRole,
  setSelectedRole,
  commissionRate,
  setCommissionRate,
  username,
  setUsername,
  usernameStatus,
  setUsernameStatus,
  bookingLink,
  setBookingLink,
  avatarFile,
  setAvatarFile,
  avatarPreview,
  setAvatarPreview,
  showValidationErrors,
  isProfileValid,
  isCommissionValid,
  isUsernameValid,
  isPhoneNumberValid,
  isBookingLinkValid,
  onNext,
}: ProfileStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout>()

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '')
    const limited = cleaned.slice(0, 10)
    
    if (limited.length <= 3) {
      return limited
    } else if (limited.length <= 6) {
      return `(${limited.slice(0, 3)}) ${limited.slice(3)}`
    } else {
      return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhoneNumber(formatted)
  }

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = (file: File) => {
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const checkUsername = async (value: string) => {
    if (!value || value.length < 3) {
      setUsernameStatus('idle')
      return
    }

    setUsernameStatus('checking')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const res = await fetch(`/api/db-search/search-username?username=${encodeURIComponent(value)}`)
      const data = await res.json()

      if (!res.ok) {
        setUsernameStatus('idle')
        return
      }

      if (!data.available && user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', user.id)
          .single()
        
        if (profileData?.username === value.toLowerCase()) {
          setUsernameStatus('available')
          return
        }
      }

      setUsernameStatus(data.available ? 'available' : 'taken')
    } catch (err) {
      console.error('Username check error:', err)
      setUsernameStatus('idle')
    }
  }

  useEffect(() => {
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current)
    }

    if (username.length >= 3) {
      usernameCheckTimeoutRef.current = setTimeout(() => {
        checkUsername(username)
      }, 500)
    } else {
      setUsernameStatus('idle')
    }

    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current)
      }
    }
  }, [username])

  return (
    <div className="space-y-6 animate-fadeInUp">
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.4s ease-out forwards;
        }
      `}</style>

      <div className="space-y-6 rounded-2xl border border-white/10 bg-black/20 p-6">
        <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">Your profile</h3>
        {/* Avatar, Full Name, and Phone Number */}
        <div className="grid gap-6 md:grid-cols-[160px_1fr] items-start">
          <div className="flex flex-col items-center gap-3 mt-3">
            <EditableAvatar
              avatarUrl={avatarPreview}
              fullName={fullName}
              onClick={handleAvatarClick}
              size={130}
            />
            <button
              type="button"
              onClick={handleAvatarClick}
              className="text-xs font-semibold text-[#cbd5f5] border border-white/10 rounded-full px-4 py-1.5 hover:border-white/20"
            >
              Change photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleAvatarChange(e.target.files[0])}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-sm font-semibold text-white">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                required
              />
              {showValidationErrors && !fullName.trim() && (
                <p className="mt-1 text-xs text-rose-300">Enter your full name</p>
              )}
            </div>

            <div>
              <label className="block mb-2 text-sm font-semibold text-white">Phone Number</label>
              <div className="flex items-center gap-2">
                <div className="px-4 py-3 bg-white/10 border border-white/10 rounded-xl font-medium text-white">
                  +1
                </div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  className="flex-1 p-3 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                  placeholder="(555) 123-4567"
                  maxLength={14}
                  required
                />
              </div>
              {showValidationErrors && !isPhoneNumberValid && (
                <p className="mt-1 text-xs text-rose-300">Enter a valid 10-digit phone number</p>
              )}
            </div>
          </div>
        </div>

        {/* What best describes you, How do you operate, and Commission Rate */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block mb-2 text-sm font-semibold text-white">What best describes you?</label>
            <select
              value={userType}
              onChange={e => {
                const value = e.target.value as 'barber' | 'owner' | ''
                setUserType(value)
                setSelectedRole({ label: '', role: value === 'barber' ? 'Barber' : 'Owner', barber_type: '' })
              }}
              className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
            >
              <option value="">Select...</option>
              <option value="barber">Barber</option>
              <option value="owner">Shop Owner / Manager</option>
            </select>
            {showValidationErrors && userType === '' && (
              <p className="mt-1 text-xs text-rose-300">Select what best describes you</p>
            )}
          </div>

          <div className={selectedRole.barber_type === 'commission' ? 'grid gap-4 md:grid-cols-2' : ''}>
            <div>
              <label className="block mb-2 text-sm font-semibold text-white">How do you operate?</label>
              <select
                value={selectedRole.barber_type}
                onChange={e => {
                  const barberType = e.target.value
                  setSelectedRole({
                    label: barberType === 'commission' ? 'Commission' : 'Chair Rental',
                    role: userType === 'barber' ? 'Barber' : 'Owner',
                    barber_type: barberType,
                  })
                }}
                className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
              >
                <option value="">Select...</option>
                <option value="commission">Commission</option>
                <option value="rental">Chair Rental</option>
              </select>
              {showValidationErrors && selectedRole.barber_type === '' && (
                <p className="mt-1 text-xs text-rose-300">Select how you operate</p>
              )}
            </div>

            {selectedRole.barber_type === 'commission' && (
              <div>
                <label className="block mb-2 text-sm font-semibold text-white">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={commissionRate}
                  onChange={e => setCommissionRate(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                  required
                />
                {showValidationErrors && !isCommissionValid && (
                  <p className="mt-1 text-xs text-rose-300">
                    Enter a rate between 1-100
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Trust Message */}
        {userType && (
          <div className="rounded-xl border border-blue-400/30 bg-blue-400/10 p-3">
            <p className="text-xs text-blue-200">
              You will only see your own schedule and data.
            </p>
          </div>
        )}

        {/* Booking Link and Username */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block mb-2 text-sm font-semibold text-white">Booking Link</label>
            <input
              type="url"
              value={bookingLink}
              onChange={e => setBookingLink(e.target.value)}
              className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
              placeholder="https://your-booking-site.com"
              required
            />
            <p className="mt-1 text-xs text-gray-400">
              Where clients can book appointments with you directly
            </p>
            {showValidationErrors && !isBookingLinkValid && (
              <p className="mt-1 text-xs text-rose-300">Enter your booking link</p>
            )}
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-white">Username</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full p-3 pr-10 rounded-xl bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
                placeholder="yourname"
                required
              />
              {usernameStatus === 'checking' && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-gray-400" />
              )}
              {usernameStatus === 'available' && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-400" />
              )}
              {usernameStatus === 'taken' && (
                <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-rose-400" />
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Used for tracking SMS bookings: https://www.corva.ca/book?profile={username || 'yourname'}
            </p>
            {showValidationErrors && !isUsernameValid && username.trim().length === 0 && (
              <p className="mt-1 text-xs text-rose-300">Enter a username</p>
            )}
            {username.trim() && username.length < 3 && (
              <p className="mt-1 text-xs text-rose-300">Username must be at least 3 characters</p>
            )}
            {usernameStatus === 'taken' && (
              <p className="mt-1 text-xs text-rose-300">This username is already taken</p>
            )}
          </div>
        </div>

        {/* Next Button */}
        <div className="flex justify-end pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={onNext}
            className="px-8 py-3 font-semibold rounded-xl transition-all bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black hover:shadow-lg"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}