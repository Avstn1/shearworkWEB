'use client'

import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { Lock, Key, Smartphone, Monitor, Clock, MapPin, Trash2, AlertTriangle, CreditCard, ArrowRight, Loader2, X } from 'lucide-react'
import { EmptyState, Panel } from '@/components/ui/AppKit'

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
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        {/* Active Sessions */}
        <Panel
          title="Active sessions"
          subtitle="Devices active in the last 24 hours"
          className="flex flex-col lg:max-h-[520px]"
          bodyClassName="flex min-h-0 flex-1 flex-col"
        >
          {loadingDevices ? (
            <div className="flex flex-1 items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-sage" strokeWidth={1.75} />
            </div>
          ) : devices.length === 0 ? (
            <EmptyState icon={Monitor} title="No active sessions" />
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-white/[0.06] overflow-y-auto">
              {devices.map((device) => {
                const isCurrentDevice = device.device_id === currentDeviceId
                const DeviceIcon = device.device_type === 'mobile' ? Smartphone : Monitor
                return (
                  <li key={device.device_id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-raised">
                      <DeviceIcon className={`h-4 w-4 ${isCurrentDevice ? 'text-sage-bright' : 'text-gray-400'}`} strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <h4 className="truncate text-sm font-medium text-ivory">{device.device_name}</h4>
                        {isCurrentDevice && <span className="badge badge-sage flex-shrink-0">Current</span>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" strokeWidth={1.75} />
                          {formatDate(device.last_active)}
                        </span>
                        {device.ip_address && (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <MapPin className="h-3 w-3 flex-shrink-0" strokeWidth={1.75} />
                            <span className="truncate tabular-nums">{device.ip_address}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
            {devices.length > 1 && (
              <button onClick={() => setShowDeleteAllConfirm(true)} className="btn btn-ghost btn-sm">
                Log out others
              </button>
            )}
            <button onClick={() => setShowLogoutEverywhereConfirm(true)} className="btn btn-glass btn-sm text-[#FF8F7D]">
              Log out all
            </button>
          </div>
        </Panel>

        {/* Change Password */}
        <Panel title="Change password" subtitle="Update your account password">
          <div className="space-y-4">
            <div>
              <label className="field-label flex items-center gap-1.5" htmlFor="security-current-password">
                <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
                Current password
              </label>
              <input
                id="security-current-password"
                type="password"
                className="field"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label className="field-label flex items-center gap-1.5" htmlFor="security-new-password">
                <Key className="h-3.5 w-3.5" strokeWidth={1.75} />
                New password
              </label>
              <input
                id="security-new-password"
                type="password"
                className="field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
              />
              <p className="mt-1.5 text-xs text-gray-500">Password must be at least 6 characters</p>
            </div>

            <div className="flex justify-end pt-1">
              <button className="btn btn-primary btn-sm" onClick={updatePassword} disabled={loading}>
                {loading ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        </Panel>
      </div>

      {/* Danger Zone */}
      <section className="panel border-[#FF8F7D]/25">
        <div className="panel-body flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="panel-title flex items-center gap-2 text-[#FF8F7D]">
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
              Delete account
            </h3>
            <p className="mt-1 max-w-xl text-[13px] text-muted">
              Permanently delete your account and all associated data. This cannot be undone. You will still need to confirm after clicking the button.
            </p>
          </div>
          <button onClick={handleDeleteAccountClick} className="btn btn-glass btn-sm shrink-0 self-end text-[#FF8F7D] sm:self-auto">
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            Delete account
          </button>
        </div>
      </section>

      {/* Subscription Block Modal */}
      {mounted && showSubscriptionBlockModal && ReactDOM.createPortal(
        <div className="modal-backdrop flex items-center justify-center p-4">
          <div className="modal-surface w-full max-w-md overflow-hidden">
            <div className="panel-header">
              <div className="flex min-w-0 items-center gap-3">
                <CreditCard className="h-[18px] w-[18px] flex-shrink-0 text-amber-300" strokeWidth={1.75} />
                <div className="min-w-0">
                  <h3 className="panel-title">Active subscription</h3>
                  <p className="panel-subtitle">You must cancel your plan before deleting your account</p>
                </div>
              </div>
              <button onClick={() => setShowSubscriptionBlockModal(false)} className="btn btn-ghost btn-sm h-8 w-8 p-0" aria-label="Close">
                <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-2 p-5 text-sm text-gray-300">
              <p>
                Your account currently has an{' '}
                <span className="font-semibold text-ivory">active Corva subscription</span>.
                Account deletion is not available while a subscription is active.
              </p>
              <p className="text-xs text-gray-500">
                After cancelling, your access continues until the end of the billing period.
                You can then return here to permanently delete your account.
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
              <button onClick={() => setShowSubscriptionBlockModal(false)} className="btn btn-ghost btn-sm">
                Close
              </button>
              <button
                onClick={() => {
                  setShowSubscriptionBlockModal(false)
                  setActiveTab('billing')
                }}
                className="btn btn-primary btn-sm"
              >
                Manage billing
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Logout Others Modal */}
      {mounted && showDeleteAllConfirm && ReactDOM.createPortal(
        <div className="modal-backdrop flex items-center justify-center p-4">
          <div className="modal-surface w-full max-w-md overflow-hidden">
            <div className="panel-header">
              <h3 className="panel-title">Log out all other devices?</h3>
              <button onClick={() => setShowDeleteAllConfirm(false)} className="btn btn-ghost btn-sm h-8 w-8 p-0" aria-label="Close">
                <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <p className="p-5 text-sm text-gray-300">
              This will <span className="font-medium text-ivory">immediately log out</span> all devices except your current one.
              You'll need to log back in on those devices.
            </p>
            <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
              <button onClick={() => setShowDeleteAllConfirm(false)} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button onClick={removeAllOtherDevices} className="btn btn-primary btn-sm">
                Log out others
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Logout Everywhere Modal */}
      {mounted && showLogoutEverywhereConfirm && ReactDOM.createPortal(
        <div className="modal-backdrop flex items-center justify-center p-4">
          <div className="modal-surface w-full max-w-md overflow-hidden">
            <div className="panel-header">
              <h3 className="panel-title">Log out from all devices?</h3>
              <button onClick={() => setShowLogoutEverywhereConfirm(false)} className="btn btn-ghost btn-sm h-8 w-8 p-0" aria-label="Close">
                <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <p className="p-5 text-sm text-gray-300">
              This will <span className="font-medium text-ivory">immediately log you out</span> from all devices, including this one.
              You'll be redirected to the login page.
            </p>
            <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
              <button onClick={() => setShowLogoutEverywhereConfirm(false)} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button onClick={logoutEverywhere} className="btn btn-sm bg-[#FF8F7D] text-ink hover:bg-[#FFA394]">
                Log out all
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Account Modal */}
      {mounted && showDeleteAccountConfirm && ReactDOM.createPortal(
        <div className="modal-backdrop flex items-center justify-center p-4">
          <div className="modal-surface w-full max-w-md overflow-hidden">
            <div className="panel-header">
              <div className="flex min-w-0 items-center gap-3">
                <AlertTriangle className="h-[18px] w-[18px] flex-shrink-0 text-[#FF8F7D]" strokeWidth={1.75} />
                <div className="min-w-0">
                  <h3 className="panel-title">Delete account</h3>
                  <p className="panel-subtitle">This action is permanent and irreversible</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDeleteAccountConfirm(false)
                  setDeleteConfirmText('')
                }}
                disabled={deletingAccount}
                className="btn btn-ghost btn-sm h-8 w-8 p-0"
                aria-label="Close"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="space-y-2.5 rounded-lg border border-[#FF8F7D]/20 bg-[#FF8F7D]/[0.06] p-4 text-sm text-gray-300">
                <p>Deleting your account will permanently erase all of your Corva data, including:</p>
                <ul className="list-inside list-disc space-y-1 text-xs text-gray-400">
                  <li>Your barbershop profile and account settings</li>
                  <li>All clients and their visit history</li>
                  <li>All appointments and booking records</li>
                  <li>All expenses and reports</li>
                  <li>All SMS campaigns, credits, and message history</li>
                  <li>All analytics and performance data</li>
                  <li>Your subscription and billing history</li>
                </ul>
                <p className="pt-1 text-xs font-semibold text-[#FF8F7D]">
                  Clicking &quot;Delete My Account&quot; is the final step.
                </p>
                <p className="text-xs font-semibold text-[#FF8F7D]">
                  Corva support cannot restore anything after this point.
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs text-muted">
                  To confirm, type{' '}
                  <span className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono font-semibold text-ivory">
                    delete {currentUsername}
                  </span>{' '}
                  below:
                </p>
                <input
                  type="text"
                  className="field font-mono"
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
                  <p className="mt-1.5 text-xs text-[#FF8F7D]">
                    Doesn't match — type exactly: delete {currentUsername}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
              <button
                onClick={() => {
                  setShowDeleteAccountConfirm(false)
                  setDeleteConfirmText('')
                }}
                className="btn btn-ghost btn-sm"
                disabled={deletingAccount}
              >
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={!deleteConfirmValid || deletingAccount}
                className="btn btn-sm bg-[#FF8F7D] text-ink hover:bg-[#FFA394]"
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
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
