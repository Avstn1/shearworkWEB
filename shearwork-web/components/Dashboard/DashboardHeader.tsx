'use client'

import React from 'react'
import UserProfile from '@/components/UserProfile'

export default function DashboardHeader({
  actions,
}: {
  actions?: React.ReactNode
}) {
  return (
    <header className="page-header w-full">
      <div className="min-w-0">
        <h1 className="page-title">Welcome back!</h1>
        <p className="page-subtitle">Here’s your weekly overview.</p>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <UserProfile />
      </div>
    </header>
  )
}
