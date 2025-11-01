'use client'

import { useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

interface ChangePasswordFormProps {
  onSuccess?: () => void
}

export default function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageColor, setMessageColor] = useState('text-red-400')
  const [showPasswords, setShowPasswords] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation don't match")
      setMessageColor('text-red-400')
      return
    }

    if (!newPassword) {
      setMessage("New password cannot be empty")
      setMessageColor('text-red-400')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setMessage(`Error: ${error.message}`)
        setMessageColor('text-red-400')
      } else {
        setMessage('Password updated successfully!')
        setMessageColor('text-green-400')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')

        if (onSuccess) onSuccess() // hide form
      }
    } catch (err: any) {
      setMessage(`Unexpected error: ${err.message}`)
      setMessageColor('text-red-400')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleChangePassword}
      className="flex flex-col gap-4 bg-[var(--accent-1)] p-5 rounded-xl shadow-md border border-[var(--accent-2)] w-full max-w-md"
    >
      <h2 className="font-semibold text-[var(--highlight)] text-lg mb-2">
        🔒 Change Password
      </h2>

      {message && <p className={`text-sm ${messageColor}`}>{message}</p>}

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
