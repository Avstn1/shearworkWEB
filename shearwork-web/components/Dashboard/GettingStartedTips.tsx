'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, CheckCircle2, Circle, RefreshCw, X } from 'lucide-react'

interface GettingStartedTipsProps {
  userId: string
  onSync?: () => Promise<void> | void
  onOpenWeeklyReports?: () => void
}

type StepConfig = {
  id: string
  title: string
  description: string
  done: boolean
  actionLabel: string
  onAction?: () => void
  disabled?: boolean
}

export default function GettingStartedTips({
  userId,
  onSync,
  onOpenWeeklyReports,
}: GettingStartedTipsProps) {
  const router = useRouter()
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null)
  const [syncComplete, setSyncComplete] = useState(false)
  const [weeklyComplete, setWeeklyComplete] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const dismissKey = `getting-started-dismissed:${userId}`
  const syncKey = `getting-started-sync:${userId}`
  const weeklyKey = `getting-started-weekly:${userId}`

  useEffect(() => {
    if (!userId) return
    setDismissed(localStorage.getItem(dismissKey) === 'true')
    setSyncComplete(localStorage.getItem(syncKey) === 'true')
    setWeeklyComplete(localStorage.getItem(weeklyKey) === 'true')
  }, [dismissKey, syncKey, userId, weeklyKey])

  useEffect(() => {
    if (!userId) return
    let active = true

    const fetchStatus = async () => {
      try {
        const [acuityRes, squareRes] = await Promise.all([
          fetch('/api/acuity/status', { cache: 'no-store' }),
          fetch('/api/square/status', { cache: 'no-store' }),
        ])

        const acuityData = acuityRes.ok ? await acuityRes.json() : null
        const squareData = squareRes.ok ? await squareRes.json() : null

        if (!active) return
        setCalendarConnected(Boolean(acuityData?.connected) || Boolean(squareData?.connected))
      } catch (error) {
        console.error('Getting started status error:', error)
        if (active) setCalendarConnected(false)
      }
    }

    fetchStatus()

    return () => {
      active = false
    }
  }, [userId])

  const handleDismiss = () => {
    localStorage.setItem(dismissKey, 'true')
    setDismissed(true)
  }

  const handleSync = async () => {
    if (!onSync) return
    setSyncing(true)
    try {
      await onSync()
    } finally {
      localStorage.setItem(syncKey, 'true')
      setSyncComplete(true)
      setSyncing(false)
    }
  }

  const handleWeekly = () => {
    onOpenWeeklyReports?.()
    localStorage.setItem(weeklyKey, 'true')
    setWeeklyComplete(true)
  }

  const steps = useMemo<StepConfig[]>(() => {
    const calendarDone = Boolean(calendarConnected)
    const calendarLoading = calendarConnected === null

    return [
      {
        id: 'connect-calendar',
        title: 'Connect your calendar',
        description: 'Sync appointments from Square or Acuity.',
        done: calendarDone,
        actionLabel: calendarDone ? 'Connected' : calendarLoading ? 'Checking...' : 'Connect',
        onAction: calendarDone || calendarLoading ? undefined : () => router.push('/settings'),
        disabled: calendarDone || calendarLoading,
      },
      {
        id: 'sync-data',
        title: 'Run your first sync',
        description: 'Pull in appointments to populate your reports.',
        done: syncComplete,
        actionLabel: syncComplete ? 'Done' : syncing ? 'Syncing...' : 'Sync now',
        onAction: syncComplete || syncing ? undefined : handleSync,
        disabled: syncComplete || syncing || !onSync,
      },
      {
        id: 'weekly-report',
        title: 'Review your weekly report',
        description: 'See earnings, client mix, and tips at a glance.',
        done: weeklyComplete,
        actionLabel: weeklyComplete ? 'Viewed' : 'Open report',
        onAction: weeklyComplete ? undefined : handleWeekly,
        disabled: weeklyComplete,
      },
    ]
  }, [calendarConnected, handleSync, handleWeekly, onSync, router, syncComplete, syncing, weeklyComplete])

  const completedCount = steps.filter(step => step.done).length
  const progress = Math.round((completedCount / steps.length) * 100)

  if (dismissed || steps.length === 0 || completedCount === steps.length) {
    return null
  }

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-4 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.8)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#9ca3af]">Getting started</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Your first week checklist</h2>
          <p className="mt-1 text-xs text-[#bdbdbd]">
            Follow these three steps to unlock your weekly insights and stay on track.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-[#cbd5f5] transition hover:border-white/20 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        {steps.map(step => (
          <div
            key={step.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
          >
            <div className="flex items-start gap-3">
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              ) : (
                <Circle className="h-5 w-5 text-white/30" />
              )}
              <div>
                <p className="text-sm font-semibold text-white">{step.title}</p>
                <p className="text-xs text-[#bdbdbd]">{step.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={step.onAction}
              disabled={step.disabled}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {step.id === 'sync-data' && !step.done && (
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              )}
              {step.id === 'weekly-report' && !step.done && <BarChart3 className="h-3.5 w-3.5" />}
              {step.actionLabel}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="text-xs text-[#9ca3af]">{completedCount} of {steps.length} complete</div>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7affc9] to-[#3af1f7]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
