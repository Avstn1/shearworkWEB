'use client'

import React from 'react'
import { User, Calendar, Shield, LogOut, CreditCard, Store } from 'lucide-react' // ← ADD Store

interface Props {
	activeTab: string
	setActiveTab: (tab: string) => void
}

export default function SidebarTabs({ activeTab, setActiveTab }: Props) {
	const tabs = [
		{ id: 'profile', label: 'Profile', icon: User },
		{ id: 'acuity', label: 'Acuity', icon: Calendar },
		{ id: 'square', label: 'Square', icon: Store }, 
		{ id: 'security', label: 'Security', icon: Shield },
		{ id: 'billing', label: 'Billing', icon: CreditCard },
		{ id: 'logout', label: 'Logout', icon: LogOut },
	]

	return (
		<nav className="w-full lg:w-64 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex flex-col gap-2 shadow-xl lg:sticky lg:top-[100px] h-fit">
			{tabs.map(tab => {
				const Icon = tab.icon
				const isActive = activeTab === tab.id
				return (
					<button
						key={tab.id}
						onClick={() => setActiveTab(tab.id)}
						className={`
              flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
              ${isActive
								? 'bg-gradient-to-r from-lime-400 to-emerald-400 text-black shadow-lg shadow-lime-400/20'
								: 'text-gray-300 hover:bg-white/10 hover:text-white'
							}
            `}
					>
						<Icon className="w-5 h-5 flex-shrink-0" />
						<span>{tab.label}</span>
					</button>
				)
			})}
		</nav>
	)
}
