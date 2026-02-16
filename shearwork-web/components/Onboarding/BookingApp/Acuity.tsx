'use client'

import { useState, useEffect } from 'react'
import { Loader2, Calendar, Info } from 'lucide-react'
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

export default function Acuity({ userId, onSyncComplete, onSyncStateChange, existingSync }: AcuityProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncStarted, setSyncStarted] = useState(!!existingSync?.hasPending)
  const [totalPriorityMonths, setTotalPriorityMonths] = useState(0)
  const [syncComplete, setSyncComplete] = useState(false)
  const [syncStartTime, setSyncStartTime] = useState<number | null>(null)
  const [firstAppointment, setFirstAppointment] = useState<{ month: string; year: number; datetime: string } | null>(null)
  const [loadingFirstAppointment, setLoadingFirstAppointment] = useState(true)
  const [priorityMonthsInfo, setPriorityMonthsInfo] = useState<{ startMonth: string; startYear: number; endMonth: string; endYear: number } | null>(null)

  // Load first appointment on mount
  useEffect(() => {
    checkExistingSync()
    fetchFirstAppointment()
  }, [userId])

  const checkExistingSync = async () => {
    if (!userId) return

    try {
      // Check if priority syncs are already complete
      const { data: prioritySyncs, error } = await supabase
        .from('sync_status')
        .select('status')
        .eq('user_id', userId)
        .eq('sync_phase', 'priority')

      if (error) {
        console.error('Error checking existing syncs:', error)
        return
      }

      if (prioritySyncs && prioritySyncs.length > 0) {
        const allComplete = prioritySyncs.every(s => s.status === 'completed')
        
        if (allComplete) {
          console.log('Priority syncs already completed')
          setSyncComplete(true)
          setSyncStarted(false) // Don't show progress bar, just enable Next button
        }
      }
    } catch (error) {
      console.error('Error checking existing sync:', error)
    }
  }

  const fetchFirstAppointment = async () => {
    try {
      const response = await fetch('/api/onboarding/get-first-appointment', {
        headers: {
          'x-client-access-token': await getAccessToken(),
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch first appointment')
      }

      const data = await response.json()

      if (data.firstAppointment) {
        const first = data.firstAppointment
        const appointmentDate = new Date(first.datetime)
        const month = MONTHS[appointmentDate.getMonth()]
        const year = appointmentDate.getFullYear()

        setFirstAppointment({
          month,
          year,
          datetime: first.datetime
        })

        // Calculate priority months (last 12 months or less if first appointment is recent)
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        
        // Calculate months between first appointment and now
        const monthsSinceFirst = (currentYear - year) * 12 + (currentMonth - appointmentDate.getMonth()) + 1
        const priorityCount = Math.min(12, monthsSinceFirst)
        
        setTotalPriorityMonths(priorityCount)
        
        // Calculate the date range for priority months
        const priorityStartDate = new Date(now)
        priorityStartDate.setMonth(priorityStartDate.getMonth() - (priorityCount - 1))
        
        setPriorityMonthsInfo({
          startMonth: MONTHS[priorityStartDate.getMonth()],
          startYear: priorityStartDate.getFullYear(),
          endMonth: MONTHS[currentMonth],
          endYear: currentYear
        })
      }
    } catch (error) {
      console.error('Error fetching first appointment:', error)
    } finally {
      setLoadingFirstAppointment(false)
    }
  }

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  // If there's an existing sync, skip and show progress
  useEffect(() => {
    if (existingSync?.hasPending) {
      setSyncStarted(true)
      setTotalPriorityMonths(existingSync.totalMonths)
    }
  }, [existingSync])

  const handleStartSync = async () => {
    if (!firstAppointment) {
      toast.error('Unable to determine sync range')
      return
    }

    setSyncing(true)

    try {
      const response = await fetch('/api/onboarding/trigger-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          startMonth: firstAppointment.month,
          startYear: firstAppointment.year,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start sync')
      }

      toast.success(`Starting sync for ${data.priorityMonths} priority months!`)
      setTotalPriorityMonths(data.priorityMonths)
      setSyncStarted(true)
      setSyncStartTime(Date.now())
      onSyncStateChange(true)
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
    setTotalPriorityMonths(0)
    handleStartSync()
  }

  const handleComplete = () => {
    setSyncComplete(true)
    onSyncStateChange(false)
    onSyncComplete()
    
    // Calculate sync duration
    if (syncStartTime) {
      const durationMs = Date.now() - syncStartTime
      const durationSeconds = (durationMs / 1000).toFixed(2)
      const durationMinutes = (durationMs / 60000).toFixed(2)
      console.log(`🎉 Priority sync completed in ${durationSeconds}s (${durationMinutes}min) for ${totalPriorityMonths} months`)
      console.log(`⏱️  Average time per month: ${(durationMs / totalPriorityMonths / 1000).toFixed(2)}s`)
    }
  }

  if (syncStarted) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-white/10 bg-black/20 p-6">
          <h4 className="text-sm font-semibold text-white mb-4">Syncing Priority Data</h4>
          
          <SyncProgressBar
            userId={userId}
            totalMonths={totalPriorityMonths}
            syncPhase="priority"
            onComplete={handleComplete}
          />

          {syncComplete && (
            <div className="mt-4 p-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10">
              <p className="text-sm text-emerald-200">
                ✓ Priority sync completed successfully!
              </p>
              <p className="text-xs text-emerald-300 mt-1">
                Older data will continue syncing in the background. You'll receive a notification when complete.
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

  // If already complete (user navigated back), show the same completion UI
  if (syncComplete && !loadingFirstAppointment) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-white/10 bg-black/20 p-6">
          <h4 className="text-sm font-semibold text-white mb-4">Syncing Priority Data</h4>
          
          {/* Show progress bar at 100% */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white font-medium">
                Priority sync complete!
              </span>
              <span className="text-emerald-300 font-bold">
                100%
              </span>
            </div>
            
            <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-400 to-[#3af1f7]"
                style={{ width: '100%' }}
              />
            </div>
          </div>
          
          <div className="p-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10">
            <p className="text-sm text-emerald-200">
              ✓ Priority sync completed successfully!
            </p>
            <p className="text-xs text-emerald-300 mt-1">
              Older data will continue syncing in the background. You'll receive a notification when complete.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state while fetching first appointment
  if (loadingFirstAppointment) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-black/20 p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
            <div className="text-center">
              <p className="text-sm font-semibold text-white mb-1">
                Finding your first appointment...
              </p>
              <p className="text-xs text-gray-400">
                This helps us sync your data accurately
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/20 p-6 space-y-4">
        {/* First Appointment Info */}
        {!loadingFirstAppointment && firstAppointment && (
          <div className="p-4 rounded-xl border-2 border-cyan-400/30 bg-cyan-400/10">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={18} className="text-cyan-400" />
              <h4 className="text-sm font-semibold text-cyan-200">
                Your First Appointment
              </h4>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Based on your calendar, your first appointment was in{' '}
              <span className="font-bold text-white">
                {firstAppointment.month} {firstAppointment.year}
              </span>
            </p>
          </div>
        )}

        {/* Sync Strategy Explanation */}
        {priorityMonthsInfo && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl border-2 border-emerald-400/40 bg-emerald-400/10 flex items-start gap-3">
              <Info size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-300 mb-1">
                  📊 Smart Sync Strategy
                </p>
                <p className="text-xs text-gray-300 leading-relaxed mb-2">
                  We'll sync your <span className="font-bold text-white">last {totalPriorityMonths} months</span> ({priorityMonthsInfo.startMonth} {priorityMonthsInfo.startYear} - {priorityMonthsInfo.endMonth} {priorityMonthsInfo.endYear}) right now. This is your most recent and relevant data.
                </p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  All older data will sync in the background after onboarding. You'll get a notification when everything is complete.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border-2 border-amber-400/40 bg-amber-400/10 flex items-start gap-3">
              <Info size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-300 mb-1">
                  ⚠️ Data Accuracy Note
                </p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Some client metrics (total visits, first appointment date, etc.) may be incomplete until your full history is synced. Once you receive the "Full Sync Complete" notification, all data will be accurate.
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-white mb-2">
            Ready to Sync Your Data
          </h4>
          <p className="text-xs text-gray-400 mb-4">
            Click "Start Sync" to begin importing your appointment history.
          </p>
        </div>

        <button
          type="button"
          onClick={handleStartSync}
          disabled={syncing || !firstAppointment}
          className={`w-full py-3 font-semibold rounded-xl transition-all ${
            syncing || !firstAppointment
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