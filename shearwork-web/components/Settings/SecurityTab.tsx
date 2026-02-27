'use client'

import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { Lock, Key, Smartphone, Monitor, Clock, MapPin, Trash2, AlertTriangle, CreditCard, ArrowRight } from 'lucide-react'

interface UserDevice {
  id: string
  user_id: string
  device_type: 'web' | 'mobile'
  device_id: string
  device_name: string
  session_id: string
  last_login: string
  last_active: string
  ip_address?: string
  user_agent?: string
  created_at: string
}

interface SecurityTabProps {
  setActiveTab: (tab: string) => void
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export default function SecurityTab({ setActiveTab }: SecurityTabProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [devices, setDevices] = useState<UserDevice[]>([])
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('')
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [showLogoutEverywhereConfirm, setShowLogoutEverywhereConfirm] = useState(false)
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false)
  const [showSubscriptionBlockModal, setShowSubscriptionBlockModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [currentUsername, setCurrentUsername] = useState<string>('')
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetchCurrentUser()
    fetchAndCleanDevices()
    const deviceId = localStorage.getItem('device_id')
    if (deviceId) setCurrentDeviceId(deviceId)
  }, [])

  const fetchCurrentUser = async () => {
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) return

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username, stripe_subscription_status')
      .eq('user_id', authData.user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return
    }

    if (profile?.username) setCurrentUsername(profile.username)
    setHasActiveSubscription(profile?.stripe_subscription_status === 'active')
  }

  const fetchAndCleanDevices = async () => {
    setLoadingDevices(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const cutoff = new Date(Date.now() - ONE_DAY_MS).toISOString()

      await supabase
        .from('user_devices')
        .delete()
        .eq('user_id', authData.user.id)
        .lt('last_active', cutoff)

      const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', authData.user.id)
        .gte('last_active', cutoff)
        .order('last_active', { ascending: false })

      if (error) throw error

      const seen = new Set<string>()
      const unique = (data || []).filter((device) => {
        if (seen.has(device.device_id)) return false
        seen.add(device.device_id)
        return true
      })

      setDevices(unique)
    } catch (err) {
      console.error('Error fetching devices:', err)
      toast.error('Failed to load devices')
    } finally {
      setLoadingDevices(false)
    }
  }

  const handleDeleteAccountClick = () => {
    setDeleteConfirmText('')
    if (hasActiveSubscription) {
      setShowSubscriptionBlockModal(true)
    } else {
      setShowDeleteAccountConfirm(true)
    }
  }

  const removeAllOtherDevices = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
      if (signOutError) throw signOutError

      await supabase
        .from('user_devices')
        .delete()
        .eq('user_id', authData.user.id)
        .neq('device_id', currentDeviceId)

      toast.success('All other devices logged out successfully')
      setShowDeleteAllConfirm(false)
      fetchAndCleanDevices()
    } catch (err) {
      console.error('Error removing devices:', err)
      toast.error('Failed to logout other sessions')
    }
  }

  const logoutEverywhere = async () => {
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })
      if (signOutError) throw signOutError

      const { data: authData } = await supabase.auth.getUser()
      if (authData.user) {
        await supabase.from('user_devices').delete().eq('user_id', authData.user.id)
      }

      toast.success('Logged out from all devices')
      setShowLogoutEverywhereConfirm(false)
      window.location.href = '/login'
    } catch (err) {
      console.error('Error logging out everywhere:', err)
      toast.error('Failed to logout from all devices')
    }
  }

  const deleteAccount = async () => {
    setDeletingAccount(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authData.user.id }),
      })

      if (!res.ok) {
        const body = await res.json()
        if (res.status === 403 && body?.code === 'active_subscription') {
          setShowDeleteAccountConfirm(false)
          setShowSubscriptionBlockModal(true)
          return
        }
        throw new Error(body?.error || 'Failed to delete account')
      }

      await supabase.auth.signOut()
      toast.success('Account deleted successfully')
      window.location.href = '/login'
    } catch (err) {
      console.error('Error deleting account:', err)
      toast.error('Failed to delete account. Please try again.')
    } finally {
      setDeletingAccount(false)
    }
  }

  const updatePassword = async () => {
    if (!oldPassword) return toast.error('Enter your current password')
    if (!newPassword || newPassword.length < 6)
      return toast.error('New password must be at least 6 characters')

    setLoading(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      const email = authData.user?.email
      if (!email) {
        setLoading(false)
        return toast.error('Not logged in')
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword,
      })

      if (signInError) {
        setLoading(false)
        return toast.error('Incorrect current password')
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        console.error(updateError)
        setLoading(false)
        return toast.error('Failed to update password')
      }

      toast.success('Password updated successfully!')
      setOldPassword('')
      setNewPassword('')
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong')
    }
    setLoading(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    return `${diffHours}h ago`
  }

  const requiredDeletePhrase = `delete ${currentUsername}`
  const deleteConfirmValid = deleteConfirmText === requiredDeletePhrase

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Security</h2>
        <p className="text-sm text-gray-400">Manage your password and active sessions</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
        {/* Active Sessions */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div>
              <h3 className="text-base font-semibold">Active Sessions</h3>
              <p className="text-xs text-gray-400 mt-0.5">Devices active in the last 24 hours</p>
            </div>
            <div className="flex gap-2">
              {devices.length > 1 && (
                <button
                  onClick={() => setShowDeleteAllConfirm(true)}
                  className="px-3 py-1.5 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-all whitespace-nowrap"
                >
                  Logout Others
                </button>
              )}
              <button
                onClick={() => setShowLogoutEverywhereConfirm(true)}
                className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all whitespace-nowrap"
              >
                Logout All
              </button>
            </div>
          </div>

          {loadingDevices ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-lime-400"></div>
            </div>
          ) : devices.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p className="text-sm">No active sessions</p>
            </div>
          ) : (
            <div className="overflow-y-auto space-y-2 pr-1 flex-1 min-h-0">
              {devices.map((device) => {
                const isCurrentDevice = device.device_id === currentDeviceId
                return (
                  <div
                    key={device.device_id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                      isCurrentDevice
                        ? 'bg-lime-400/5 border-lime-400/20'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className={`p-2 rounded-lg flex-shrink-0 ${isCurrentDevice ? 'bg-lime-400/10' : 'bg-white/5'}`}>
                      {device.device_type === 'mobile' ? (
                        <Smartphone className={`w-4 h-4 ${isCurrentDevice ? 'text-lime-400' : 'text-gray-400'}`} />
                      ) : (
                        <Monitor className={`w-4 h-4 ${isCurrentDevice ? 'text-lime-400' : 'text-gray-400'}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-sm font-medium text-gray-200 truncate">{device.device_name}</h4>
                        {isCurrentDevice && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-lime-400/20 text-lime-400 rounded-full flex-shrink-0">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5 text-xs text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>{formatDate(device.last_active)}</span>
                        </div>
                        {device.ip_address && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{device.ip_address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Change Password */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col">
            <h3 className="text-base font-semibold mb-1">Change Password</h3>
            <p className="text-xs text-gray-400 mb-4">Update your account password</p>

            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Current Password
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400/50 transition-all"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  New Password
                </label>
                <input
                  type="password"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400/50 transition-all"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                />
                <p className="text-[10px] text-gray-500">Password must be at least 6 characters</p>
              </div>
            </div>

            <button
              className="w-full mt-4 px-4 py-2.5 text-sm bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-lg hover:shadow-lg hover:shadow-lime-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={updatePassword}
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-base font-semibold text-red-400">Danger Zone</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Permanently delete your account and all associated data. This cannot be undone. You will still need to confirm after clicking the button below.
            </p>
            <button
              onClick={handleDeleteAccountClick}
              className="w-full px-4 py-2.5 text-sm bg-red-500/10 text-red-400 border border-red-500/30 font-semibold rounded-lg hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* Subscription Block Modal */}
      {mounted && showSubscriptionBlockModal && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-md w-full">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                <CreditCard className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Active Subscription</h3>
                <p className="text-xs text-gray-500">You must cancel your plan before deleting your account</p>
              </div>
            </div>

            {/* Body */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-5 space-y-2 text-sm text-gray-300">
              <p>
                Your account currently has an{' '}
                <span className="text-yellow-400 font-semibold">active Corva subscription</span>.
                Account deletion is not available while a subscription is active.
              </p>
              <p className="text-gray-500 text-xs">
                After cancelling, your access continues until the end of the billing period.
                You can then return here to permanently delete your account.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubscriptionBlockModal(false)}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm font-medium text-gray-300"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowSubscriptionBlockModal(false)
                  setActiveTab('billing')
                }}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-lime-400 to-emerald-400 text-black hover:shadow-lg hover:shadow-lime-400/20"
              >
                <CreditCard className="w-4 h-4" />
                Manage Billing
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Logout Others Modal */}
      {mounted && showDeleteAllConfirm && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Logout All Other Devices?</h3>
            <p className="text-sm text-gray-400 mb-6">
              This will <span className="text-white font-medium">immediately log out</span> all devices except your current one.
              You'll need to log back in on those devices.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={removeAllOtherDevices}
                className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-lg transition-all text-sm font-medium"
              >
                Logout Others
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Logout Everywhere Modal */}
      {mounted && showLogoutEverywhereConfirm && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Logout From All Devices?</h3>
            <p className="text-sm text-gray-400 mb-6">
              This will <span className="text-white font-medium">immediately log you out</span> from all devices, including this one.
              You'll be redirected to the login page.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutEverywhereConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={logoutEverywhere}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg transition-all text-sm font-medium"
              >
                Logout All
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Account Modal */}
      {mounted && showDeleteAccountConfirm && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-red-500/30 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-500/10 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-400">Delete Account</h3>
                <p className="text-xs text-gray-500">This action is permanent and irreversible</p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-5 space-y-2.5 text-sm text-gray-300">
              <p>Deleting your account will permanently erase all of your Corva data, including:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-400 text-xs">
                <li>Your barbershop profile and account settings</li>
                <li>All clients and their visit history</li>
                <li>All appointments and booking records</li>
                <li>All expenses and reports</li>
                <li>All SMS campaigns, credits, and message history</li>
                <li>All analytics and performance data</li>
                <li>Your subscription and billing history</li>
              </ul>
              <p className="text-red-400 font-semibold text-xs pt-1">
                ⚠ Clicking &quot;Delete My Account&quot; is the final step.
              </p>
              <p className="text-red-400 font-semibold text-xs">
                ⚠ Corva support cannot restore anything after this point.
              </p>
            </div>

            <div className="mb-5">
              <p className="text-xs text-gray-400 mb-2">
                To confirm, type{' '}
                <span className="font-mono font-semibold text-white bg-white/10 px-1.5 py-0.5 rounded">
                  delete {currentUsername}
                </span>{' '}
                below:
              </p>
              <input
                type="text"
                className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all font-mono"
                placeholder={`delete ${currentUsername}`}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onPaste={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {deleteConfirmText.length > 0 && !deleteConfirmValid && (
                <p className="text-[10px] text-red-400 mt-1.5">
                  Doesn't match — type exactly: delete {currentUsername}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteAccountConfirm(false)
                  setDeleteConfirmText('')
                }}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-sm font-medium"
                disabled={deletingAccount}
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={!deleteConfirmValid || deletingAccount}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg transition-all text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deletingAccount ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete My Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}