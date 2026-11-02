'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
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
  const [messageColor, setMessageColor] = useState('text-[#D99A8B]')
  const [showPasswords, setShowPasswords] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation don't match")
      setMessageColor('text-[#D99A8B]')
      return
    }

    if (!newPassword) {
      setMessage("New password cannot be empty")
      setMessageColor('text-[#D99A8B]')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setMessage(`Error: ${error.message}`)
        setMessageColor('text-[#D99A8B]')
      } else {
        setMessage('Password updated successfully!')
        setMessageColor('text-sage-bright')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')

        if (onSuccess) onSuccess() // hide form
      }
    } catch (err: any) {
      setMessage(`Unexpected error: ${err.message}`)
      setMessageColor('text-[#D99A8B]')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleChangePassword}
      className="panel panel-body flex w-full max-w-md flex-col gap-4"
    >
      <h2 className="panel-title flex items-center gap-2">
        <Lock className="h-4 w-4 text-gray-500" strokeWidth={1.75} />
        Change Password
      </h2>

      {message && <p className={`text-sm ${messageColor}`}>{message}</p>}

      <div>
        <label className="field-label">Current Password</label>
        <input
          type={showPasswords ? 'text' : 'password'}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="field"
        />
      </div>

      <div>
        <label className="field-label">New Password</label>
        <input
          type={showPasswords ? 'text' : 'password'}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="field"
        />
      </div>

      <div>
        <label className="field-label">Confirm New Password</label>
        <input
          type={showPasswords ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="field"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showPasswords}
          onChange={() => setShowPasswords(!showPasswords)}
          id="show-passwords"
        />
        <label htmlFor="show-passwords" className="text-[13px] text-muted">
          Show passwords
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary btn-sm self-end"
      >
        {loading ? 'Updating...' : 'Change Password'}
      </button>
    </form>
  )
}
