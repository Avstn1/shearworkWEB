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
import toast from 'react-hot-toast'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

interface ProfileData {
  full_name: string
  avatar_url: string
  role: string
  email: string
}

const MOBILE_BREAKPOINT = 768
const fadeInUp = { hidden: { opacity: 0, y: 20 }, visible: (i = 1) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }) }

// ----- ChangePasswordForm -----
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
      setMessage("Passwords don't match")
      return
    }
    if (!newPassword) {
      setMessageColor('red')
      setMessage("Password cannot be empty")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) setMessageColor('red'), setMessage(error.message)
      else {
        setMessageColor('green')
        setMessage('Password updated successfully!')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => onSuccess(), 1500)
      }
    } catch (err: any) {
      setMessageColor('red')
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.form
      onSubmit={handleChangePassword}
      initial="hidden"
      animate="visible"
      variants={fadeInUp}
      className="flex flex-col gap-4 bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-xl mt-4"
    >
      <h2 className="font-semibold text-[var(--highlight)] text-lg mb-2">🔒 Change Password</h2>
      {message && <p className={`text-sm ${messageColor === 'green' ? 'text-green-400' : 'text-red-400'}`}>{message}</p>}

      {['Current Password', 'New Password', 'Confirm Password'].map((label, idx) => {
        const value = idx === 0 ? currentPassword : idx === 1 ? newPassword : confirmPassword
        const setter = idx === 0 ? setCurrentPassword : idx === 1 ? setNewPassword : setConfirmPassword
        return (
          <div key={idx} className="flex flex-col gap-2">
            <label className="text-sm text-[#bdbdbd]">{label}</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[var(--highlight)] border border-white/20"
            />
          </div>
        )
      })}

      <div className="flex items-center gap-2">
        <input type="checkbox" checked={showPasswords} onChange={() => setShowPasswords(!showPasswords)} id="show-passwords" />
        <label htmlFor="show-passwords" className="text-sm text-[#bdbdbd]">Show passwords</label>
      </div>

      <button type="submit" disabled={loading} className="bg-[var(--highlight)] text-black py-2 px-4 rounded-full hover:opacity-90 transition disabled:opacity-50">
        {loading ? 'Updating...' : 'Change Password'}
      </button>
    </motion.form>
  )
}

// ----- SettingsPage -----
export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [fullName, setFullName] = useState('')
  const [editable, setEditable] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [clientSyncing, setClientSyncing] = useState(false)
  const [commissionRate, setCommissionRate] = useState<number | null>(null)
  const [editingCommission, setEditingCommission] = useState(false)
  const [barberType, setBarberType] = useState<string | null>(null)

  const isMobile = useIsMobile(MOBILE_BREAKPOINT)

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
      if (data) {
        setProfile({
          full_name: data.full_name ?? 'User',
          avatar_url: data.avatar_url ?? '',
          role: data.role ?? 'Barber',
          email: user.email ?? '',
        })
        setFullName(data.full_name ?? '')
        setCommissionRate(data.commission_rate ? data.commission_rate * 100 : null)
        setBarberType(data.barber_type ?? null)
      }
      setLoading(false)
    }
    fetchProfile()
  }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const fileName = `${user.id}_${Date.now()}`
      await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('user_id', user.id)
      setProfile({ ...profile, avatar_url: urlData.publicUrl })
    } catch (err: any) {
      console.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleNameUpdate = async () => {
    if (!profile) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('profiles').update({ full_name: fullName }).eq('user_id', user.id)
    setProfile({ ...profile, full_name: fullName })
    setEditable(false)
  }

  const handleCommissionUpdate = async () => {
    if (!profile || commissionRate === null) return;
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('profiles').update({ commission_rate: commissionRate / 100 }).eq('user_id', user.id)
    toast.success('Commission rate updated!')
    setEditingCommission(false)
  }

  const handleClientSync = async () => {
    if (!profile) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !selectedYear) return

    setClientSyncing(true)
    toast.loading(`Syncing clients for ${selectedYear}...`, { id: 'client-sync' })

    try {
      const res = await fetch(`/api/acuity/pull-clients?year=${selectedYear}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Client sync failed')

      toast.success(`✅ Successfully synced ${data.totalClients} clients for ${selectedYear}!`, { id: 'client-sync' })
    } catch (err: any) {
      console.error('Client sync failed:', err)
      toast.error(`Failed to sync clients for ${selectedYear}.`, { id: 'client-sync' })
    } finally {
      setClientSyncing(false)
    }
  }

  const handleFullAcuitySync = async () => {
    if (!profile) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !selectedYear) return

    setSyncing(true)
    toast.loading(`Syncing ${selectedYear} data...`, { id: 'acuity-sync' })

    try {
      for (const month of MONTHS) {
        try {
          const res = await fetch(`/api/acuity/pull?endpoint=appointments&month=${encodeURIComponent(month)}&year=${selectedYear}`)
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Acuity fetch failed')
        } catch (err) {
          console.error(`Error fetching ${month}:`, err)
        }
      }
      toast.success(`✅ Successfully synced ${selectedYear} data!`, { id: 'acuity-sync' })
    } catch (err: any) {
      console.error('Full year sync failed:', err)
      toast.error(`Failed to sync ${selectedYear} data.`, { id: 'acuity-sync' })
    } finally {
      setSyncing(false)
    }
  }

  if (loading)
    return <div className="flex justify-center items-center h-screen text-white">Loading profile...</div>

  const renderMobileMenu = () => (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/40" onClick={() => setMobileMenuOpen(false)} />
      <div className="relative bg-[var(--accent-2)] p-4 w-64 shadow-lg flex flex-col min-h-full z-50">
        <div className="flex justify-between items-center mb-6">
          <span className="text-[var(--highlight)] text-2xl font-bold">⚙️ Settings</span>
          <button onClick={() => setMobileMenuOpen(false)} className="text-[var(--text-bright)] text-xl">✕</button>
        </div>
        <nav className="flex flex-col space-y-3 flex-1">
          <Link href="/dashboard" className="text-[var(--text-bright)] text-lg font-semibold hover:text-[var(--highlight)]" onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>
        </nav>
        <div className="mt-auto w-full"><SignOutButton className="w-full" /></div>
      </div>
    </div>
  )

  const cardClass = 'bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 flex flex-col'

  return (
    <OnboardingGuard>
      <Navbar />
      {isMobile && mobileMenuOpen && renderMobileMenu()}

      <motion.div
        initial="hidden"
        animate="visible"
        className="min-h-screen flex flex-col p-4 pt-[100px] bg-gradient-to-br from-[#0e100f] via-[#1a1e18] to-[#2b3a29] text-[var(--foreground)] gap-4"
      >
        <motion.h1 variants={fadeInUp} custom={0} className={`font-bold text-[var(--highlight)] ${isMobile ? 'text-xl' : 'text-3xl'}`}>
          Settings
        </motion.h1>

        <motion.div variants={fadeInUp} custom={1} className={cardClass}>
          <EditableAvatar avatarUrl={profile?.avatar_url} fullName={profile?.full_name} onClick={() => document.getElementById('avatar-input')?.click()} size={isMobile ? 90 : 110} />
          <input type="file" accept="image/*" id="avatar-input" className="hidden" onChange={handleUpload} />
          <span className="text-xs text-[#bdbdbd] mt-2">{uploading ? 'Uploading...' : 'Tap avatar to change'}</span>

          <div className="mt-4 flex flex-col gap-2">
            <label className="text-sm text-[#bdbdbd] font-semibold">Full Name</label>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                readOnly={!editable}
                className={`flex-1 px-3 py-2 rounded-lg bg-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--highlight)] ${editable ? '' : 'opacity-70'}`}
              />
              <button className="text-[var(--accent-2)] hover:text-[var(--highlight)] transition" onClick={() => setEditable(!editable)} title="Edit name">
                <FaCog />
              </button>
              {editable && (
                <button onClick={handleNameUpdate} className="px-3 py-1 bg-[var(--highlight)] text-black text-xs font-semibold rounded-full hover:opacity-90 transition">
                  Save
                </button>
              )}
            </div>
          </div>

          {/* Commission Rate Input */}
          {barberType === "commission" && (
            <div className="mt-4 flex flex-col gap-2">
              <label className="text-sm text-[#bdbdbd] font-semibold">Commission Rate (%)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={commissionRate ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setCommissionRate(null);
                    } else if (/^\d{0,3}$/.test(value) && Number(value) <= 100) {
                      setCommissionRate(Number(value));
                    }
                  }}
                  readOnly={!editingCommission}
                  min={0}
                  max={100}
                  step={0.01}
                  className={`flex-1 px-3 py-2 rounded-lg bg-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--highlight)] ${editingCommission ? '' : 'opacity-70'}`}
                />
                <button
                  className="text-[var(--accent-2)] hover:text-[var(--highlight)] transition"
                  onClick={() => setEditingCommission(!editingCommission)}
                >
                  <FaCog />
                </button>
                {editingCommission && (
                  <button
                    onClick={handleCommissionUpdate}
                    className="px-3 py-1 bg-[var(--highlight)] text-black text-xs font-semibold rounded-full hover:opacity-90 transition"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="text-sm text-[#bdbdbd] mt-3 space-y-1">
            <p>Role: {profile?.role}</p>
            <p>Email: {profile?.email}</p>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} custom={2} className={cardClass}>
          <button onClick={() => setShowChangePassword(!showChangePassword)} className="w-full bg-white/10 text-white py-2 rounded-full hover:bg-white/20 transition mb-3">
            {showChangePassword ? 'Cancel Password Change' : 'Change Password'}
          </button>
          {showChangePassword && <ChangePasswordForm onSuccess={() => setShowChangePassword(false)} />}
        </motion.div>

        <motion.div variants={fadeInUp} custom={3} className={cardClass}>
          <ConnectAcuityButton onConnectSuccess={handleFullAcuitySync} />
          <div className="flex flex-col gap-2 mt-4">
            <label className="text-sm text-[#bdbdbd] font-semibold">Select Year to Sync</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg bg-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--highlight)] border border-white/20"
            >
              {Array.from({ length: 6 }, (_, i) => {
                const y = new Date().getFullYear() - i
                return <option key={y} value={y}>{y}</option>
              })}
            </select>
          </div>
          <button
            onClick={handleFullAcuitySync}
            disabled={syncing}
            className="mt-3 w-full bg-[var(--highlight)] text-black py-2 rounded-full hover:opacity-90 transition disabled:opacity-50"
          >
            {syncing ? `Syncing ${selectedYear}...` : `Sync ${selectedYear} Data`}
          </button>
        </motion.div>
        <motion.div variants={fadeInUp} custom={5} className={cardClass}>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-[#bdbdbd] font-semibold">Select Year for Client Sync</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 rounded-lg bg-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--highlight)] border border-white/20"
            >
              {Array.from({ length: 6 }, (_, i) => {
                const y = new Date().getFullYear() - i
                return <option key={y} value={y}>{y}</option>
              })}
            </select>
          </div>
          <button
            onClick={handleClientSync}
            disabled={clientSyncing}
            className="mt-3 w-full bg-[var(--highlight)] text-black py-2 rounded-full hover:opacity-90 transition disabled:opacity-50"
          >
            {clientSyncing ? `Syncing clients ${selectedYear}...` : `Sync Clients for ${selectedYear}`}
          </button>
        </motion.div>

        <motion.div variants={fadeInUp} custom={4} className={cardClass}>
          <SignOutButton className="w-full bg-white/10 hover:bg-white/20 text-white py-2 rounded-full transition" />
        </motion.div>
      </motion.div>
    </OnboardingGuard>
  )
}
