'use client'

import React from 'react'
import { User, Calendar, Shield, LogOut } from 'lucide-react'

interface Props {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export default function SidebarTabs({ activeTab, setActiveTab }: Props) {
  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'acuity', label: 'Acuity', icon: Calendar },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'logout', label: 'Logout', icon: LogOut },
  ]

  return (
    <div className="w-52 bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-xl sticky top-[100px]">
      {tabs.map(tab => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all duration-200
              ${isActive 
                ? 'bg-lime-300 text-black shadow-[0_0_10px_#c4ff85] scale-[1.03]'
                : 'hover:bg-white/5 hover:scale-[1.02]'
              }
            `}
          >
            <Icon className="w-5 h-5" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
