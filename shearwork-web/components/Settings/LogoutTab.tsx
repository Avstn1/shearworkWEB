'use client'

import React from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { LogOut, AlertTriangle } from 'lucide-react'

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
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full space-y-6 text-center shadow-xl">
        <div className="flex justify-center">
          <div className="p-4 bg-rose-500/15 rounded-full border border-rose-500/30">
            <AlertTriangle className="w-8 h-8 text-rose-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Sign Out</h2>
          <p className="text-sm text-gray-400">
            You will be signed out of your account immediately and redirected to the login page.
          </p>
        </div>

        <button 
          onClick={logout} 
          className="w-full px-6 py-3 bg-rose-500/20 border border-rose-500/30 text-rose-100 font-semibold rounded-xl hover:bg-rose-500/30 transition-all flex items-center justify-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>

        <p className="text-xs text-gray-500">
          You can always log back in with your credentials
        </p>
      </div>
    </div>
  )
}
