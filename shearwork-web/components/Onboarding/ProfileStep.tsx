'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
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
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const [saving, setSaving] = useState(false)

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
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', value.toLowerCase())
        .neq('user_id', user.id)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Username check error:', error)
        setUsernameStatus('idle')
        return
      }

      setUsernameStatus(data ? 'taken' : 'available')
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

  const phoneToE164 = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '')
    return `+1${cleaned}`
  }

  const handleNextClick = async () => {
    // This will be called from the parent with validation already set
    if (!isProfileValid) {
      return
    }

    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      // Upload avatar if changed
      let avatarUrl = avatarPreview || ''
      if (avatarFile) {
        const fileName = `${fullName.replace(/\s+/g, '_')}_${Date.now()}`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, { upsert: true })
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
        avatarUrl = urlData.publicUrl
        setAvatarPreview(avatarUrl)
      }

      // Prepare profile update
      const profileUpdate: Record<string, unknown> = {
        full_name: fullName,
        phone: phoneToE164(phoneNumber),
        role: selectedRole.role,
        barber_type: selectedRole.barber_type || null,
        avatar_url: avatarUrl,
        username: username.toLowerCase(),
        booking_link: bookingLink.trim(),
        updated_at: new Date().toISOString(),
      }

      if (selectedRole.barber_type === 'commission') {
        if (commissionRate === '' || commissionRate < 1 || commissionRate > 100) {
          throw new Error('Please enter a valid commission rate between 1 and 100')
        }
        profileUpdate.commission_rate = commissionRate / 100
      }

      // Save to database
      const { error: updateError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      toast.success('Profile saved!')
      onNext()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save profile'
      console.error(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div className="min-w-0">
          <h2 className="panel-title">Your profile</h2>
          <p className="panel-subtitle">How you appear to clients and how you get paid</p>
        </div>
      </header>

      <div className="panel-body space-y-6">
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
              className="btn btn-glass btn-sm"
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
              <label className="field-label">Barber Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="field"
                required
              />
              {showValidationErrors && !fullName.trim() && (
                <p className="mt-1 text-xs text-[#FF8F7D]">Enter your barber name</p>
              )}
            </div>

            <div>
              <label className="field-label">Phone Number</label>
              <div className="flex items-center gap-2">
                <div className="flex h-10 items-center rounded-lg border border-white/[0.09] bg-raised px-3 text-sm font-medium tabular-nums text-gray-300">
                  +1
                </div>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  className="field flex-1"
                  placeholder="(555) 123-4567"
                  maxLength={14}
                  required
                />
              </div>
              {showValidationErrors && !isPhoneNumberValid && (
                <p className="mt-1 text-xs text-[#FF8F7D]">Enter a valid 10-digit phone number</p>
              )}
            </div>
          </div>
        </div>

        {/* What best describes you, How do you operate, and Commission Rate */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">What best describes you?</label>
            <select
              value={userType}
              onChange={e => {
                const value = e.target.value as 'barber' | 'owner' | ''
                setUserType(value)
                setSelectedRole({ label: '', role: value === 'barber' ? 'Barber' : 'Owner', barber_type: '' })
              }}
              className="field cursor-pointer"
            >
              <option value="">Select...</option>
              <option value="barber">Barber</option>
              <option value="owner">Shop Owner / Manager</option>
            </select>
            {showValidationErrors && userType === '' && (
              <p className="mt-1 text-xs text-[#FF8F7D]">Select what best describes you</p>
            )}
          </div>

          <div className={selectedRole.barber_type === 'commission' ? 'grid gap-4 md:grid-cols-2' : ''}>
            <div>
              <label className="field-label">How do you operate?</label>
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
                className="field cursor-pointer"
              >
                <option value="">Select...</option>
                <option value="commission">Commission</option>
                <option value="rental">Chair Rental</option>
              </select>
              {showValidationErrors && selectedRole.barber_type === '' && (
                <p className="mt-1 text-xs text-[#FF8F7D]">Select how you operate</p>
              )}
            </div>

            {selectedRole.barber_type === 'commission' && (
              <div>
                <label className="field-label">
                  Commission Rate (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  value={commissionRate}
                  onChange={e => setCommissionRate(e.target.value === '' ? '' : Number(e.target.value))}
                  className="field"
                  required
                />
                {showValidationErrors && !isCommissionValid && (
                  <p className="mt-1 text-xs text-[#FF8F7D]">
                    Enter a rate between 1-100
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Trust Message */}
        {userType && (
          <div className="rounded-lg border border-[#9CCBFF]/20 bg-[#9CCBFF]/[0.06] px-3 py-2.5">
            <p className="text-xs text-[#9CCBFF]">
              You will only see your own schedule and data.
            </p>
          </div>
        )}

        {/* Booking Link and Username */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Booking Link</label>
            <input
              type="url"
              value={bookingLink}
              onChange={e => setBookingLink(e.target.value)}
              className="field"
              placeholder="https://your-booking-site.com"
              required
            />
            <p className="mt-1 text-xs text-gray-400">
              Where clients can book appointments with you directly
            </p>
            {showValidationErrors && !isBookingLinkValid && (
              <p className="mt-1 text-xs text-[#FF8F7D]">Enter your booking link</p>
            )}
          </div>

          <div>
            <label className="field-label">Username</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="field pr-10"
                placeholder="yourname"
                required
              />
              {usernameStatus === 'checking' && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
              )}
              {usernameStatus === 'available' && (
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sage" />
              )}
              {usernameStatus === 'taken' && (
                <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#FF8F7D]" />
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Used for tracking SMS bookings: https://www.corva.ca/book?profile={username || 'yourname'}
            </p>
            {showValidationErrors && !isUsernameValid && username.trim().length === 0 && (
              <p className="mt-1 text-xs text-[#FF8F7D]">Enter a username</p>
            )}
            {username.trim() && username.length < 3 && (
              <p className="mt-1 text-xs text-[#FF8F7D]">Username must be at least 3 characters</p>
            )}
            {usernameStatus === 'taken' && (
              <p className="mt-1 text-xs text-[#FF8F7D]">This username is already taken</p>
            )}
          </div>
        </div>

      </div>

      {/* Next Button */}
      <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-4">
          <button
            type="button"
            onClick={handleNextClick}
            disabled={saving}
            className="btn btn-primary min-w-[120px]"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              'Continue'
            )}
          </button>
      </div>
    </section>
  )
}