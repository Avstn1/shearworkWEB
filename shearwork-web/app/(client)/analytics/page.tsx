/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, X, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'

import SignOutButton from '@/components/SignOutButton'

import YearDropdown from '@/components/YearDropdown'
import MonthDropdown from '@/components/MonthDropdown'
import DailySelector from '@/components/Dashboard/DailySelector'
import ManageTipsButton from '@/components/ManageTipsButton'

import WeeklyReports from '@/components/Dashboard/WeeklyReports'
import MonthlyReports from '@/components/Dashboard/MonthlyReports'
import WeeklyComparisonReports from '@/components/Dashboard/WeeklyComparisonReports'
import MonthlyRevenueCard from '@/components/Dashboard/MonthlyRevenueCard'
import DailyRevenueCard from '@/components/Dashboard/DailyRevenueCard'
import WeeklyRevenueCard from '@/components/Dashboard/WeeklyRevenueCard'
import MonthlyExpensesCard from '@/components/Dashboard/MonthlyExpensesCard'
import TopClientsCard from '@/components/Dashboard/TopClientsCard'
import YearlyRevenueCard from '@/components/Dashboard/YearlyRevenueCard'
import AverageTicketCard from '@/components/AverageTicketCard'
import ServiceBreakdownChart from '@/components/Dashboard/ServiceBreakdownChart'
import MarketingFunnelsChart from '@/components/Dashboard/MarketingFunnelsChart'
import ProfitLossDashboard from '@/components/Dashboard/ProfitLossDashboard'
import YearlyDashboard from '@/components/Dashboard/YearlyDashboard'
import TrialStatusHub from '@/components/Dashboard/TrialStatusHub'
import TutorialLauncher from '@/components/Tutorial/TutorialLauncher'
import TutorialInfoButton from '@/components/Tutorial/TutorialInfoButton'
import TrialPromptModal from '@/components/Dashboard/TrialPromptModal'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/utils/supabaseClient'
import { isTrialActive } from '@/utils/trial'
import { useIsMobile } from '@/hooks/useIsMobile'
import { DASHBOARD_TUTORIAL_STEPS } from '@/lib/tutorials/dashboard'
import { PageHeader, PanelHeading, Segmented } from '@/components/ui/AppKit'
import { CalendarRange, FileText, GitCompareArrows } from 'lucide-react'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const MOBILE_BREAKPOINT = 768

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

const getLocalMonthYear = () => {
  const now = new Date()
  return { month: MONTHS[now.getMonth()], year: now.getFullYear() }
}

// localStorage keys for prompt dismissal tracking
const SOFT_PROMPT_DISMISSED_KEY = 'trial_soft_prompt_dismissed_date'
const URGENT_PROMPT_DISMISSED_KEY = 'trial_urgent_prompt_dismissed_session'

export default function DashboardPage() {
  const router = useRouter()
  const { user, profile, isLoading, trialPromptMode, trialDaysRemaining } = useAuth()

  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>(getLocalMonthYear().month)
  const [selectedYear, setSelectedYear] = useState<number>(getLocalMonthYear().year)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dashboardView, setDashboardView] = useState<'monthly' | 'yearly' | 'profit'>('monthly')
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate())
  const [showTrialPrompt, setShowTrialPrompt] = useState(false)

  const isMobile = useIsMobile(MOBILE_BREAKPOINT)
  const hasSyncedInitially = useRef(false)
  const isTrialUser = isTrialActive(profile)
  const firstSyncAfterConnect = useRef(false)
  const pendingSync = useRef(false)
  const latestSync = useRef<(manual?: boolean) => Promise<void>>(async () => {})
  const isSyncing = useRef(false)
  const showGettingStarted = isTrialUser
  const showTrialNote = isTrialUser && !profile?.onboarded

  // Check if we should show soft/urgent prompt
  useEffect(() => {
    if (trialPromptMode === 'soft') {
      const dismissedDate = localStorage.getItem(SOFT_PROMPT_DISMISSED_KEY)
      const today = new Date().toDateString()
      if (dismissedDate !== today) {
        setShowTrialPrompt(true)
      }
    } else if (trialPromptMode === 'urgent') {
      const dismissedThisSession = sessionStorage.getItem(URGENT_PROMPT_DISMISSED_KEY)
      if (!dismissedThisSession) {
        setShowTrialPrompt(true)
      }
    } else {
      setShowTrialPrompt(false)
    }
  }, [trialPromptMode])

  const handleAddCard = useCallback(() => {
    router.push('/pricing')
  }, [router])

  const handleDismissPrompt = useCallback(() => {
    setShowTrialPrompt(false)
    if (trialPromptMode === 'soft') {
      localStorage.setItem(SOFT_PROMPT_DISMISSED_KEY, new Date().toDateString())
    } else if (trialPromptMode === 'urgent') {
      sessionStorage.setItem(URGENT_PROMPT_DISMISSED_KEY, 'true')
    }
  }, [trialPromptMode])

  /* Graphite panels: stat tiles and content panels share one surface. */
  const statClass = 'panel flex flex-col justify-center p-4'
  const cardClass = 'panel flex min-h-0 flex-1 flex-col p-4 sm:p-5'

  useEffect(() => {
    if (!user?.id) return

    const addToLogs = async () => {
      if (profile?.role != 'Admin') {
        const { error: insertError } = await supabase
        .from('system_logs')
        .insert({
          source: `${profile?.full_name}: ${user.id}`,
          action: 'clicked_dashboard',
          status: 'success',
          details: `Opened navigation link: Dashboard`,
        })

        if (insertError) throw insertError
      }
    }

    addToLogs()
  }, [user, profile])

  // -------------------- INITIAL ACUITY SYNC --------------------
  useEffect(() => {
    if (!user || hasSyncedInitially.current) return

    const handleInitialSync = async () => {
      hasSyncedInitially.current = true
      if (firstSyncAfterConnect.current) {
        toast('Performing first-time Acuity sync...')
        await handleFullAcuitySync()
      }
    }
    handleInitialSync()
    syncAcuityData() // sync on refresh  --  Comment out to remove autosync
  }, [user])

  // -------------------- RE-SYNC ON MONTH/YEAR CHANGE --------------------
  useEffect(() => {
    if (!user || !hasSyncedInitially.current) return
    syncAcuityData()
  }, [selectedMonth, selectedYear])

  if (!user) {
    return <div className="flex h-screen items-center justify-center bg-canvas text-sm text-muted">Please log in to access your dashboard.</div>
  }

  // -------------------- SYNC FUNCTIONS --------------------
  // Automatic syncs (page load, month change) are quiet: the server skips them if the
  // month synced recently. The Sync button forces a fresh sync and reports the result.
  const syncAcuityData = async (manual = false) => {
    if (!user) return
    if (isSyncing.current) {
      // Pickers stay usable during automatic checks: remember to sync the latest
      // selection once the current request finishes
      pendingSync.current = true
      return
    }

    isSyncing.current = true
    // Only a manual sync shows "Syncing…" and locks the pickers; automatic checks are
    // usually skipped by the server in a few hundred ms and should be invisible
    if (manual) setIsRefreshing(true)
    const toastId = manual ? toast.loading(`Syncing data for ${selectedMonth} ${selectedYear}...`) : undefined

    const timeoutId = setTimeout(() => {
      if (isSyncing.current) {
        console.warn('Sync timeout reached, resetting state')
        isSyncing.current = false
        setIsRefreshing(false)
        if (manual) toast.error('Sync timed out. Please try again.', { id: toastId })
      }
    }, 60000)

    try {
      const res = await fetch(
        `/api/pull?granularity=month&month=${encodeURIComponent(selectedMonth)}&year=${selectedYear}${manual ? '&force=1' : ''}`
      )

      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || body.details || 'Pull failed')

      if (body.skipped === 'in_progress') {
        if (manual) toast.success('A sync is already running for this month', { id: toastId })
      } else if (body.skipped) {
        // Fresh enough: stored data is current, nothing to reload
      } else {
        setRefreshKey(prev => prev + 1)
        if (manual) toast.success(`Data updated for ${selectedMonth} ${selectedYear}`, { id: toastId })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error syncing data.'
      console.error(err)
      if (manual) toast.error(message, { id: toastId })
    } finally {
      clearTimeout(timeoutId)
      isSyncing.current = false
      if (manual) setIsRefreshing(false)
      if (pendingSync.current) {
        pendingSync.current = false
        void latestSync.current()
      }
    }
  }
  latestSync.current = syncAcuityData

  const handleFullAcuitySync = async () => {
    setIsRefreshing(true)
    const toastId = toast.loading('Performing full sync...')

    try {
      const res = await fetch(`/api/pull?granularity=year&year=${selectedYear}&force=1`)

      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || body.details || 'Full sync failed')

      toast.success('Full sync complete!', { id: toastId })
      setRefreshKey(prev => prev + 1)
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Full sync failed.', { id: toastId })
    } finally {
      setIsRefreshing(false)
    }
  }

  const _scrollToWeeklyReports = () => {
    if (dashboardView !== 'monthly') {
      setDashboardView('monthly')
      setTimeout(() => {
        document.getElementById('weekly-reports')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 300)
      return
    }

    document.getElementById('weekly-reports')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }


  if (isLoading) return <div className="flex h-screen items-center justify-center bg-canvas text-sm text-muted">Loading dashboard…</div>
  if (error) return <div className="flex h-screen items-center justify-center bg-canvas text-sm text-[#D99A8B]">{error}</div>

  // -------------------- HEADER COMPONENT --------------------
  const VIEW_OPTIONS: Array<{ value: 'monthly' | 'yearly' | 'profit'; label: string }> = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
    { value: 'profit', label: 'Profit/Loss' },
  ]

  const VIEW_SUBTITLES: Record<'monthly' | 'yearly' | 'profit', string> = {
    monthly: `Revenue, clients and reports for ${selectedMonth} ${selectedYear}.`,
    yearly: `Totals, trends and top clients across ${selectedYear}.`,
    profit: `Revenue against expenses for ${selectedMonth} ${selectedYear}.`,
  }

  const DashboardHeader = () => (
    <PageHeader icon={TrendingUp} tone="violet"
      title="Analytics"
      subtitle={VIEW_SUBTITLES[dashboardView]}
      actions={
        <>
          <div data-tutorial-id="dashboard-view-switcher" className="w-full sm:w-auto">
            <Segmented
              options={VIEW_OPTIONS}
              value={dashboardView}
              onChange={setDashboardView}
              className="w-full sm:w-auto"
            />
          </div>

          {/* Month + Day + Year selector, sync */}
          <div data-tutorial-id="dashboard-date-controls" className="flex flex-wrap items-center gap-2">
            <MonthDropdown
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              disabled={isRefreshing}
            />

            <DailySelector
              userId={user.id}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
              disabled={isRefreshing}
            />

            <YearDropdown
              years={Array.from({ length: 5 }, (_, i) => getLocalMonthYear().year - 2 + i)}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              disabled={isRefreshing}
            />

            <button
              type="button"
              onClick={() => {
                syncAcuityData(true)
              }}
              disabled={isRefreshing}
              className="btn btn-glass btn-sm h-9"
              title="Sync data"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
              )}
              <span>{isRefreshing ? 'Syncing…' : 'Sync'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ManageTipsButton />
            <TutorialLauncher
              pageKey="dashboard"
              steps={DASHBOARD_TUTORIAL_STEPS}
              renderTrigger={(openTutorial) => (
                <TutorialInfoButton onClick={openTutorial} label="Dashboard tutorial" />
              )}
            />
          </div>
        </>
      }
    />
  )

  // -------------------- Shared selected-date string --------------------
  const selectedDateStr = `${selectedYear}-${String(MONTHS.indexOf(selectedMonth) + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`

  // -------------------- MAIN DASHBOARD --------------------
  // Desktop: three columns that fill the viewport (no page scroll); each panel
  // scrolls inside itself if its content is taller. Mobile/tablet: stacked.
  const MainDashboard = () => (
    <motion.div className="grid grid-cols-1 gap-4 lg:h-full lg:grid-cols-[minmax(0,3fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
      {/* LEFT: stats + service breakdown */}
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <motion.div variants={fadeInUp} className="grid flex-shrink-0 grid-cols-1 gap-4 sm:grid-cols-3">
          <motion.div className={statClass}>
            <DailyRevenueCard
              key={`daily-${refreshKey}`}
              userId={user.id}
              selectedDate={selectedDateStr}
            />
          </motion.div>
          <motion.div className={statClass}><MonthlyRevenueCard key={`monthly-${refreshKey}`} userId={user?.id} selectedMonth={selectedMonth} year={selectedYear} /></motion.div>
          <motion.div className={statClass}><MonthlyExpensesCard key={`expenses-${refreshKey}`} userId={user?.id} month={selectedMonth} year={selectedYear} /></motion.div>
          <motion.div className={statClass}>
            <WeeklyRevenueCard
              key={`weekly-${refreshKey}`}
              userId={user.id}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
            />
          </motion.div>
          <motion.div className={statClass}><YearlyRevenueCard key={`yearly-${refreshKey}`} userId={user?.id} year={selectedYear} timeframe={'YTD'} /></motion.div>
          <motion.div className={statClass}><AverageTicketCard key={`ticket-${refreshKey}`} userId={user?.id} selectedMonth={selectedMonth} year={selectedYear} /></motion.div>
        </motion.div>
        <motion.div variants={fadeInUp} className={`${cardClass} min-h-[320px] lg:min-h-0`}><ServiceBreakdownChart key={`services-${refreshKey}`} barberId={user?.id} month={selectedMonth} year={selectedYear} /></motion.div>
      </div>

      {/* MIDDLE: top clients + funnels */}
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <motion.div variants={fadeInUp} className={`${cardClass} min-h-[280px] lg:min-h-0 lg:overflow-y-auto`}><TopClientsCard key={`clients-${refreshKey}`} userId={user?.id} selectedMonth={selectedMonth} selectedYear={selectedYear} /></motion.div>
        <motion.div variants={fadeInUp} className={`${cardClass} min-h-[320px] lg:min-h-0`}><MarketingFunnelsChart key={`funnels-${refreshKey}`} barberId={user?.id} month={selectedMonth} year={selectedYear} /></motion.div>
      </div>

      {/* RIGHT: reports */}
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <motion.section data-tutorial-id="dashboard-monthly-reports" variants={fadeInUp} className="panel flex min-h-0 flex-1 flex-col">
          <header className="panel-header py-3"><PanelHeading icon={FileText} tone="sage">Monthly reports</PanelHeading></header>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <MonthlyReports key={`mreports-${refreshKey}`} userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
          </div>
        </motion.section>
        <motion.section id="weekly-reports" data-tutorial-id="dashboard-weekly-reports" variants={fadeInUp} className="panel flex min-h-0 flex-1 flex-col">
          <header className="panel-header py-3"><PanelHeading icon={CalendarRange} tone="sky">Weekly reports</PanelHeading></header>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <WeeklyReports key={`wreports-${refreshKey}`} userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
          </div>
        </motion.section>
        <motion.section data-tutorial-id="dashboard-weekly-comparison" variants={fadeInUp} className="panel flex min-h-0 flex-1 flex-col">
          <header className="panel-header py-3"><PanelHeading icon={GitCompareArrows} tone="sand">Weekly comparison</PanelHeading></header>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <WeeklyComparisonReports key={`wcompare-${refreshKey}`} userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
          </div>
        </motion.section>
      </div>
    </motion.div>
  )

  // -------------------- PAGE CONTENT --------------------
  const content = (
    <div className={`app-page flex flex-col ${dashboardView === 'monthly' ? 'lg:h-[calc(100dvh-var(--navbar-height,72px))] lg:min-h-0 lg:overflow-hidden lg:pb-6 xl:pb-6' : ''}`}>
      <DashboardHeader />
      {showTrialNote && (
        <div className="panel mb-4 px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-ivory">Getting started:</span> Data will populate after your first sync.
          Use the Re‑sync button above after connecting your calendar.
        </div>
      )}
      {/* {showGettingStarted && (
        <TrialStatusHub
          userId={user.id}
          daysRemaining={trialDaysRemaining}
          dateAutoNudgeEnabled={profile?.date_autonudge_enabled}
          onNavigateToAutoNudge={() => router.push('/client-manager?view=sms')}
        />
      )} */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={dashboardView}
          className={dashboardView === 'monthly' ? 'lg:min-h-0 lg:flex-1' : undefined}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >

          {dashboardView === 'monthly' && <MainDashboard />}
          {dashboardView === 'yearly' && 
            <YearlyDashboard
              userId={user.id}
              selectedYear={selectedYear}
              globalRefreshKey={refreshKey}
            />
          }
          {dashboardView === 'profit' && (
            <ProfitLossDashboard
              userId={user.id}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              selectedDay={selectedDay}
              globalRefreshKey={refreshKey}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )

  // -------------------- RENDER --------------------
  return (
    <>
      {/* Soft/Urgent trial prompt modal */}
      {(trialPromptMode === 'soft' || trialPromptMode === 'urgent') && (
        <TrialPromptModal
          isOpen={showTrialPrompt}
          mode={trialPromptMode}
          daysRemaining={trialDaysRemaining}
          onAddCard={handleAddCard}
          onDismiss={handleDismissPrompt}
        />
      )}

      {isMobile && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="modal-backdrop" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-[61] flex min-h-full w-64 flex-col border-r border-white/[0.07] bg-surface p-4">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-lg font-semibold text-ivory">Corva</span>
              <button type="button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} className="btn btn-ghost btn-sm px-1.5"><X size={18} strokeWidth={1.75} /></button>
            </div>
            <nav className="flex flex-1 flex-col space-y-3">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-gray-300 hover:text-ivory">Dashboard</Link>
            </nav>
            <div className="mt-auto w-full"><SignOutButton className="w-full" /></div>
          </div>
        </div>
      )}
      {content}
    </>
  )
}