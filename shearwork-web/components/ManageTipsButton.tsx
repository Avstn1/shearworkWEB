'use client'

import { useRouter } from 'next/navigation'
import { Wallet } from 'lucide-react'

export default function ManageTipsButton() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.push('/appointment-manager')}
      className="btn btn-glass btn-sm"
    >
      <Wallet className="h-4 w-4" strokeWidth={1.75} />
      Manage Tips
    </button>
  )
}
