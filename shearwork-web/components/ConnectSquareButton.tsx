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
		<div className="bg-white/5 border border-white/10 rounded-2xl p-6">
			<div className="flex items-center gap-4 mb-4">
				<div className="w-12 h-12 bg-[#00B464] rounded-xl flex items-center justify-center">
					<svg className="w-8 h-8" viewBox="0 0 24 24" fill="white">
						<path d="M4.5 3H9v18H4.5C3.67 21 3 20.33 3 19.5v-15C3 3.67 3.67 3 4.5 3zM19.5 3H15v18h4.5c.83 0 1.5-.67 1.5-1.5v-15c0-.83-.67-1.5-1.5-1.5z" />
					</svg>
				</div>
				<div>
					<h3 className="text-lg font-semibold">Square POS</h3>
					<p className="text-sm text-gray-400">
						Connect your Square account to sync customer data
					</p>
				</div>
			</div>

			<button
				onClick={connectSquare}
				disabled={connecting}
				className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${connecting
						? 'bg-white/10 text-gray-400 cursor-not-allowed'
						: 'bg-gradient-to-r from-[#00B464] to-emerald-500 text-white hover:shadow-lg hover:shadow-emerald-500/20'
					}`}
			>
				{connecting ? (
					<>
						<div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
						Connecting...
					</>
				) : (
					'Connect Square Account'
				)}
			</button>

			<p className="text-xs text-gray-500 mt-3 text-center">
				You'll be redirected to Square to authorize access
			</p>
		</div>
	)
}
