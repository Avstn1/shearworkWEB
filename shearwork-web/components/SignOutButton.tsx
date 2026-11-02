'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabaseClient'

interface SignOutButtonProps {
  className?: string
}

export default function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/' // instead of router.push('/')
  }


  return (
    <button
      onClick={handleSignOut}
      type="button"
      className={`btn btn-glass btn-sm ${className || ''}`}
    >
      Sign Out
    </button>
  )
}
