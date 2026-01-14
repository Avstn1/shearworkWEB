// components/Settings/SquareTab.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import ConnectSquareButton from '../ConnectSquareButton'
import Select from '@/components/UI/Select'
import { ChevronDown, Database, RefreshCw, Store } from 'lucide-react'

interface SquareLocation {
	location_id: string
	name: string | null
	timezone: string | null
	status: string | null
	is_active: boolean
	selected: boolean
}

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
	const [locations, setLocations] = useState<SquareLocation[]>([])
	const [initialLocationIds, setInitialLocationIds] = useState<string[]>([])
	const [loadingLocations, setLoadingLocations] = useState(false)
	const [savingLocations, setSavingLocations] = useState(false)
	const [confirmingLocationChange, setConfirmingLocationChange] = useState(false)
	const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
	const locationDropdownRef = useRef<HTMLDivElement>(null)
	const [year, setYear] = useState(new Date().getFullYear().toString())
	const [syncingAll, setSyncingAll] = useState(false)

	useEffect(() => {
		loadStatus()
	}, [])

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				locationDropdownRef.current &&
				!locationDropdownRef.current.contains(event.target as Node)
			) {
				setLocationDropdownOpen(false)
			}
		}

		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const loadLocations = async () => {
		setLoadingLocations(true)
		try {
			const res = await fetch('/api/square/locations', { cache: 'no-store' })
			const body = await res.json()
			if (!res.ok) {
				throw new Error(body?.error || 'Failed to load locations')
			}
			const fetchedLocations = body.locations || []
			setLocations(fetchedLocations)
			setInitialLocationIds(
				fetchedLocations.filter((loc: SquareLocation) => loc.selected).map((loc: SquareLocation) => loc.location_id)
			)
			setConfirmingLocationChange(false)
			setLocationDropdownOpen(false)
		} catch (err: any) {
			console.error(err)
			toast.error(err.message || 'Failed to load Square locations')
		} finally {
			setLoadingLocations(false)
		}
	}

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

			const res = await fetch('/api/square/status', { cache: 'no-store' })
			const body = await res.json()

			if (res.ok && body?.connected) {
				setConnected(true)
				await loadLocations()
			} else {
				setConnected(false)
				setLocations([])
				setInitialLocationIds([])
				setConfirmingLocationChange(false)
			}
		} catch (e) {
			setConnected(false)
			setLocations([])
			setInitialLocationIds([])
			setConfirmingLocationChange(false)
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
			setConnected(false)
			setLocations([])
			setInitialLocationIds([])
			setConfirmingLocationChange(false)
			setLocationDropdownOpen(false)
			await loadStatus()
		} catch (err: any) {
			toast.error(err.message || 'Failed to disconnect', { id: toastId })
		}
	}

	const getSelectedLocationIds = (list: SquareLocation[]) =>
		list.filter((location) => location.selected).map((location) => location.location_id)

	const selectionChanged = (selectedIds: string[]) => {
		if (selectedIds.length !== initialLocationIds.length) return true
		const initialSet = new Set(initialLocationIds)
		return selectedIds.some((id) => !initialSet.has(id))
	}

	const resetLocationSelection = () => {
		const initialSet = new Set(initialLocationIds)
		setLocations((prev) =>
			prev.map((location) => ({
				...location,
				selected: initialSet.has(location.location_id),
			}))
		)
	}

	const toggleLocation = (locationId: string) => {
		setLocations((prev) => {
			const next = prev.map((location) =>
				location.location_id === locationId
					? { ...location, selected: !location.selected }
					: location
			)
			const selectedIds = getSelectedLocationIds(next)
			setConfirmingLocationChange(selectionChanged(selectedIds))
			return next
		})
	}

	const saveLocations = async () => {
		setSavingLocations(true)
		const toastId = toast.loading('Saving locations...')
		try {
			const selectedLocationIds = getSelectedLocationIds(locations)

			const res = await fetch('/api/square/locations', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ selectedLocationIds }),
			})

			const body = await res.json()
			if (!res.ok) throw new Error(body?.error || 'Failed to save locations')

			setInitialLocationIds(selectedLocationIds)
			setConfirmingLocationChange(false)
			setLocationDropdownOpen(false)

			toast.success('Locations saved', { id: toastId })
		} catch (err: any) {
			toast.error(err.message || 'Failed to save locations', { id: toastId })
		} finally {
			setSavingLocations(false)
		}
	}

	const generateYearOptions = () => {
		const currentYear = new Date().getFullYear()
		return Array.from({ length: 4 }, (_, i) => {
			const y = (currentYear - i).toString()
			return { value: y, label: y }
		})
	}

	const syncYear = async () => {
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
			for (const month of MONTHS) {
				const res = await fetch(
					`/api/pull?granularity=month&month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`
				)
				const body = await res.json().catch(() => ({}))

				if (!res.ok) {
					throw new Error(body?.error || `Sync failed for ${month} ${year}`)
				}
			}

			toast.success(`Synced data for all of ${year}`, { id: toastId })
		} catch (err: any) {
			console.error(err)
			toast.error(`Failed to sync Square data for ${year}`, { id: toastId })
		} finally {
			setSyncingAll(false)
		}
	}

	const selectedLocations = locations.filter((location) => location.selected)
	const locationLabel = (() => {
		if (selectedLocations.length === 0) return 'All locations'
		if (selectedLocations.length === 1) {
			return selectedLocations[0].name || selectedLocations[0].location_id
		}
		return `${selectedLocations.length} locations selected`
	})()

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

			<div className="space-y-3">
				{connected ? (
					<button
						onClick={handleDisconnect}
						className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
					>
						Disconnect Square
					</button>
				) : (
					<ConnectSquareButton onConnectSuccess={loadStatus} />
				)}
			</div>

			<div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
				<h3 className="text-lg font-semibold flex items-center gap-2">
					<Store className="w-5 h-5" />
					Locations
				</h3>

				{!connected ? (
					<p className="text-sm text-gray-400">Connect Square to load locations.</p>
				) : loadingLocations ? (
					<div className="flex items-center justify-center py-6">
						<div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-lime-400"></div>
					</div>
				) : (
					<div className="space-y-4">
						<div className="flex flex-col sm:flex-row gap-3">
							<div className="relative flex-1" ref={locationDropdownRef}>
								<button
									type="button"
									onClick={() =>
										locations.length > 0 ? setLocationDropdownOpen((prev) => !prev) : null
									}
									className={`flex items-center justify-between p-3 rounded-xl border border-[var(--accent-2)] bg-black/90 text-white transition-all ${
										locations.length > 0
											? 'hover:bg-black/80'
											: 'opacity-50 cursor-not-allowed'
									}`}
									disabled={locations.length === 0}
								>
									<span>
										{locations.length === 0 ? 'No locations found' : locationLabel}
									</span>
									<ChevronDown className="w-4 h-4 ml-2" />
								</button>

								{locationDropdownOpen && (
									<div className="absolute left-0 right-0 mt-2 bg-black/95 border border-[var(--accent-2)] rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto">
										{locations.length === 0 ? (
											<p className="px-3 py-2 text-sm text-gray-400">No locations available.</p>
										) : (
											locations.map((location) => (
												<label
													key={location.location_id}
													className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-white/10"
												>
													<input
														type="checkbox"
														checked={location.selected}
														onChange={() => toggleLocation(location.location_id)}
														className="mt-1 h-4 w-4 accent-lime-400"
													/>
													<div>
														<p className="text-sm text-white font-medium">
															{location.name || location.location_id}
														</p>
														<p className="text-xs text-gray-500">
															{location.timezone || 'Timezone unknown'}
														</p>
													</div>
												</label>
											))
										)}
									</div>
								)}
							</div>

							<div className="flex gap-2">
								<button
									onClick={saveLocations}
									disabled={savingLocations}
									className={`px-6 py-3 rounded-xl font-semibold transition-all ${
										savingLocations
											? 'bg-white/10 text-gray-400 cursor-not-allowed'
											: 'bg-gradient-to-r from-lime-400 to-emerald-400 text-black hover:shadow-lg hover:shadow-lime-400/20'
									}`}
								>
									{savingLocations ? 'Saving...' : 'Save'}
								</button>
								<button
									onClick={loadLocations}
									disabled={loadingLocations}
									className={`px-4 py-3 rounded-xl font-semibold transition-all ${
										loadingLocations
											? 'bg-white/10 text-gray-400 cursor-not-allowed'
											: 'bg-white/10 text-white hover:bg-white/15'
									}`}
								>
									Refresh
								</button>
							</div>

						</div>

						<p className="text-xs text-gray-500">
							If no locations are selected, all active locations will sync.
						</p>
					</div>
				)}

				{confirmingLocationChange && (
					<div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
						<p className="text-sm text-amber-200">
							Changing your locations will sync data for the new selection.
						</p>

						<div className="flex gap-3">
							<button
								onClick={() => {
									resetLocationSelection()
									setConfirmingLocationChange(false)
									setLocationDropdownOpen(false)
								}}
								className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/15 transition-all font-medium"
							>

								Cancel
							</button>

							<button
								onClick={saveLocations}
								disabled={savingLocations}
								className={`px-6 py-2 rounded-xl font-semibold transition-all ${
									savingLocations
										? 'bg-white/10 text-gray-400 cursor-not-allowed'
										: 'bg-gradient-to-r from-lime-400 to-emerald-400 text-black hover:shadow-lg'
								}`}
							>
								{savingLocations ? 'Saving...' : 'Confirm Change'}
							</button>
						</div>
					</div>
				)}
			</div>

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
								onClick={syncYear}
								disabled={!connected || syncingAll}
								className={`px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap flex items-center justify-center gap-2 ${
									!connected || syncingAll
										? 'bg-white/10 text-gray-400 cursor-not-allowed'
										: 'bg-gradient-to-r from-lime-400 to-emerald-400 text-black hover:shadow-lg hover:shadow-lime-400/20'
								}`}
							>
								<RefreshCw
									className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`}
								/>
								{syncingAll ? `Syncing ${year}...` : `Sync All Appointments`}
							</button>
						</div>
					</div>

					<p className="text-xs text-gray-500">
						Sync appointments and payments to refresh revenue reporting.
					</p>
				</div>
			</div>
		</div>
	)
}
