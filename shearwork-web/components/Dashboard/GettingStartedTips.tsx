'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, CheckCircle2, ChevronDown, ChevronUp, Circle, RefreshCw, X } from 'lucide-react'

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
  const [settingsComplete, setSettingsComplete] = useState(false)
  const [ready, setReady] = useState(false)
  const [hideUntil, setHideUntil] = useState<number | null>(null)
  const [showAllSteps, setShowAllSteps] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const syncKey = `getting-started-sync:${userId}`
  const weeklyKey = `getting-started-weekly:${userId}`
  const settingsKey = `getting-started-settings:${userId}`
  const hideUntilKey = `getting-started-hide-until:${userId}`

  useEffect(() => {
    if (!userId) {
      setReady(true)
      return
    }
    setSyncComplete(localStorage.getItem(syncKey) === 'true')
    setWeeklyComplete(localStorage.getItem(weeklyKey) === 'true')
    setSettingsComplete(localStorage.getItem(settingsKey) === 'true')

    const storedHideUntil = localStorage.getItem(hideUntilKey)
    if (storedHideUntil) {
      const parsedHideUntil = Number(storedHideUntil)
      if (!Number.isNaN(parsedHideUntil)) {
        setHideUntil(parsedHideUntil)
      }
    }
    setReady(true)
  }, [hideUntilKey, settingsKey, syncKey, userId, weeklyKey])

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

  const handleHideForNow = () => {
    const nextHideUntil = Date.now() + 24 * 60 * 60 * 1000
    localStorage.setItem(hideUntilKey, String(nextHideUntil))
    setHideUntil(nextHideUntil)
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

  const handleSettings = () => {
    router.push('/settings')
    localStorage.setItem(settingsKey, 'true')
    setSettingsComplete(true)
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
      {
        id: 'review-settings',
        title: 'Review your settings',
        description: 'Check your business details and notifications.',
        done: settingsComplete,
        actionLabel: settingsComplete ? 'Checked' : 'Open settings',
        onAction: settingsComplete ? undefined : handleSettings,
        disabled: settingsComplete,
      },
    ]
  }, [calendarConnected, handleSync, handleWeekly, onSync, router, syncComplete, settingsComplete, syncing, weeklyComplete])

  const completedCount = steps.filter(step => step.done).length
  const progress = Math.round((completedCount / steps.length) * 100)
  const nextStep = steps.find(step => !step.done) ?? steps[0]
  const isHidden = hideUntil !== null && Date.now() < hideUntil

  if (!ready || isHidden || steps.length === 0 || completedCount === steps.length) {
    return null
  }

  return (
    <div className="getting-started-checklist mb-4 rounded-2xl border border-white/10 bg-black/30 p-4 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.8)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#9ca3af]">Getting started</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Your first week checklist</h2>
          <p className="mt-1 text-xs text-[#bdbdbd]">
            Follow the next step to unlock insights and stay on track.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAllSteps(prev => !prev)}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-[#cbd5f5] transition hover:border-white/20 hover:text-white"
          >
            {showAllSteps ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAllSteps ? 'Hide steps' : `View all steps (${steps.length})`}
          </button>
          <button
            type="button"
            onClick={handleHideForNow}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-[#cbd5f5] transition hover:border-white/20 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            Hide for now
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-4">
        <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[#9ca3af]">Next step</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            {nextStep.done ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            ) : (
              <Circle className="h-5 w-5 text-white/30" />
            )}
            <div>
              <p className="text-sm font-semibold text-white">{nextStep.title}</p>
              <p className="text-xs text-[#bdbdbd]">{nextStep.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={nextStep.onAction}
            disabled={nextStep.disabled}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {nextStep.id === 'sync-data' && !nextStep.done && (
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            )}
            {nextStep.id === 'weekly-report' && !nextStep.done && <BarChart3 className="h-3.5 w-3.5" />}
            {nextStep.actionLabel}
          </button>
        </div>
      </div>

      {showAllSteps && (
        <div className="mt-4 grid gap-3">
          {steps.filter(step => step.id !== nextStep.id).map(step => (
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
      )}

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
