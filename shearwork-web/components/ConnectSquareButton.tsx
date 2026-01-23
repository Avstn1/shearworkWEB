// components/ConnectSquareButton.tsx
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

interface ConnectSquareButtonProps {
	onConnectSuccess?: () => void
	onBeforeConnect?: () => Promise<boolean | void>
	disabled?: boolean
	disabledReason?: string
	className?: string
	variant?: 'primary' | 'secondary'
}

export default function ConnectSquareButton({
	onConnectSuccess,
	onBeforeConnect,
	disabled = false,
	disabledReason,
	className = '',
	variant = 'primary',
}: ConnectSquareButtonProps) {
	const [connecting, setConnecting] = useState(false)
	const baseClass =
		variant === 'secondary'
			? 'bg-white/10 border border-white/20 text-white hover:bg-white/15'
			: 'bg-blue-600 text-white hover:bg-blue-700'

	const connectSquare = async () => {
		if (disabled || connecting) return
		setConnecting(true)
		try {
			if (onBeforeConnect) {
				const result = await onBeforeConnect()
				if (result === false) {
					setConnecting(false)
					return
				}
			}
			// This will redirect to Square OAuth
			window.location.href = '/api/square/connect'
		} catch (err: any) {
			toast.error(err.message || 'Failed to connect Square')
			setConnecting(false)
		}
	}

	return (
		<button
			type="button"
			onClick={connectSquare}
			disabled={connecting || disabled}
			title={disabledReason}
			className={`px-4 py-2 rounded-lg ${baseClass} ${
				connecting || disabled ? 'opacity-60 cursor-not-allowed' : ''
			} ${className}`}
		>
			{connecting ? 'Connecting...' : 'Connect to Square'}
		</button>
	)
}
