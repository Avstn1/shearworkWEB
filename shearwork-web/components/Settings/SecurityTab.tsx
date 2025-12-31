'use client'

import React, { useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { Lock, Key } from 'lucide-react'

export default function SecurityTab() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Security</h2>
        <p className="text-sm text-gray-400">Update your password to keep your account secure</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Current Password
          </label>
          <input
            type="password"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-400/50 transition-all"
            value={oldPassword}
            onChange={e => setOldPassword(e.target.value)}
            placeholder="Enter current password"
          />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Key className="w-4 h-4" />
            New Password
          </label>
          <input
            type="password"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-400/50 transition-all"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Enter new password (min. 6 characters)"
          />
          <p className="text-xs text-gray-500">Password must be at least 6 characters long</p>
        </div>

        <button 
          className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-lime-400 to-emerald-400 text-black font-semibold rounded-xl hover:shadow-lg hover:shadow-lime-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
          onClick={updatePassword} 
          disabled={loading}
        >
          {loading ? 'Updating Password...' : 'Update Password'}
        </button>
      </div>
    </div>
  )
}