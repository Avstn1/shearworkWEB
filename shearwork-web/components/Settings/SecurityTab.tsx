'use client'

import React, { useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

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

  const primaryBtn = 'px-6 py-2 bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black font-semibold rounded-xl hover:shadow-[0_0_15px_#3af1f7] transition-all disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Security</h2>

      <div>
        <label className="text-sm">Current Password</label>
        <input
          type="password"
          className="w-full p-3 mt-2 bg-black/10 border border-[var(--accent-2)] rounded-xl"
          value={oldPassword}
          onChange={e => setOldPassword(e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm">New Password</label>
        <input
          type="password"
          className="w-full p-3 mt-2 bg-black/10 border border-[var(--accent-2)] rounded-xl"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
        />
      </div>

      <button className={primaryBtn} onClick={updatePassword} disabled={loading}>
        {loading ? 'Updating...' : 'Update Password'}
      </button>
    </div>
  )
}
