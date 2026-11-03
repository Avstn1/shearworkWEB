'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import EditableAvatar from '@/components/EditableAvatar'
import { Mail, Phone, Upload, Check, X, Loader2 } from 'lucide-react'
import { Panel } from '@/components/ui/AppKit'

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

// Graphite modal chrome: backdrop + surface, title row with close, optional right-aligned footer
const ModalShell = ({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) => (
  <div className="modal-backdrop z-[100] flex items-center justify-center p-4">
    <div className="modal-surface w-full max-w-md overflow-hidden">
      <div className="panel-header">
        <h3 className="panel-title">{title}</h3>
        <button onClick={onClose} className="btn btn-ghost btn-sm h-8 w-8 p-0" aria-label="Close">
          <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
      </div>
      <div className="space-y-4 p-5">{children}</div>
      {footer && (
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">{footer}</div>
      )}
    </div>
  </div>
)

export default function ProfileTab() {
  const [profile, setProfile] = useState<any>(null)
  const [commission, setCommission] = useState<number | string>('')
  const [authUser, setAuthUser] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [username, setUsername] = useState<string>('')
  
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

  const [isUsernameModalOpen, setIsUsernameModalOpen] = useState(false)
  const [editedUsername, setEditedUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [isCheckingUsername, setIsCheckingUsername] = useState(false)

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

  const generateUsername = (fullName: string): string => {
    return fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const checkUsernameExists = async (username: string, excludeCurrentUser = false): Promise<boolean> => {
    let query = supabase
      .from('profiles')
      .select('username')
      .eq('username', username);
    
    if (excludeCurrentUser && authUser) {
      query = query.neq('user_id', authUser.id);
    }
    
    const { data } = await query.maybeSingle();
    return !!data;
  };

  const generateUniqueUsername = async (baseUsername: string): Promise<string> => {
    let username = baseUsername;
    let exists = await checkUsernameExists(username);
    
    while (exists) {
      const randomNum = Math.floor(Math.random() * 90 + 10); // 10-99
      username = `${baseUsername}${randomNum}`;
      exists = await checkUsernameExists(username);
    }
    
    return username;
  };

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
        
        // Check and set username if missing
        if (!data.username && data.full_name) {
          const baseUsername = generateUsername(data.full_name);
          const uniqueUsername = await generateUniqueUsername(baseUsername);
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ username: uniqueUsername })
            .eq('user_id', user.id);
          
          if (!updateError) {
            setProfile({ ...data, username: uniqueUsername });
          }
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleUsernameClick = () => {
    setEditedUsername(profile?.username || '');
    setUsernameError('');
    setIsUsernameModalOpen(true);
  };

  const validateUsername = (username: string): boolean => {
    const usernameRegex = /^[a-z0-9]+$/;
    return usernameRegex.test(username);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase();
    setEditedUsername(value);
    
    if (value && !validateUsername(value)) {
      setUsernameError('Username can only contain lowercase letters and numbers');
    } else {
      setUsernameError('');
    }
  };

  const handleUsernameSave = async () => {
    if (!authUser || !editedUsername) return;
    
    if (!validateUsername(editedUsername)) {
      setUsernameError('Username can only contain lowercase letters and numbers');
      return;
    }
    
    setIsCheckingUsername(true);
    
    // Check if username is taken by another user
    const exists = await checkUsernameExists(editedUsername, true);
    
    if (exists) {
      setUsernameError('This username is already taken');
      setIsCheckingUsername(false);
      return;
    }
    
    const { error } = await supabase
      .from('profiles')
      .update({ username: editedUsername })
      .eq('user_id', authUser.id);
    
    setIsCheckingUsername(false);
    
    if (error) {
      setUsernameError('Failed to update username');
      console.error('Username update error:', error);
      return;
    }
    
    setProfile({ ...profile!, username: editedUsername });
    setIsUsernameModalOpen(false);
  };

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
    <div className="panel flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-sage" strokeWidth={1.75} />
    </div>
  )

  const verifiedBadge = (
    <span className="badge badge-sage">
      <Check className="h-3 w-3" strokeWidth={2} />
      Verified
    </span>
  )
  const unverifiedBadge = <span className="badge">Not verified</span>

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Avatar + User Info */}
      <Panel title="Profile" subtitle="How you appear across Corva.">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center gap-2">
            <div className="group relative cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <EditableAvatar
                avatarUrl={profile.avatar_url || '/default-avatar.png'}
                fullName={profile.full_name}
                size={80}
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <Upload className="h-5 w-5 text-ivory" strokeWidth={1.75} />
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
              className="btn btn-ghost btn-sm h-8 text-xs"
            >
              Change photo
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            {/* Full name with username */}
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="text-lg font-semibold text-ivory">{profile.full_name}</h3>
              <button
                onClick={handleUsernameClick}
                className="text-sm text-muted transition-colors hover:text-sage-bright"
              >
                @{profile.username || 'set username'}
              </button>
            </div>

            <p className="text-[13px] capitalize text-muted">
              {profile.role === "Barber"
                ? profile.barber_type === "rental"
                  ? "Rental Barber"
                  : "Commission Barber"
                : profile.role
              }
            </p>

            {/* Email with verification status */}
            <div className="flex flex-wrap items-center gap-2">
              <Mail className="h-4 w-4 text-gray-500" strokeWidth={1.75} />
              <span className="text-sm text-gray-300">{profile.email || authUser.email}</span>
              {profile.email_verified ? verifiedBadge : unverifiedBadge}
            </div>

            {/* Phone with verification status */}
            <div className="flex flex-wrap items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" strokeWidth={1.75} />
              {profile.phone ? (
                <>
                  <span className="text-sm text-gray-300">{formatPhoneNumber(profile.phone)}</span>
                  {profile.phone_verified ? verifiedBadge : unverifiedBadge}
                </>
              ) : (
                <>
                  <span className="text-sm italic text-gray-500">No phone number</span>
                  <span className="badge badge-warn">Required for SMS</span>
                </>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* Contact details */}
      <Panel title="Contact & booking" subtitle="Used for notifications, SMS features and your booking page.">
        <div className="space-y-5">
          {/* Email */}
          <div>
            <label className="field-label" htmlFor="profile-email">Email address</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="profile-email"
                type="email"
                value={profile.email || authUser.email}
                disabled
                className="field flex-1 cursor-not-allowed text-gray-300"
              />
              <button
                onClick={() => {
                  setEditedEmail(profile.email || authUser.email)
                  setShowEmailModal(true)
                }}
                className="btn btn-glass btn-sm h-10 self-end sm:self-auto"
              >
                Update
              </button>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="field-label" htmlFor="profile-phone">Phone number</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="profile-phone"
                type="tel"
                value={profile.phone ? formatPhoneNumber(profile.phone) : ''}
                disabled
                placeholder="No phone number set"
                className="field flex-1 cursor-not-allowed text-gray-300"
              />
              <button
                onClick={() => {
                  const formattedPhone = initializeEditedPhone(profile.phone || '');
                  setEditedPhone(formattedPhone);
                  setOriginalPhone(formattedPhone);
                  setShowPhoneModal(true)
                }}
                className="btn btn-glass btn-sm h-10 self-end sm:self-auto"
              >
                Update
              </button>
            </div>
          </div>

          {/* Booking link */}
          <div>
            <label className="field-label" htmlFor="profile-booking">Booking link</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="profile-booking"
                type="text"
                value={profile.booking_link || 'No booking link set.'}
                disabled
                className="field flex-1 cursor-not-allowed text-gray-300"
              />
              <button
                onClick={() => {
                  setEditedBookingLink(profile.booking_link || '')
                  setShowBookingLinkModal(true)
                }}
                className="btn btn-glass btn-sm h-10 self-end sm:self-auto"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      </Panel>

      {/* Commission */}
      {profile.barber_type === 'commission' && (
        <Panel title="Commission" subtitle="The share of each service you keep.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:w-48">
              <label className="field-label" htmlFor="profile-commission">Commission rate (%)</label>
              <input
                id="profile-commission"
                value={commission}
                onChange={e => setCommission(e.target.value)}
                type="number"
                placeholder="Enter commission rate"
                className="field tabular-nums"
              />
            </div>
            <button onClick={updateCommission} className="btn btn-primary btn-sm h-10 self-end">
              Save rate
            </button>
          </div>
        </Panel>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <Modal>
          <ModalShell
            title="Update email"
            onClose={() => {
              setShowEmailModal(false)
              setEmailVerificationCode('')
            }}
          >
            <div>
              <label className="field-label">Email address</label>
              <input
                type="email"
                value={editedEmail}
                onChange={(e) => setEditedEmail(e.target.value)}
                className="field"
                placeholder="Enter email address"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted">Current status</span>
              {profile.email_verified ? verifiedBadge : unverifiedBadge}
            </div>

            {!profile.email_verified && (
              <div className="space-y-3 rounded-lg border border-white/[0.07] bg-raised p-4">
                <div>
                  <label className="field-label">Verification code</label>
                  <input
                    type="text"
                    value={emailVerificationCode}
                    onChange={(e) => setEmailVerificationCode(e.target.value)}
                    className="field tabular-nums tracking-widest"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleSendEmailCode}
                    disabled={isSendingEmailCode}
                    className="btn btn-glass btn-sm"
                  >
                    {isSendingEmailCode ? 'Sending...' : 'Send code'}
                  </button>
                  <button
                    onClick={handleVerifyEmail}
                    disabled={isVerifyingEmail || !emailVerificationCode.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    {isVerifyingEmail ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </div>
            )}
          </ModalShell>
        </Modal>
      )}

      {/* Phone Modal with phone verification */}
      {/* {showPhoneModal && (
        <Modal>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
            <div className="bg-[#11141A] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5">
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
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed btn-fx"
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
          <ModalShell
            title="Update phone number"
            onClose={() => setShowPhoneModal(false)}
            footer={
              <>
                <button onClick={() => setShowPhoneModal(false)} className="btn btn-ghost btn-sm">Cancel</button>
                <button
                  onClick={handleVerifyPhoneNoOTP}
                  disabled={editedPhone.replace(/\D/g, '').length !== 10 || !hasPhoneChanged()}
                  className="btn btn-primary btn-sm"
                >
                  Save phone number
                </button>
              </>
            }
          >
            <div>
              <label className="field-label">Phone number</label>
              <div className="flex items-center gap-2">
                <div className="flex h-10 items-center rounded-lg border border-white/[0.09] bg-raised px-3 text-sm text-gray-300">
                  +1
                </div>
                <input
                  type="tel"
                  value={editedPhone}
                  onChange={handlePhoneInput}
                  className="field flex-1 tabular-nums"
                  placeholder="(647) 111-2222"
                  maxLength={14}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Enter your 10-digit phone number</p>
            </div>

            {profile.phone && (
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-muted">Current</span>
                <span className="text-sm tabular-nums text-ivory">{profile.phone}</span>
              </div>
            )}

            {!profile.phone && (
              <p className="rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-[13px] text-amber-300">
                Phone number is required for SMS marketing features
              </p>
            )}
          </ModalShell>
        </Modal>
      )}

      {/* Username Edit Modal */}
      {isUsernameModalOpen && (
        <Modal>
          <ModalShell
            title="Edit username"
            onClose={() => setIsUsernameModalOpen(false)}
            footer={
              <>
                <button onClick={() => setIsUsernameModalOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
                <button
                  onClick={handleUsernameSave}
                  disabled={!editedUsername || !!usernameError || isCheckingUsername}
                  className="btn btn-primary btn-sm"
                >
                  {isCheckingUsername ? 'Checking...' : 'Update username'}
                </button>
              </>
            }
          >
            <div>
              <label className="field-label">Username</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  @
                </span>
                <input
                  type="text"
                  value={editedUsername}
                  onChange={handleUsernameChange}
                  className="field pl-7"
                  placeholder="username"
                />
              </div>
              {usernameError && (
                <p className="mt-2 text-[13px] text-[#FF8F7D]">{usernameError}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">Only lowercase letters and numbers allowed</p>
            </div>
          </ModalShell>
        </Modal>
      )}

      {/* Booking Link Modal */}
      {showBookingLinkModal && (
        <Modal>
          <ModalShell
            title="Update booking link"
            onClose={() => setShowBookingLinkModal(false)}
            footer={
              <>
                <button onClick={() => setShowBookingLinkModal(false)} className="btn btn-ghost btn-sm">Cancel</button>
                <button
                  onClick={handleUpdateBookingLink}
                  disabled={isUpdatingBookingLink || !editedBookingLink.trim()}
                  className="btn btn-primary btn-sm"
                >
                  {isUpdatingBookingLink ? 'Updating...' : 'Update booking link'}
                </button>
              </>
            }
          >
            <div>
              <label className="field-label">Booking URL</label>
              <input
                type="url"
                value={editedBookingLink}
                onChange={(e) => setEditedBookingLink(e.target.value)}
                className="field"
                placeholder="https://your-booking-site.com"
              />
            </div>
          </ModalShell>
        </Modal>
      )}
    </div>
  )
}
