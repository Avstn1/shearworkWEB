// components/Settings/SquareTab.tsx
'use client'

import React, { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import ConnectSquareButton from '../ConnectSquareButton'
import Select from '@/components/UI/Select'
import { RefreshCw, Database, Store, Users, DollarSign, Calendar } from 'lucide-react'

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
]

export default function SquareTab() {
	const [loading, setLoading] = useState(true)
	const [connected, setConnected] = useState(false)
	const [merchantId, setMerchantId] = useState<string | null>(null)
	const [connectedAt, setConnectedAt] = useState<string | null>(null)
	const [year, setYear] = useState(new Date().getFullYear().toString())
	const [syncingCustomers, setSyncingCustomers] = useState(false)
	const [syncingAll, setSyncingAll] = useState(false)

	useEffect(() => {
		loadStatus()
	}, [])

	const loadStatus = async () => {
		setLoading(true)
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser()
			if (!user) {
				setConnected(false)
				return
			}

			const res = await fetch('/api/square/status')
			const body = await res.json()

			if (res.ok && body?.connected) {
				setConnected(true)
				setMerchantId(body.merchant_id || null)
				setConnectedAt(body.connected_at || null)
			} else {
				setConnected(false)
				setMerchantId(null)
				setConnectedAt(null)
			}
		} catch (e) {
			setConnected(false)
			setMerchantId(null)
			setConnectedAt(null)
		} finally {
			setLoading(false)
		}
	}

	const handleDisconnect = async () => {
		const confirmAction = window.confirm('Disconnect Square?')
		if (!confirmAction) return

		const toastId = toast.loading('Disconnecting...')
		try {
			const res = await fetch('/api/square/disconnect', { method: 'POST' })
			const body = await res.json()

			if (!res.ok) throw new Error(body?.error || 'Disconnect failed')

			toast.success('Square disconnected', { id: toastId })
			await loadStatus()
		} catch (err: any) {
			toast.error(err.message || 'Failed to disconnect', { id: toastId })
		}
	}

	const generateYearOptions = () => {
		const currentYear = new Date().getFullYear()
		return Array.from({ length: 4 }, (_, i) => {
			const y = (currentYear - i).toString()
			return { value: y, label: y }
		})
	}

	const syncCustomers = async () => {
		setSyncingCustomers(true)
		const toastId = toast.loading('Syncing customers...')
		try {
			const res = await fetch('/api/square/pull-customers', { method: 'GET' })
			const body = await res.json()

			if (!res.ok) {
				throw new Error(body?.error || 'Customer sync failed')
			}

			toast.success(
				`Customers synced ✅ fetched ${body.totalFetched || 0}, upserted ${body.totalUpserted || 0}`,
				{ id: toastId }
			)
		} catch (err: any) {
			toast.error(err.message || 'Failed to sync customers', { id: toastId })
		} finally {
			setSyncingCustomers(false)
		}
	}

	const syncAllData = async () => {
		if (!connected) {
			toast.error('Please connect Square first')
			return
		}

		const confirmAction = window.confirm(
			`This will sync Square data for ${year}. Continue?`
		)
		if (!confirmAction) return

		setSyncingAll(true)
		const toastId = toast.loading(`Syncing Square data for ${year}...`)

		try {
			// For now, just sync customers
			const res = await fetch('/api/square/pull-customers', { method: 'GET' })
			const body = await res.json()

			if (!res.ok) {
				throw new Error(body?.error || 'Square sync failed')
			}

			toast.success(
				`Successfully synced ${body.totalUpserted || 0} customers for ${year}`,
				{ id: toastId }
			)
		} catch (err: any) {
			console.error(err)
			toast.error(`Failed to sync Square data for ${year}`, { id: toastId })
		} finally {
			setSyncingAll(false)
		}
	}

	if (loading)
		return (
			<div className="flex items-center justify-center py-12">
				<div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lime-400"></div>
			</div>
		)

	return (
		<div className="space-y-8">
			<div>
				<h2 className="text-2xl font-bold mb-2">Square Integration</h2>
				<p className="text-sm text-gray-400">
					Connect and sync your Square POS data
				</p>
			</div>

			<ConnectSquareButton onConnectSuccess={loadStatus} />

			{/* Connection Status */}
			{connected && (
				<div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
					<h3 className="text-lg font-semibold flex items-center gap-2">
						<Store className="w-5 h-5" />
						Connection Status
					</h3>

					<div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
						<div className="flex items-center justify-between">
							<div>
								<p className="font-semibold text-emerald-300">
									✓ Connected to Square
								</p>
								<p className="text-sm text-gray-400 mt-1">
									Merchant ID: {merchantId}
								</p>
								{connectedAt && (
									<p className="text-xs text-gray-500 mt-1">
										Connected on {new Date(connectedAt).toLocaleDateString()}
									</p>
								)}
							</div>
							<button
								onClick={handleDisconnect}
								className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg hover:bg-red-500/20 transition-all text-sm font-medium"
							>
								Disconnect
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Sync Section */}
			<div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
				<h3 className="text-lg font-semibold flex items-center gap-2">
					<Database className="w-5 h-5" />
					Sync & Import
				</h3>

				<div className="space-y-4">
					<div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
						<div className="w-full sm:w-32">
							<Select
								options={generateYearOptions()}
								value={year}
								onChange={(val) => setYear(val as string)}
							/>
						</div>

						<div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
							<button
								onClick={syncAllData}
								disabled={!connected || syncingAll}
								className={`px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-2 ${!connected || syncingAll
										? 'bg-white/10 text-gray-400 cursor-not-allowed'
										: 'bg-gradient-to-r from-lime-400 to-emerald-400 text-black hover:shadow-lg hover:shadow-lime-400/20'
									}`}
							>
								<RefreshCw
									className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`}
								/>
								{syncingAll ? `Syncing ${year}...` : `Sync All Data`}
							</button>

							<button
								onClick={syncCustomers}
								disabled={!connected || syncingCustomers}
								className={`px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-2 ${!connected || syncingCustomers
										? 'bg-white/10 text-gray-400 cursor-not-allowed'
										: 'bg-gradient-to-r from-lime-400 to-emerald-400 text-black hover:shadow-lg hover:shadow-lime-400/20'
									}`}
							>
								<RefreshCw
									className={`w-4 h-4 ${syncingCustomers ? 'animate-spin' : ''}`}
								/>
								{syncingCustomers ? 'Syncing...' : 'Sync Customers'}
							</button>
						</div>
					</div>

					<p className="text-xs text-gray-500">
						Customers are synced into the <code>square_clients</code> table. Revenue and order data coming soon.
					</p>
				</div>
			</div>

			{/* Coming Soon Section */}
			<div className="bg-white/5 border border-white/10 rounded-2xl p-6">
				<h3 className="text-lg font-semibold mb-3">Coming Soon</h3>

				<div className="space-y-4">
					{/* Revenue & Orders */}
					<div className="flex items-start gap-4 p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl">
						<div className="p-2 bg-amber-500/10 rounded-lg">
							<DollarSign className="w-5 h-5 text-amber-400" />
						</div>
						<div>
							<h4 className="font-semibold text-amber-300">Revenue & Orders</h4>
							<p className="text-sm text-gray-400 mt-1">
								Track sales transactions, service history, and revenue analytics.
							</p>
						</div>
					</div>

					{/* Payment Details */}
					<div className="flex items-start gap-4 p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl">
						<div className="p-2 bg-amber-500/10 rounded-lg">
							<Calendar className="w-5 h-5 text-amber-400" />
						</div>
						<div>
							<h4 className="font-semibold text-amber-300">Payment Analytics</h4>
							<p className="text-sm text-gray-400 mt-1">
								Detailed payment tracking, tips analysis, and financial reporting.
							</p>
						</div>
					</div>

					{/* Customer Insights */}
					<div className="flex items-start gap-4 p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl">
						<div className="p-2 bg-amber-500/10 rounded-lg">
							<Users className="w-5 h-5 text-amber-400" />
						</div>
						<div>
							<h4 className="font-semibold text-amber-300">Customer Insights</h4>
							<p className="text-sm text-gray-400 mt-1">
								Advanced customer analytics, purchase patterns, and loyalty tracking.
							</p>
						</div>
					</div>
				</div>
			</div>

			{/* Currently Synced */}
			<div className="bg-white/5 border border-white/10 rounded-2xl p-6">
				<h3 className="text-lg font-semibold mb-3">Currently Synced</h3>
				<ul className="space-y-3 text-sm text-gray-400">
					<li className="flex items-start gap-3">
						<div className="w-2 h-2 bg-lime-400 rounded-full mt-2"></div>
						<p>Customer contact information (name, email, phone)</p>
					</li>
					<li className="flex items-start gap-3">
						<div className="w-2 h-2 bg-lime-400 rounded-full mt-2"></div>
						<p>Basic customer profiles and contact details</p>
					</li>
					<li className="flex items-start gap-3">
						<div className="w-2 h-2 bg-lime-400 rounded-full mt-2"></div>
						<p>Stored in <code>square_clients</code> table for unified client management</p>
					</li>
				</ul>
			</div>
		</div>
	)
}
