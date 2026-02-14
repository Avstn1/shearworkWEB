'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import SyncProgressBar from '@/components/Onboarding/SyncProgressBar'

interface AcuityProps {
  userId: string
  onSyncComplete: () => void
  onSyncStateChange: (isSyncing: boolean) => void
  existingSync: {
    hasPending: boolean
    totalMonths: number
  } | null
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const generateYearOptions = () => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let i = 0; i < 10; i++) {
    years.push(currentYear - i)
  }
  return years
}

export default function Acuity({ userId, onSyncComplete, onSyncStateChange, existingSync }: AcuityProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number | ''>('')
  const [syncing, setSyncing] = useState(false)
  const [syncStarted, setSyncStarted] = useState(!!existingSync?.hasPending)
  const [totalMonths, setTotalMonths] = useState(existingSync?.totalMonths || 0)
  const [syncComplete, setSyncComplete] = useState(false)
  const [completedSyncs, setCompletedSyncs] = useState<{ month: string; year: number }[]>([])
  const [loadingCompleted, setLoadingCompleted] = useState(true)
  const [syncStartTime, setSyncStartTime] = useState<number | null>(null)

  // Load completed syncs on mount
  useEffect(() => {
    fetchCompletedSyncs()
  }, [userId])

  const fetchCompletedSyncs = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_status')
        .select('month, year, status')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('year', { ascending: true })
        .order('month', { ascending: true })

      if (!error && data) {
        setCompletedSyncs(data.map(d => ({ month: d.month, year: d.year })))
      }
    } catch (error) {
      console.error('Error fetching completed syncs:', error)
    } finally {
      setLoadingCompleted(false)
    }
  }

  // If there's an existing sync, skip the questions and show progress
  useEffect(() => {
    if (existingSync?.hasPending) {
      setSyncStarted(true)
      setTotalMonths(existingSync.totalMonths)
    }
  }, [existingSync])

  const calculateMonthsBetween = (startMonth: string | null, startYear: number) => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-11

    let start: Date
    if (startMonth) {
      const startMonthIndex = MONTHS.indexOf(startMonth)
      start = new Date(startYear, startMonthIndex, 1)
    } else {
      // If no month selected, assume January
      start = new Date(startYear, 0, 1)
    }

    const end = new Date(currentYear, currentMonth, 1)

    // Calculate months between
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
    return Math.max(1, months)
  }

  const handleStartSync = async () => {
    if (!selectedYear) {
      toast.error('Please select a year')
      return
    }

    setSyncing(true)

    try {
      // Calculate all months in range
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() // 0-11

      let start: Date
      if (selectedMonth) {
        const startMonthIndex = MONTHS.indexOf(selectedMonth)
        start = new Date(selectedYear as number, startMonthIndex, 1)
      } else {
        start = new Date(selectedYear as number, 0, 1)
      }

      const end = new Date(currentYear, currentMonth, 1)

      // Calculate all months
      const allMonths: { month: string; year: number }[] = []
      let iterDate = new Date(start)
      while (iterDate <= end) {
        allMonths.push({
          month: MONTHS[iterDate.getMonth()],
          year: iterDate.getFullYear(),
        })
        iterDate.setMonth(iterDate.getMonth() + 1)
      }

      // Filter out already completed months
      const monthsToSync = allMonths.filter(({ month, year }) => {
        return !completedSyncs.some(cs => cs.month === month && cs.year === year)
      })

      if (monthsToSync.length === 0) {
        toast.success('All months in this range are already synced!')
        setSyncing(false)
        return
      }

      const totalMonths = monthsToSync.length
      setTotalMonths(totalMonths)

      const response = await fetch('/api/onboarding/trigger-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          startMonth: selectedMonth || null,
          startYear: selectedYear,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start sync')
      }

      toast.success(`Starting sync for ${totalMonths} months!`)
      setSyncStarted(true)
      setSyncStartTime(Date.now()) // Track start time
      onSyncStateChange(true) // Notify parent that sync started
    } catch (error) {
      console.error('Sync error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start sync')
    } finally {
      setSyncing(false)
    }
  }

  const handleRetry = async () => {
    // Clear sync status and restart
    setSyncStarted(false)
    setSyncComplete(false)
    setTotalMonths(0)
    handleStartSync()
  }

  const handleComplete = () => {
    setSyncComplete(true)
    onSyncStateChange(false) // Notify parent that sync finished
    onSyncComplete()
    
    // Calculate sync duration
    if (syncStartTime) {
      const durationMs = Date.now() - syncStartTime
      const durationSeconds = (durationMs / 1000).toFixed(2)
      const durationMinutes = (durationMs / 60000).toFixed(2)
      console.log(`🎉 Sync completed in ${durationSeconds}s (${durationMinutes}min) for ${totalMonths} months`)
      console.log(`⏱️  Average time per month: ${(durationMs / totalMonths / 1000).toFixed(2)}s`)
    }
    
    // After a short delay, reset to show date selection again
    setTimeout(() => {
      setSyncStarted(false)
      setSyncComplete(false)
      setSelectedMonth('')
      setSelectedYear('')
      setSyncStartTime(null)
      fetchCompletedSyncs() // Refresh the completed syncs list
    }, 2000) // 2 second delay to show success message
  }

  if (syncStarted) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-white/10 bg-black/20 p-6">
          <h4 className="text-sm font-semibold text-white mb-4">Syncing Acuity Data</h4>
          
          <SyncProgressBar
            userId={userId}
            totalMonths={totalMonths}
            onComplete={handleComplete}
          />

          {syncComplete && (
            <div className="mt-4 p-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10">
              <p className="text-sm text-emerald-200">
                ✓ Sync completed successfully!
              </p>
            </div>
          )}

          {!syncComplete && (
            <button
              type="button"
              onClick={handleRetry}
              className="mt-4 px-4 py-2 text-sm font-semibold rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition-all"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/20 p-6 space-y-4">
        {/* Show completed syncs if any */}
        {!loadingCompleted && completedSyncs.length > 0 && (
          <div className="mb-4 p-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10">
            <h4 className="text-sm font-semibold text-emerald-200 mb-2">
              ✓ Previously Synced Data
            </h4>
            <div className="text-xs text-emerald-300">
              <p className="mb-1">
                <span className="font-semibold">{completedSyncs.length}</span> month{completedSyncs.length !== 1 ? 's' : ''} synced
              </p>
              {completedSyncs.length > 0 && (
                <p className="text-emerald-200">
                  {(() => {
                    const sorted = [...completedSyncs].sort((a, b) => {
                      if (a.year !== b.year) return a.year - b.year
                      return MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month)
                    })
                    const earliest = sorted[0]
                    const latest = sorted[sorted.length - 1]
                    
                    if (sorted.length === 1) {
                      return `${earliest.month} ${earliest.year}`
                    }
                    
                    return `${earliest.month} ${earliest.year} – ${latest.month} ${latest.year}`
                  })()}
                </p>
              )}
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-white mb-2">
            {completedSyncs.length > 0 ? 'Sync Additional Data' : 'When did you start using Acuity?'}
          </h4>
          <p className="text-xs text-gray-400 mb-4">
            {completedSyncs.length > 0 
              ? 'Select a range to sync more historical data. Already synced months will be skipped.'
              : 'This helps us sync your historical appointment data.'
            }
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block mb-2 text-sm font-semibold text-white">Month (Optional)</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
            >
              <option value="">Don't remember</option>
              {MONTHS.map(month => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2 text-sm font-semibold text-white">Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value ? Number(e.target.value) : '')}
              className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3af1f7] transition-all"
            >
              <option value="">Select year...</option>
              {generateYearOptions().map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleStartSync}
          disabled={!selectedYear || syncing}
          className={`w-full py-3 font-semibold rounded-xl transition-all ${
            !selectedYear || syncing
              ? 'bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-400 to-[#3af1f7] text-black hover:shadow-lg'
          }`}
        >
          {syncing ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting sync...
            </span>
          ) : (
            'Start Sync'
          )}
        </button>
      </div>
    </div>
  )
}