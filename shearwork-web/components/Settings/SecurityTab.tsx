'use client'

import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { Lock, Key, Smartphone, Monitor, Clock, MapPin } from 'lucide-react'

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

export default function SecurityTab() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [devices, setDevices] = useState<UserDevice[]>([])
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('')
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [showLogoutEverywhereConfirm, setShowLogoutEverywhereConfirm] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetchDevices()
    const deviceId = localStorage.getItem('device_id')
    if (deviceId) setCurrentDeviceId(deviceId)
  }, [])

  const fetchDevices = async () => {
    setLoadingDevices(true)
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .eq('user_id', authData.user.id)
        .order('last_active', { ascending: false })

      if (error) throw error
      setDevices(data || [])
    } catch (err) {
      console.error('Error fetching devices:', err)
      toast.error('Failed to load devices')
    } finally {
      setLoadingDevices(false)
    }
  }

  const removeAllOtherDevices = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      // Sign out all other sessions using Supabase's built-in scope
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })
      
      if (signOutError) {
        console.error('Error signing out other sessions:', signOutError)
        throw signOutError
      }

      // Delete the tracking records for all other devices
      const { error } = await supabase
        .from('user_devices')
        .delete()
        .eq('user_id', authData.user.id)
        .neq('device_id', currentDeviceId)

      if (error) {
        console.error('Error deleting device records:', error)
        // Don't throw - the sessions are already logged out
      }

      toast.success('All other devices logged out successfully')
      setShowDeleteAllConfirm(false)
      fetchDevices()
    } catch (err) {
      console.error('Error removing devices:', err)
      toast.error('Failed to logout other sessions')
    }
  }

  const logoutEverywhere = async () => {
    try {
      // Sign out from all sessions (including this one)
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' })
      
      if (signOutError) {
        console.error('Error signing out globally:', signOutError)
        throw signOutError
      }

      // Clear all device records
      const { data: authData } = await supabase.auth.getUser()
      if (authData.user) {
        await supabase
          .from('user_devices')
          .delete()
          .eq('user_id', authData.user.id)
      }

      toast.success('Logged out from all devices')
      setShowLogoutEverywhereConfirm(false)
      
      // Redirect to login page (user will be logged out)
      window.location.href = '/login'
    } catch (err) {
      console.error('Error logging out everywhere:', err)
      toast.error('Failed to logout from all devices')
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

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

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
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1">Security</h2>
        <p className="text-sm text-gray-400">Manage your password and active sessions</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
        {/* Active Sessions - Left Column */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold">Active Sessions</h3>
              <p className="text-xs text-gray-400 mt-0.5">Logged in devices</p>
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
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {devices.map((device) => {
                const isCurrentDevice = device.device_id === currentDeviceId
                
                return (
                  <div
                    key={device.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                      isCurrentDevice
                        ? 'bg-lime-400/5 border-lime-400/20'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${
                      isCurrentDevice ? 'bg-lime-400/10' : 'bg-white/5'
                    }`}>
                      {device.device_type === 'mobile' ? (
                        <Smartphone className={`w-4 h-4 ${
                          isCurrentDevice ? 'text-lime-400' : 'text-gray-400'
                        }`} />
                      ) : (
                        <Monitor className={`w-4 h-4 ${
                          isCurrentDevice ? 'text-lime-400' : 'text-gray-400'
                        }`} />
                      )}
                    </div>

                    {/* Device Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-sm font-medium text-gray-200 truncate">
                          {device.device_name}
                        </h4>
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

        {/* Change Password - Right Column */}
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
                onChange={e => setOldPassword(e.target.value)}
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
                onChange={e => setNewPassword(e.target.value)}
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
      </div>

      {/* Delete All Devices Confirmation Modal */}
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

      {/* Logout Everywhere Confirmation Modal */}
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
    </div>
  )
}