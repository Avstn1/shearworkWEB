// components/ConnectSquareButton.tsx
'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

interface ConnectSquareButtonProps {
	onConnectSuccess?: () => void
}

export default function ConnectSquareButton({ onConnectSuccess }: ConnectSquareButtonProps) {
	const [connecting, setConnecting] = useState(false)

	const connectSquare = async () => {
		setConnecting(true)
		try {
			// This will redirect to Square OAuth
			window.location.href = '/api/square/connect'
		} catch (err: any) {
			toast.error(err.message || 'Failed to connect Square')
		} finally {
			setConnecting(false)
		}
	}

	return (
		<button
			type="button"
			onClick={connectSquare}
			disabled={connecting}
			className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ${
				connecting ? 'opacity-60 cursor-not-allowed' : ''
			}`}
		>
			{connecting ? 'Connecting...' : 'Connect to Square'}
		</button>
	)
}
