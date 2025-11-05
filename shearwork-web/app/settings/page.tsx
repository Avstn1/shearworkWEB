'use client'

import React, { useState, useEffect } from 'react'
import EditableAvatar from '@/components/EditableAvatar'
import SignOutButton from '@/components/SignOutButton'
import { FaCog } from 'react-icons/fa'
import { supabase } from '@/utils/supabaseClient'
import { useIsMobile } from '@/hooks/useIsMobile'
import Link from 'next/link'
import { motion } from 'framer-motion'
import Navbar from '@/components/Navbar'
import OnboardingGuard from '@/components/Wrappers/OnboardingGuard'
import ConnectAcuityButton from '@/components/ConnectAcuityButton'

interface ProfileData {
  full_name: string
  avatar_url: string
  role: string
  email: string
}

const MOBILE_BREAKPOINT = 768

// ----- ChangePasswordForm Component -----
function ChangePasswordForm({ onSuccess }: { onSuccess: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageColor, setMessageColor] = useState('red')
  const [showPasswords, setShowPasswords] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (newPassword !== confirmPassword) {
      setMessageColor('red')
      setMessage("New password and confirmation don't match")
      return
    }

    if (!newPassword) {
      setMessageColor('red')
      setMessage("New password cannot be empty")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setMessageColor('red')
        setMessage(`Error: ${error.message}`)
      } else {
        setMessageColor('green')
        setMessage('Password updated successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        // Automatically hide form after success
        setTimeout(() => onSuccess(), 1500)
      }
    } catch (err: any) {
      setMessageColor('red')
      setMessage(`Unexpected error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleChangePassword}
      className="flex flex-col gap-4 bg-[var(--accent-1)] p-5 rounded-xl shadow-md border border-[var(--accent-2)] mt-4"
    >
      <h2 className="font-semibold text-[var(--highlight)] text-lg mb-2">
        🔒 Change Password
      </h2>

      {message && <p className={`text-sm ${messageColor === 'green' ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}

      <div className="flex flex-col gap-2">
        <label className="text-sm text-[var(--text-subtle)]">Current Password</label>
        <input
          type={showPasswords ? 'text' : 'password'}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--accent-3)]/20 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--highlight)]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-[var(--text-subtle)]">New Password</label>
        <input
          type={showPasswords ? 'text' : 'password'}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--accent-3)]/20 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--highlight)]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm text-[var(--text-subtle)]">Confirm New Password</label>
        <input
          type={showPasswords ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="px-3 py-2 rounded-lg bg-[var(--accent-3)]/20 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--highlight)]"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showPasswords}
          onChange={() => setShowPasswords(!showPasswords)}
          id="show-passwords"
        />
        <label htmlFor="show-passwords" className="text-sm text-[var(--text-subtle)]">
          Show passwords
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="bg-[var(--highlight)] text-[var(--foreground)] py-2 px-4 rounded-lg hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? 'Updating...' : 'Change Password'}
      </button>
    </form>
  )
}

// ----- SettingsPage -----
export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [editable, setEditable] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const isMobile = useIsMobile(MOBILE_BREAKPOINT)

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        console.error('Error fetching user:', userError?.message)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, role')
        .eq('user_id', user.id)
        .single()

      if (error) console.error('Error fetching profile:', error.message)
      else {
        setProfile({
          full_name: data.full_name ?? 'User',
          avatar_url: data.avatar_url ?? '',
          role: data.role ?? 'Barber',
          email: user.email ?? '',
        })
        setFullName(data.full_name ?? '')
      }
      setLoading(false)
    }

    fetchProfile()
  }, [])

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !profile) return

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No active user')

      const fileName = `${user.id}_${Date.now()}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const publicUrl = urlData.publicUrl

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', user.id)
      setProfile({ ...profile, avatar_url: publicUrl })
    } catch (err: any) {
      console.error('Upload error:', err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleNameUpdate = async () => {
    if (!profile) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('user_id', user.id)

    if (error) console.error('Error updating name:', error.message)
    else {
      setProfile({ ...profile, full_name: fullName })
      setEditable(false)
    }
  }

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen text-[var(--accent-2)]">
        Loading profile...
      </div>
    )

  const renderMobileMenu = () => (
    <div className="fixed inset-0 bg-black/50 z-50 flex flex-col">
      <div className="bg-[var(--accent-2)] p-4 flex justify-between items-center">
        <span className="text-[var(--highlight)] text-lg font-bold">⚙️ Settings</span>
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="text-[var(--text-bright)] text-xl"
        >
          ✕
        </button>
      </div>
      <nav className="flex flex-col p-4 space-y-3">
        <Link
          href="/dashboard"
          className="text-[var(--text-bright)] text-base font-semibold hover:text-[var(--highlight)]"
          onClick={() => setMobileMenuOpen(false)}
        >
          Dashboard
        </Link>
      </nav>
      <div className="mt-auto p-4">
        <SignOutButton className="w-full" />
      </div>
    </div>
  )

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`flex flex-col items-center ${
        isMobile ? 'p-4 pt-6' : 'p-10'
      } text-[var(--foreground)] bg-[var(--background)] min-h-screen`}
    >
      {/* Header */}
      <div
        className={`w-full flex justify-between items-center mb-6 ${
          isMobile ? 'px-2' : 'px-0'
        }`}
      >
        <h1
          className={`font-bold text-[var(--highlight)] ${
            isMobile ? 'text-xl' : 'text-3xl'
          }`}
        >
          Settings
        </h1>
        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-2xl text-[var(--highlight)]"
          >
            ☰
          </button>
        )}
      </div>

      {/* Profile Card */}
      <div
        className={`bg-[var(--accent-1)]/20 backdrop-blur-sm rounded-2xl shadow-lg border border-[var(--accent-1)] ${
          isMobile ? 'w-full max-w-sm p-5' : 'w-full max-w-md p-8'
        }`}
      >
        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <EditableAvatar
            avatarUrl={profile?.avatar_url}
            fullName={profile?.full_name}
            onClick={() => document.getElementById('avatar-input')?.click()}
            size={isMobile ? 90 : 110}
          />
          <input
            type="file"
            accept="image/*"
            id="avatar-input"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          <span className="text-xs text-[var(--text-subtle)] mt-2">
            {uploading ? 'Uploading...' : 'Tap avatar to change'}
          </span>
        </div>

        {/* Full Name */}
        <div className="space-y-2 mb-5">
          <label className="font-semibold text-[var(--text-subtle)]">Full Name</label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              readOnly={!editable}
              className={`flex-1 px-3 py-2 rounded-lg bg-[var(--accent-3)]/20 text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--highlight)] ${
                editable ? '' : 'opacity-70'
              }`}
            />
            <button
              className="text-[var(--accent-2)] hover:text-[var(--highlight)] transition"
              onClick={() => setEditable(!editable)}
              title="Edit name"
            >
              <FaCog />
            </button>
            {editable && (
              <button
                onClick={handleNameUpdate}
                className="px-3 py-1 bg-[var(--highlight)] text-[var(--foreground)] text-xs font-semibold rounded-lg hover:opacity-90 transition"
              >
                Save
              </button>
            )}
          </div>
        </div>

        {/* Role & Email */}
        <div className="text-sm text-[var(--text-subtle)] space-y-1 mb-5">
          <p>Role: {profile?.role || 'Barber'}</p>
          <p>Email: {profile?.email || ''}</p>
        </div>

        {/* Change Password Toggle */}
        <button
          onClick={() => setShowChangePassword(!showChangePassword)}
          className="w-full bg-[var(--accent-2)] text-[var(--foreground)] py-2 rounded-lg hover:bg-[var(--accent-3)] transition mb-3"
        >
          {showChangePassword ? 'Cancel Password Change' : 'Change Password'}
        </button>

        {/* Change Password Form */}
        {showChangePassword && (
          <ChangePasswordForm onSuccess={() => setShowChangePassword(false)} />
        )}

        {/* Connect Acuity Button */}
        {/* <ConnectAcuityButton/> */}

        {/* Sign Out */}
        <SignOutButton className="bg-[var(--accent-2)] hover:bg-[var(--accent-3)] text-[var(--text-bright)] w-full py-2 rounded-lg transition mt-4" />
      </div>
    </motion.div>
  )

  return (
    <OnboardingGuard>
      <Navbar />
      {isMobile ? (
        <>
          {mobileMenuOpen && renderMobileMenu()}
          {content}
        </>
      ) : (
        content
      )}
    </OnboardingGuard>
  )
}
