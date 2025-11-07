'use client'

import React from 'react'
import UserProfile from '@/components/UserProfile'

export default function DashboardHeader() {
  return (
    <header className="flex justify-between items-center w-full">
      <div>
        <h1 className="text-4xl font-extrabold text-[var(--accent-3)]">Welcome back!</h1>
        <p className="text-[var(--text-subtle)] mt-1">Here’s your weekly overview.</p>
      </div>
      <UserProfile />
    </header>
  )
}
