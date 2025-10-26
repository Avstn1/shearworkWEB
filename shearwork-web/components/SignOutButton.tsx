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
      className={`bg-[var(--accent-3)] text-[var(--text-bright)] py-2 px-4 rounded-lg font-semibold shadow-md hover:bg-[var(--accent-1)] hover:text-[var(--foreground)] transition ${className || ''}`}
    >
      Sign Out
    </button>
  )
}
