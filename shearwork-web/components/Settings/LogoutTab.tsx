'use client'

import React from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

export default function LogoutTab() {
  const logout = async () => {
    toast.success('Logging out...')
    await supabase.auth.signOut()
    setTimeout(() => {
      window.location.href = '/login'
    }, 700)
  }

  const dangerBtn = 'px-6 py-2 bg-gradient-to-r from-[#ff7a7a] to-[#ff3a3a] text-black font-semibold rounded-xl hover:shadow-[0_0_15px_#ff3a3a] transition-all'

  return (
    <div className="text-center space-y-6">
      <h2 className="text-xl font-bold">Logout</h2>

      <p className="text-sm text-gray-400">
        You will be signed out of your account immediately.
      </p>

      <button onClick={logout} className={dangerBtn}>
        Logout
      </button>
    </div>
  )
}
