// components/Settings/SquareTab.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import ConnectSquareButton from '../ConnectSquareButton'
import Select from '@/components/UI/Select'
import { ChevronDown, Database, Loader2, RefreshCw, Store } from 'lucide-react'
import { Panel } from '@/components/ui/AppKit'

interface SquareLocation {
	location_id: string
	name: string | null
	timezone: string | null
	status: string | null
	is_active: boolean
	selected: boolean
}


export default function SquareTab() {
	const [loading, setLoading] = useState(true)
	const [connected, setConnected] = useState(false)
	const [acuityConnected, setAcuityConnected] = useState(false)
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

			const acuityRes = await fetch('/api/acuity/status', { cache: 'no-store' })
			const acuityData = acuityRes.ok ? await acuityRes.json() : null
			setAcuityConnected(Boolean(acuityData?.connected))

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
			setAcuityConnected(false)
			setLocations([])
			setInitialLocationIds([])
			setConfirmingLocationChange(false)
		} finally {
			setLoading(false)
		}
	}

	const handleBeforeConnect = async () => {
		if (!acuityConnected) return true
		const toastId = toast.loading('Disconnecting Acuity...')
		const res = await fetch('/api/acuity/disconnect', { method: 'POST' })
		if (!res.ok) {
			toast.error('Failed to disconnect Acuity', { id: toastId })
			return false
		}
		toast.success('Acuity disconnected', { id: toastId })
		setAcuityConnected(false)
		return true
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
			// One full-year sync (limited to a couple per hour) rather than 12 month syncs
			const res = await fetch(
				`/api/pull?granularity=year&year=${encodeURIComponent(year)}&force=1`
			)
			const body = await res.json().catch(() => ({}))

			if (!res.ok) {
				throw new Error(body?.error || `Sync failed for ${year}`)
			}

			toast.success(`Synced data for all of ${year}`, { id: toastId })
		} catch (err: any) {
			console.error(err)
			toast.error(`Failed to sync Square data for ${year}: ${err?.message || 'Unknown error'}`, { id: toastId })
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
			<div className="panel flex items-center justify-center py-16">
				<Loader2 className="h-5 w-5 animate-spin text-sage" strokeWidth={1.75} />
			</div>
		)

	return (
		<div className="space-y-4 md:space-y-5">
			{/* Connection */}
			<Panel
				title="Square integration"
				subtitle="Connect and sync your Square POS data"
				actions={
					connected
						? <span className="badge badge-sage">Connected</span>
						: <span className="badge">Not connected</span>
				}
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1 text-[13px]">
						{connected ? (
							<p className="text-muted">Your Square account is linked to Corva.</p>
						) : acuityConnected ? (
							<p className="text-amber-300">
								Connecting Square will disconnect Acuity to keep one active provider.
							</p>
						) : (
							<p className="text-muted">Connect Square to load your locations.</p>
						)}
					</div>
					<div className="flex shrink-0 justify-end">
						{connected ? (
							<button onClick={handleDisconnect} className="btn btn-glass btn-sm text-[#D99A8B]">
								Disconnect Square
							</button>
						) : (
							<ConnectSquareButton onConnectSuccess={loadStatus} onBeforeConnect={handleBeforeConnect} />
						)}
					</div>
				</div>
			</Panel>

			{/* Locations */}
			<Panel
				title={
					<span className="flex items-center gap-2">
						<Store className="h-4 w-4 text-gray-500" strokeWidth={1.75} />
						Locations
					</span>
				}
				subtitle="If no locations are selected, all active locations will sync."
			>
				{!connected ? (
					<p className="text-[13px] text-muted">Connect Square to load locations.</p>
				) : loadingLocations ? (
					<div className="flex items-center justify-center py-6">
						<Loader2 className="h-5 w-5 animate-spin text-sage" strokeWidth={1.75} />
					</div>
				) : (
					<div>
						<label className="field-label">Locations to sync</label>
						<div className="flex flex-col gap-3 sm:flex-row">
							<div className="relative flex-1" ref={locationDropdownRef}>
								<button
									type="button"
									onClick={() =>
										locations.length > 0 ? setLocationDropdownOpen((prev) => !prev) : null
									}
									className="field flex items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-50"
									disabled={locations.length === 0}
								>
									<span className="truncate">
										{locations.length === 0 ? 'No locations found' : locationLabel}
									</span>
									<ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 text-gray-500" strokeWidth={1.75} />
								</button>

								{locationDropdownOpen && (
									<div className="modal-surface absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto py-1">
										{locations.length === 0 ? (
											<p className="px-3 py-2 text-sm text-muted">No locations available.</p>
										) : (
											locations.map((location) => (
												<label
													key={location.location_id}
													className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-white/[0.04]"
												>
													<input
														type="checkbox"
														checked={location.selected}
														onChange={() => toggleLocation(location.location_id)}
														className="mt-0.5 h-4 w-4"
													/>
													<div>
														<p className="text-sm font-medium text-ivory">
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

							<div className="flex justify-end gap-2">
								<button
									onClick={loadLocations}
									disabled={loadingLocations}
									className="btn btn-ghost btn-sm h-10"
								>
									Refresh
								</button>
								<button
									onClick={saveLocations}
									disabled={savingLocations}
									className="btn btn-primary btn-sm h-10"
								>
									{savingLocations ? 'Saving...' : 'Save'}
								</button>
							</div>
						</div>
					</div>
				)}

				{confirmingLocationChange && (
					<div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-[13px] text-amber-300">
							Changing your locations will sync data for the new selection.
						</p>

						<div className="flex shrink-0 justify-end gap-2">
							<button
								onClick={() => {
									resetLocationSelection()
									setConfirmingLocationChange(false)
									setLocationDropdownOpen(false)
								}}
								className="btn btn-ghost btn-sm"
							>
								Cancel
							</button>

							<button
								onClick={saveLocations}
								disabled={savingLocations}
								className="btn btn-primary btn-sm"
							>
								{savingLocations ? 'Saving...' : 'Confirm Change'}
							</button>
						</div>
					</div>
				)}
			</Panel>

			{/* Sync */}
			<Panel
				title={
					<span className="flex items-center gap-2">
						<Database className="h-4 w-4 text-gray-500" strokeWidth={1.75} />
						Sync & import
					</span>
				}
				subtitle="Sync appointments and payments to refresh revenue reporting."
			>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div className="w-full sm:w-36">
						<label className="field-label">Year</label>
						<Select
							options={generateYearOptions()}
							value={year}
							onChange={(val) => setYear(val as string)}
						/>
					</div>

					<button
						onClick={syncYear}
						disabled={!connected || syncingAll}
						className="btn btn-primary btn-sm h-10 self-end"
					>
						<RefreshCw
							className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`}
							strokeWidth={1.75}
						/>
						{syncingAll ? `Syncing ${year}...` : `Sync All Appointments`}
					</button>
				</div>
			</Panel>
		</div>
	)
}
