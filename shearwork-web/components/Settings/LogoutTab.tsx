'use client'

import React from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { LogOut } from 'lucide-react'
import { Panel } from '@/components/ui/AppKit'

export default function LogoutTab() {
  const logout = async () => {
    const loadingToast = toast.loading('Signing out...')
    await supabase.auth.signOut()
    toast.success('Logged out successfully', { id: loadingToast })
    setTimeout(() => {
      window.location.href = '/login'
    }, 500)
  }

  return (
    <Panel title="Sign out" subtitle="End your session on this device.">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-gray-300">
            You will be signed out of your account immediately and redirected to the login page.
          </p>
          <p className="text-xs text-gray-500">You can always log back in with your credentials.</p>
        </div>
        <button onClick={logout} className="btn btn-glass btn-sm shrink-0 text-[#FF8F7D]">
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Sign out
        </button>
      </div>
    </Panel>
  )
}
