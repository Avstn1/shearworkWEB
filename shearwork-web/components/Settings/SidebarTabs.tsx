'use client'

import React from 'react'
import { User, Calendar, Shield, LogOut, CreditCard, Store } from 'lucide-react'

interface Props {
	activeTab: string
	setActiveTab: (tab: string) => void
}

export const SETTINGS_TABS = [
	{ id: 'profile', label: 'Profile', icon: User },
	{ id: 'acuity', label: 'Acuity', icon: Calendar },
	{ id: 'square', label: 'Square', icon: Store },
	{ id: 'security', label: 'Security', icon: Shield },
	{ id: 'billing', label: 'Billing', icon: CreditCard },
	{ id: 'logout', label: 'Logout', icon: LogOut },
]

export default function SidebarTabs({ activeTab, setActiveTab }: Props) {
	return (
		<nav aria-label="Settings" className="flex w-full flex-col gap-0.5 lg:sticky lg:top-[calc(var(--navbar-height,72px)+1.5rem)]">
			{SETTINGS_TABS.map(tab => {
				const Icon = tab.icon
				const isActive = activeTab === tab.id
				return (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						aria-current={isActive ? 'page' : undefined}
						className={`relative flex h-10 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors ${
							isActive ? 'bg-white/[0.06] text-ivory' : 'text-gray-400 hover:bg-white/[0.04] hover:text-ivory'
						}`}
					>
						{isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-sage" />}
						<Icon className={`h-[18px] w-[18px] flex-shrink-0 ${isActive ? 'text-sage-bright' : ''}`} strokeWidth={1.75} />
						<span>{tab.label}</span>
					</button>
				)
			})}
		</nav>
	)
}
