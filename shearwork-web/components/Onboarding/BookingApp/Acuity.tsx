'use client'

import { useState, useEffect } from 'react'
import { Loader2, Calendar, Info, AlertTriangle, CheckCircle2 } from 'lucide-react'
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

  useEffect(() => {
    checkExistingSync()
    fetchFirstAppointment()
  }, [userId])

  const checkExistingSync = async () => {
    if (!userId) return

    try {
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
          setSyncStarted(false)
        }
      }
    } catch (error) {
      console.error('Error checking existing sync:', error)
    }
  }

  const fetchFirstAppointment = async () => {
    try {
      const fetchWithRetry = async (delay = 1000) => {
        let attempt = 0
        while (true) {
          attempt++
          const response = await fetch('/api/onboarding/get-first-appointment', {
            headers: {
              'x-client-access-token': await getAccessToken(),
            },
          })

          if (response.status === 404) {
            console.warn(`Route not ready, retrying in ${delay}ms... (attempt ${attempt})`)
            await new Promise(resolve => setTimeout(resolve, delay))
            continue
          }

          if (!response.ok) {
            throw new Error(`Failed to fetch first appointment: ${response.status}`)
          }

          return response.json()
        }
      }

      const data = await fetchWithRetry()

      if (data.firstAppointment) {
        const first = data.firstAppointment
        const appointmentDate = new Date(first.datetime)
        const month = MONTHS[appointmentDate.getMonth()]
        const year = appointmentDate.getFullYear()

        setFirstAppointment({ month, year, datetime: first.datetime })

        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()

        // Priority = current month only
        setTotalPriorityMonths(1)

        setPriorityMonthsInfo({
          startMonth: MONTHS[currentMonth],
          startYear: currentYear,
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

      const monthsCount = data.priorityMonths ?? totalPriorityMonths
      toast.success(`Starting sync for ${monthsCount} priority months!`)
      setTotalPriorityMonths(monthsCount)
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
    setSyncStarted(false)
    setSyncComplete(false)
    setTotalPriorityMonths(0)
    handleStartSync()
  }

  const handleComplete = () => {
    setSyncComplete(true)
    onSyncStateChange(false)
    onSyncComplete()

    if (syncStartTime) {
      const durationMs = Date.now() - syncStartTime
      const durationSeconds = (durationMs / 1000).toFixed(2)
      const durationMinutes = (durationMs / 60000).toFixed(2)
      console.log(`🎉 Sync completed in ${durationSeconds}s (${durationMinutes}min) for ${totalPriorityMonths} months`)
      console.log(`⏱️  Average time per month: ${(durationMs / totalPriorityMonths / 1000).toFixed(2)}s`)
    }
  }

  if (syncStarted) {
    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-ivory mb-4">Syncing priority data</h4>

          <SyncProgressBar
            userId={userId}
            totalMonths={totalPriorityMonths}
            syncPhase="priority"
            onComplete={handleComplete}
          />

          {syncComplete && (
            <div className="mt-4 flex gap-2.5 rounded-lg border border-sage/25 bg-sage/[0.06] px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" strokeWidth={1.75} />
              <div>
              <p className="text-sm font-medium text-sage-bright">
                Priority sync completed successfully!
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Older data will continue syncing in the background. You'll receive a notification when complete.
              </p>
              </div>
            </div>
          )}

          {!syncComplete && (
            <button
              type="button"
              onClick={handleRetry}
              className="btn btn-glass btn-sm mt-4"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  if (syncComplete && !loadingFirstAppointment) {
    return (
      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-ivory mb-4">Syncing priority data</h4>

          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ivory font-medium">Priority sync complete!</span>
              <span className="text-sage-bright font-semibold tabular-nums">100%</span>
            </div>

            <div className="w-full bg-white/[0.06] rounded-sm h-1.5 overflow-hidden">
              <div
                className="h-full rounded-sm transition-all duration-500 bg-sage"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="flex gap-2.5 rounded-lg border border-sage/25 bg-sage/[0.06] px-3 py-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-medium text-sage-bright">Priority sync completed successfully!</p>
              <p className="text-xs text-gray-400 mt-1">
                Older data will continue syncing in the background. You'll receive a notification when complete.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loadingFirstAppointment) {
    return (
      <div className="space-y-4">
        <div className="py-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-6 w-6 animate-spin text-sage" />
            <div className="text-center">
              <p className="text-sm font-semibold text-ivory mb-1">Finding your first appointment...</p>
              <p className="text-xs text-gray-400">This helps us sync your data accurately</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {!loadingFirstAppointment && firstAppointment && (
          <div className="rounded-lg border border-white/[0.07] bg-raised p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} strokeWidth={1.75} className="text-[#9CCBFF]" />
              <h4 className="text-sm font-semibold text-ivory">Your first appointment</h4>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Based on your calendar, your first appointment was in{' '}
              <span className="font-semibold text-ivory">{firstAppointment.month} {firstAppointment.year}</span>
            </p>
          </div>
        )}

        {priorityMonthsInfo && (
          <div className="space-y-3">
            <div className="rounded-lg border border-sage/25 bg-sage/[0.05] p-4 flex items-start gap-3">
              <Info size={16} strokeWidth={1.75} className="text-sage flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-sage-bright mb-1">Smart sync strategy</p>
                <p className="text-xs text-gray-300 leading-relaxed mb-2">
                  We'll sync <span className="font-semibold text-ivory">{priorityMonthsInfo.startMonth} {priorityMonthsInfo.startYear}</span> right now. This is your most recent and relevant data.
                </p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  All older data will sync in the background after onboarding. You'll get a notification when everything is complete.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[#FFC97A]/25 bg-[#FFC97A]/[0.05] p-4 flex items-start gap-3">
              <AlertTriangle size={16} strokeWidth={1.75} className="text-[#FFC97A] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-[#FFC97A] mb-1">Data accuracy note</p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Some client metrics (total visits, first appointment date, etc.) may be incomplete until your full history is synced. Once you receive the "Full Sync Complete" notification, all data will be accurate.
                </p>
              </div>
            </div>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-ivory mb-1">Ready to sync your data</h4>
          <p className="text-xs text-gray-400 mb-4">Click "Start Sync" to begin importing your appointment history.</p>
        </div>

        <button
          type="button"
          onClick={handleStartSync}
          disabled={syncing || !firstAppointment}
          className="btn btn-bright w-full"
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