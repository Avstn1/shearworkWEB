'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import EditableAvatar from '@/components/EditableAvatar'

export default function ProfileTab() {
  const [profile, setProfile] = useState<any>(null)
  const [commission, setCommission] = useState<number | string>('')
  const [authUser, setAuthUser] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  // Modal states
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [editedEmail, setEditedEmail] = useState('')
  const [editedPhone, setEditedPhone] = useState('')
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false)
  const [isSendingPhoneCode, setIsSendingPhoneCode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [emailVerificationCode, setEmailVerificationCode] = useState('')
  const [phoneVerificationCode, setPhoneVerificationCode] = useState('')
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false)
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false)

  // Phone number formatting
  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/\D/g, '')
    
    if (phoneNumber.length === 0) {
      return ''
    } else if (phoneNumber.length <= 1) {
      return phoneNumber
    } else if (phoneNumber.length <= 4) {
      return `${phoneNumber.slice(0, 1)} (${phoneNumber.slice(1)}`
    } else if (phoneNumber.length <= 7) {
      return `${phoneNumber.slice(0, 1)} (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4)}`
    } else {
      return `${phoneNumber.slice(0, 1)} (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7, 11)}`
    }
  }

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setEditedPhone(formatted)
  }

  const getRawPhoneNumber = (formatted: string) => {
    return formatted.replace(/\D/g, '')
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setAuthUser(user)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Failed fetching profile', error)
        return
      }
      if (data) {
        setProfile(data)
        setCommission(data.commission_rate ? data.commission_rate * 100 : '')
        setEditedEmail(data.email || user.email || '')
        setEditedPhone(data.phone || '')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const updateCommission = async () => {
    if (!profile) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const value = commission === '' ? null : Number(commission) / 100

      const { error } = await supabase
        .from('profiles')
        .update({ commission_rate: value })
        .eq('user_id', user.id)

      if (error) {
        toast.error('Failed updating commission')
      } else {
        toast.success('Commission saved')
        fetchProfile()
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed updating commission')
    }
  }

  const handleSendEmailCode = async () => {
    setIsSendingEmailCode(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Generate and send OTP code
      const response = await fetch('/api/otp/generate-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: editedEmail,
          user_id: user.id 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification')
      }

      toast.success('Verification email sent! Check your inbox.')
    } catch (error: any) {
      console.error('Email verification error:', error)
      toast.error(error.message || 'Failed to send verification email')
    } finally {
      setIsSendingEmailCode(false)
    }
  }

  const handleVerifyEmail = async () => {
    if (!emailVerificationCode.trim()) {
      toast.error('Please enter verification code')
      return
    }

    setIsVerifyingEmail(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Verify the OTP code
      const response = await fetch('/api/otp/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: emailVerificationCode,
          user_id: user.id,
          email: editedEmail
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code')
      }

      // Now save the email to database as verified
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          email: editedEmail,
          email_verified: true
        })
        .eq('user_id', user.id)

      if (updateError) {
        throw new Error('Failed to save email')
      }

      toast.success('Email verified successfully!')
      setShowEmailModal(false)
      setEmailVerificationCode('')
      fetchProfile()
    } catch (error: any) {
      console.error('Email verification code error:', error)
      toast.error(error.message || 'Failed to verify email')
    } finally {
      setIsVerifyingEmail(false)
    }
  }

  const handleSendPhoneCode = async () => {
    setIsSendingPhoneCode(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const rawPhone = getRawPhoneNumber(editedPhone)

      // Generate and send OTP code
      const response = await fetch('/api/otp/generate-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: rawPhone,
          user_id: user.id 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification')
      }

      toast.success('Verification code sent to your phone!')
    } catch (error: any) {
      console.error('Phone verification error:', error)
      toast.error(error.message || 'Failed to send verification code')
    } finally {
      setIsSendingPhoneCode(false)
    }
  }

  const handleVerifyPhone = async () => {
    if (!phoneVerificationCode.trim()) {
      toast.error('Please enter verification code')
      return
    }

    setIsVerifyingPhone(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const rawPhone = getRawPhoneNumber(editedPhone)

      // Verify the OTP code
      const response = await fetch('/api/otp/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: phoneVerificationCode,
          user_id: user.id,
          phone: rawPhone
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code')
      }

      // Now save the phone to database as verified
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          phone: rawPhone,
          phone_verified: true
        })
        .eq('user_id', user.id)

      if (updateError) {
        throw new Error('Failed to save phone number')
      }

      toast.success('Phone verified successfully!')
      setShowPhoneModal(false)
      setPhoneVerificationCode('')
      fetchProfile()
    } catch (error: any) {
      console.error('Phone verification code error:', error)
      toast.error(error.message || 'Failed to verify phone')
    } finally {
      setIsVerifyingPhone(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return toast.error('Not logged in')

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        console.error(uploadError)
        return toast.error('Upload failed')
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const avatarUrl = urlData.publicUrl

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id)

      if (updateErr) {
        console.error(updateErr)
        return toast.error('Failed saving avatar')
      }

      toast.success('Profile picture updated')
      fetchProfile()
    } catch (err) {
      console.error(err)
      toast.error('Failed updating picture')
    }
  }

  if (!profile || !authUser) return <p>Loading...</p>

  return (
    <div className="relative space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Profile Information</h2>
      </div>

      {/* Avatar + User Info */}
      <div className="flex gap-6 items-center">
        <div className="relative">
          <EditableAvatar
            avatarUrl={profile.avatar_url || '/default-avatar.png'}
            fullName={profile.full_name}
            size={96}
            onClick={() => fileInputRef.current?.click()}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="space-y-2">
          <p className="text-lg font-semibold">{profile.full_name}</p>
          <p className="text-sm text-gray-400 capitalize">
            {profile.role === "Barber" 
              ? profile.barber_type === "rental" 
                ? "Rental Barber" 
                : "Commission Barber"
              : profile.role
            }
          </p>
          
          {/* Email with verification status */}
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-400">{profile.email || authUser.email}</p>
            {profile.email_verified ? (
              <span className="px-2 py-0.5 text-xs font-semibold bg-lime-300/20 text-lime-300 border border-lime-300/30 rounded-full">
                Verified
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-semibold bg-amber-300/20 text-amber-300 border border-amber-300/30 rounded-full">
                Not Verified
              </span>
            )}
          </div>

          {/* Phone with verification status */}
          {profile.phone ? (
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-400">{formatPhoneNumber(profile.phone)}</p>
              {profile.phone_verified ? (
                <span className="px-2 py-0.5 text-xs font-semibold bg-lime-300/20 text-lime-300 border border-lime-300/30 rounded-full">
                  Verified
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-semibold bg-rose-300/20 text-rose-300 border border-rose-300/30 rounded-full">
                  Not Verified
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-400 italic">No phone number</p>
              <span className="px-2 py-0.5 text-xs font-semibold bg-rose-300/20 text-rose-300 border border-rose-300/30 rounded-full">
                Required for SMS
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Email Section */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">Email Address</label>
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={profile.email || authUser.email}
            disabled
            className="flex-1 text-sm px-3 py-2 rounded-lg border bg-black/10 border-[var(--accent-2)] text-gray-400 cursor-default"
          />
          <button
            onClick={() => {
              setEditedEmail(profile.email || authUser.email)
              setShowEmailModal(true)
            }}
            className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-lime-300/20 to-lime-400/20 text-lime-300 border border-lime-300/30 rounded-lg hover:from-lime-300/30 hover:to-lime-400/30 transition-all"
          >
            Update
          </button>
        </div>
      </div>

      {/* Phone Section */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">Phone Number</label>
        <div className="flex items-center gap-2">
          <input
            type="tel"
            value={profile.phone ? formatPhoneNumber(profile.phone) : ''}
            disabled
            placeholder="No phone number set"
            className="flex-1 text-sm px-3 py-2 rounded-lg border bg-black/10 border-[var(--accent-2)] text-gray-400 cursor-default"
          />
          <button
            onClick={() => {
              setEditedPhone(profile.phone ? formatPhoneNumber(profile.phone) : '')
              setShowPhoneModal(true)
            }}
            className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-lime-300/20 to-lime-400/20 text-lime-300 border border-lime-300/30 rounded-lg hover:from-lime-300/30 hover:to-lime-400/30 transition-all"
          >
            Update
          </button>
        </div>
      </div>

      {/* Commission */}
      {profile.barber_type === 'commission' && (
        <div>
          <label className="text-sm font-medium">Commission Rate (%)</label>
          <div className="flex items-center mt-1">
            <input
              value={commission}
              onChange={e => setCommission(e.target.value)}
              type="number"
              className="bg-black/10 border border-[var(--accent-2)] p-3 rounded-xl w-40"
            />
            <button
              onClick={updateCommission}
              className="ml-4 bg-[var(--highlight)] px-4 py-2 rounded-xl"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div 
          className="fixed inset-0 bg-black/70 rounded-2xl flex items-center justify-center p-4 z-[9999]"
        >
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Update Email</h3>
              <button
                onClick={() => {
                  setShowEmailModal(false)
                  setEmailVerificationCode('')
                }}
                className="text-gray-400 hover:text-white transition-all"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editedEmail}
                  onChange={(e) => setEditedEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-lime-300/50"
                  placeholder="Enter email address"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Current Status:</span>
                {profile.email_verified ? (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-lime-300/20 text-lime-300 border border-lime-300/30 rounded-full">
                    Verified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs font-semibold bg-amber-300/20 text-amber-300 border border-amber-300/30 rounded-full">
                    Not Verified
                  </span>
                )}
              </div>

              {!profile.email_verified && (
                <div className="space-y-3 p-4 bg-white/5 border border-white/10 rounded-lg">
                  <label className="block text-sm font-medium text-gray-300">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={emailVerificationCode}
                    onChange={(e) => setEmailVerificationCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-300/50"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSendEmailCode}
                      disabled={isSendingEmailCode}
                      className="flex-1 px-3 py-2 text-sm bg-amber-300/20 text-amber-300 border border-amber-300/30 rounded-lg font-semibold hover:bg-amber-300/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingEmailCode ? 'Sending...' : 'Send Code'}
                    </button>
                    <button
                      onClick={handleVerifyEmail}
                      disabled={isVerifyingEmail || !emailVerificationCode.trim()}
                      className="flex-1 px-3 py-2 text-sm bg-lime-300/20 text-lime-300 border border-lime-300/30 rounded-lg font-semibold hover:bg-lime-300/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVerifyingEmail ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Phone Modal */}
      {showPhoneModal && (
        <div 
          className="fixed inset-0 bg-black/70 rounded-2xl flex items-center justify-center p-4 z-[9999]"
        >
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Update Phone Number</h3>
              <button
                onClick={() => {
                  setShowPhoneModal(false)
                  setPhoneVerificationCode('')
                }}
                className="text-gray-400 hover:text-white transition-all"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editedPhone}
                  onChange={handlePhoneInput}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-lime-300/50"
                  placeholder="1 (647) 470-0164"
                  maxLength={16}
                />
              </div>

              {profile.phone && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Current Status:</span>
                  {profile.phone_verified ? (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-lime-300/20 text-lime-300 border border-lime-300/30 rounded-full">
                      Verified
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-rose-300/20 text-rose-300 border border-rose-300/30 rounded-full">
                      Not Verified
                    </span>
                  )}
                </div>
              )}

              {!profile.phone && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  <p className="text-sm text-rose-300">
                    Phone number is required for SMS marketing features
                  </p>
                </div>
              )}

              <div className="space-y-3 p-4 bg-white/5 border border-white/10 rounded-lg">
                <label className="block text-sm font-medium text-gray-300">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={phoneVerificationCode}
                  onChange={(e) => setPhoneVerificationCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-lime-300/50"
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSendPhoneCode}
                    disabled={isSendingPhoneCode}
                    className="flex-1 px-3 py-2 text-sm bg-lime-300/20 text-lime-300 border border-lime-300/30 rounded-lg font-semibold hover:bg-lime-300/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSendingPhoneCode ? 'Sending...' : 'Send Code'}
                  </button>
                  <button
                    onClick={handleVerifyPhone}
                    disabled={isVerifyingPhone || !phoneVerificationCode.trim()}
                    className="flex-1 px-3 py-2 text-sm bg-lime-300/20 text-lime-300 border border-lime-300/30 rounded-lg font-semibold hover:bg-lime-300/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isVerifyingPhone ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}