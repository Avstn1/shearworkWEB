'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import EditableAvatar from '@/components/EditableAvatar'
import { Mail, Phone, Upload, Check, X } from 'lucide-react'

// Modal Portal Component - defined outside to prevent re-creation
const Modal = ({ children }: { children: React.ReactNode }) => {
  const [isMounted, setIsMounted] = useState(false)
  
  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])
  
  if (!isMounted) return null
  return createPortal(children, document.body)
}

export default function ProfileTab() {
  const [profile, setProfile] = useState<any>(null)
  const [commission, setCommission] = useState<number | string>('')
  const [authUser, setAuthUser] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  // Modal states
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [showBookingLinkModal, setShowBookingLinkModal] = useState(false)

  const [editedEmail, setEditedEmail] = useState('')
  const [editedPhone, setEditedPhone] = useState('')

  const [editedBookingLink, setEditedBookingLink] = useState('')

  const [originalPhone, setOriginalPhone] = useState('')
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false)
  const [isSendingPhoneCode, setIsSendingPhoneCode] = useState(false)
  const [isUpdatingBookingLink, setIsUpdatingBookingLink] = useState(false)

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
    const input = e.target.value.replace(/\D/g, '');
    
    if (input.length <= 10) {
      let formatted = input;
      if (input.length > 6) {
        formatted = `(${input.slice(0, 3)}) ${input.slice(3, 6)}-${input.slice(6, 10)}`;
      } else if (input.length > 3) {
        formatted = `(${input.slice(0, 3)}) ${input.slice(3)}`;
      } else if (input.length > 0) {
        formatted = `(${input}`;
      }
      
      setEditedPhone(formatted);
    }
  };

  const getRawPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    return '';
  };

  const getE164PhoneNumber = (formatted: string) => {
    const digits = formatted.replace(/\D/g, '');
    if (digits.length !== 10) {
      return '';
    }
    return `+1${digits}`;
  }

  const initializeEditedPhone = (phone: string) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    const phoneDigits = digits.length === 11 && digits.startsWith('1') 
      ? digits.slice(1) 
      : digits;
    
    if (phoneDigits.length === 10) {
      return `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6, 10)}`;
    }
    return phoneDigits;
  };

  const hasPhoneChanged = () => {
    const currentRaw = getRawPhoneNumber(editedPhone);
    const originalRaw = getRawPhoneNumber(originalPhone);
    return currentRaw !== originalRaw;
  };

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
        const formattedPhone = initializeEditedPhone(data.phone || '');
        setEditedPhone(formattedPhone);
        setOriginalPhone(formattedPhone);
        setEditedBookingLink(data.booking_link || 'No booking link set.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const updateCommission = async () => {
    if (!profile) return
    try {
      const value = commission === '' ? null : Number(commission) / 100

      const { error } = await supabase
        .from('profiles')
        .update({ commission_rate: value })
        .eq('user_id', profile.user_id)

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
    if (!profile) return
    
    setIsSendingEmailCode(true)
    try {
      const response = await fetch('/api/otp/generate-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: editedEmail,
          user_id: profile.user_id 
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
    if (!profile) return
    
    if (!emailVerificationCode.trim()) {
      toast.error('Please enter verification code')
      return
    }

    setIsVerifyingEmail(true)
    try {
      const response = await fetch('/api/otp/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: emailVerificationCode,
          user_id: profile.user_id,
          email: editedEmail
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code')
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          email: editedEmail,
          email_verified: true
        })
        .eq('user_id', profile.user_id)

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

  const handleUpdateBookingLink = async () => {
    if (!profile) return
    
    if (!editedBookingLink.trim()) {
      toast.error('Please enter a booking link')
      return
    }

    setIsUpdatingBookingLink(true)
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          booking_link: editedBookingLink
        })
        .eq('user_id', profile.user_id)

      if (updateError) {
        throw new Error('Failed to update booking link')
      }

      toast.success('Booking link updated successfully!')
      setShowBookingLinkModal(false)
      fetchProfile()
    } catch (error: any) {
      console.error('Booking link update error:', error)
      toast.error(error.message || 'Failed to update booking link')
    } finally {
      setIsUpdatingBookingLink(false)
    }
  }

  const handleSendPhoneCode = async () => {
    if (!profile) return
    
    setIsSendingPhoneCode(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Not authenticated')
        return
      }

      const e164Phone = getE164PhoneNumber(editedPhone)
      const rawPhone = getRawPhoneNumber(editedPhone)
      if (rawPhone.length < 10) {
        toast.error('Please enter a valid phone number')
        return
      }

      const response = await fetch('/api/otp/generate-sms-otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          phoneNumber: e164Phone
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
    if (!profile) return
    
    if (!phoneVerificationCode.trim()) {
      toast.error('Please enter verification code')
      return
    }

    setIsVerifyingPhone(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Not authenticated')
        return
      }

      const e164Phone = getE164PhoneNumber(editedPhone)

      const response = await fetch('/api/otp/verify-sms-otp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          code: phoneVerificationCode,
          phoneNumber: e164Phone
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid verification code')
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
  
  const handleVerifyPhoneNoOTP = async () => {
    const e164Phone = getE164PhoneNumber(editedPhone)
    console.log(e164Phone)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        phone: e164Phone,
        phone_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', profile.user_id)

    if (updateError) {
      console.log(updateError)
    }

    toast.success('Phone verified successfully!')
    setShowPhoneModal(false)
    setPhoneVerificationCode('')
    fetchProfile()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile) return
    
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile.user_id}.${fileExt}`
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
        .eq('user_id', profile.user_id)

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

  if (!profile || !authUser) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lime-400"></div>
    </div>
  )

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Profile Information</h2>

      {/* Avatar + User Info Card */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          <div className="flex flex-col items-center gap-2">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <EditableAvatar
                avatarUrl={profile.avatar_url || '/default-avatar.png'}
                fullName={profile.full_name}
                size={96}
              />
              <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-[#cbd5f5] border border-white/10 rounded-full px-4 py-1 hover:border-white/20"
            >
              Change photo
            </button>
          </div>

          <div className="space-y-2 flex-1">
            <h3 className="text-xl font-semibold">{profile.full_name}</h3>
            <p className="text-sm text-gray-400 capitalize">
              {profile.role === "Barber" 
                ? profile.barber_type === "rental" 
                  ? "Rental Barber" 
                  : "Commission Barber"
                : profile.role
              }
            </p>
            
            {/* Email with verification status */}
            <div className="flex items-center gap-2 flex-wrap">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">{profile.email || authUser.email}</span>
              {profile.email_verified ? (
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Verified
                </span>
              ) : (
                <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full flex items-center gap-1">
                  <X className="w-3 h-3" />
                  Not Verified
                </span>
              )}
            </div>

            {/* Phone with verification status */}
            <div className="flex items-center gap-2 flex-wrap">
              <Phone className="w-4 h-4 text-gray-400" />
              {profile.phone ? (
                <>
                  <span className="text-sm text-gray-300">{formatPhoneNumber(profile.phone)}</span>
                  {profile.phone_verified ? (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full flex items-center gap-1">
                      <X className="w-3 h-3" />
                      Not Verified
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-sm text-gray-400 italic">No phone number</span>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full">
                    Required for SMS
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email Section */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-300">Email Address</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={profile.email || authUser.email}
            disabled
            className="flex-1 px-4 py-3 rounded-xl border bg-white/5 border-white/10 text-gray-300 focus:outline-none focus:ring-2 focus:ring-lime-400/50 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => {
              setEditedEmail(profile.email || authUser.email)
              setShowEmailModal(true)
            }}
            className="px-6 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-lime-400/20 transition-all whitespace-nowrap"
          >
            Update
          </button>
        </div>
      </div>

      {/* Phone Section */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-300">Phone Number</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="tel"
            value={profile.phone ? formatPhoneNumber(profile.phone) : ''}
            disabled
            placeholder="No phone number set"
            className="flex-1 px-4 py-3 rounded-xl border bg-white/5 border-white/10 text-gray-300 focus:outline-none focus:ring-2 focus:ring-lime-400/50 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => {
              const formattedPhone = initializeEditedPhone(profile.phone || '');
              setEditedPhone(formattedPhone);
              setOriginalPhone(formattedPhone);
              setShowPhoneModal(true)
            }}
            className="px-6 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-lime-400/20 transition-all whitespace-nowrap"
          >
            Update
          </button>
        </div>
      </div>

      {/* Booking link Section */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-300">Booking Link</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={profile.booking_link || 'No booking link set.'}
            disabled
            className="flex-1 px-4 py-3 rounded-xl border bg-white/5 border-white/10 text-gray-300 focus:outline-none focus:ring-2 focus:ring-lime-400/50 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => {
              setEditedBookingLink(profile.booking_link || '')
              setShowBookingLinkModal(true)
            }}
            className="px-6 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-lime-400/20 transition-all whitespace-nowrap"
          >
            Update
          </button>
        </div>
      </div>

      {/* Commission */}
      {profile.barber_type === 'commission' && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-300">Commission Rate (%)</label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <input
              value={commission}
              onChange={e => setCommission(e.target.value)}
              type="number"
              placeholder="Enter commission rate"
              className="w-full sm:w-40 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-400/50"
            />
            <button
              onClick={updateCommission}
              className="px-6 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-lime-400/20 transition-all whitespace-nowrap"
            >
              Save Rate
            </button>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <Modal>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-[#1a1f1b] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Update Email</h3>
                <button
                  onClick={() => {
                    setShowEmailModal(false)
                    setEmailVerificationCode('')
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
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
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-400/50"
                    placeholder="Enter email address"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Current Status:</span>
                  {profile.email_verified ? (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                      Verified
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                      Not Verified
                    </span>
                  )}
                </div>

                {!profile.email_verified && (
                  <div className="space-y-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                    <label className="block text-sm font-medium text-gray-300">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      value={emailVerificationCode}
                      onChange={(e) => setEmailVerificationCode(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSendEmailCode}
                        disabled={isSendingEmailCode}
                        className="flex-1 px-4 py-3 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl font-semibold hover:bg-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSendingEmailCode ? 'Sending...' : 'Send Code'}
                      </button>
                      <button
                        onClick={handleVerifyEmail}
                        disabled={isVerifyingEmail || !emailVerificationCode.trim()}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isVerifyingEmail ? 'Verifying...' : 'Verify'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Phone Modal with phone verification */}
      {/* {showPhoneModal && (
        <Modal>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-[#1a1f1b] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Update Phone Number</h3>
                <button
                  onClick={() => {
                    setShowPhoneModal(false)
                    setPhoneVerificationCode('')
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="px-4 py-3 bg-white/10 border border-white/10 rounded-xl font-medium">
                      +1
                    </div>
                    <input
                      type="tel"
                      value={editedPhone}
                      onChange={handlePhoneInput}
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-400/50"
                      placeholder="(647) 111-2222"
                      maxLength={14}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Enter your 10-digit phone number
                  </p>
                </div>

                {profile.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Current Status:</span>
                    {profile.phone_verified ? (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                        Verified
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full">
                        Not Verified
                      </span>
                    )}
                  </div>
                )}

                {!profile.phone && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    <p className="text-sm text-rose-300">
                      Phone number is required for SMS marketing features
                    </p>
                  </div>
                )}

                <div className="space-y-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <label className="block text-sm font-medium text-gray-300">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={phoneVerificationCode}
                    onChange={(e) => setPhoneVerificationCode(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-400/50"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSendPhoneCode}
                      disabled={isSendingPhoneCode || editedPhone.replace(/\D/g, '').length !== 10 || !hasPhoneChanged()}
                      className="flex-1 px-4 py-3 bg-lime-500/20 text-lime-300 border border-lime-500/30 rounded-xl font-semibold hover:bg-lime-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingPhoneCode ? 'Sending...' : 'Send Code'}
                    </button>
                    <button
                      onClick={handleVerifyPhone}
                      disabled={isVerifyingPhone || !phoneVerificationCode.trim()}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVerifyingPhone ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )} */}

      {/* Phone Modal without phone verification */}
      {showPhoneModal && (
        <Modal>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-[#1a1f1b] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Update Phone Number</h3>
                <button
                  onClick={() => setShowPhoneModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="px-4 py-3 bg-white/10 border border-white/10 rounded-xl font-medium">
                      +1
                    </div>
                    <input
                      type="tel"
                      value={editedPhone}
                      onChange={handlePhoneInput}
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-400/50"
                      placeholder="(647) 111-2222"
                      maxLength={14}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Enter your 10-digit phone number
                  </p>
                </div>

                {profile.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Current:</span>
                    <span className="text-sm font-medium">{profile.phone}</span>
                  </div>
                )}

                {!profile.phone && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    <p className="text-sm text-rose-300">
                      Phone number is required for SMS marketing features
                    </p>
                  </div>
                )}

                <button
                  onClick={handleVerifyPhoneNoOTP}
                  disabled={editedPhone.replace(/\D/g, '').length !== 10 || !hasPhoneChanged()}
                  className="w-full px-4 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Phone Number
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}



      {/* Booking Link Modal */}
      {showBookingLinkModal && (
        <Modal>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-[#1a1f1b] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Update Booking Link</h3>
                <button
                  onClick={() => setShowBookingLinkModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Booking URL
                  </label>
                  <input
                    type="url"
                    value={editedBookingLink}
                    onChange={(e) => setEditedBookingLink(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-400/50"
                    placeholder="https://your-booking-site.com"
                  />
                </div>

                <button
                  onClick={handleUpdateBookingLink}
                  disabled={isUpdatingBookingLink || !editedBookingLink.trim()}
                  className="w-full px-4 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingBookingLink ? 'Updating...' : 'Update Booking Link'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}