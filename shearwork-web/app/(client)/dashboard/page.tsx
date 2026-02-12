/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

import OnboardingGuard from '@/components/Wrappers/OnboardingGuard'
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
import MonthlyExpensesCard from '@/components/Dashboard/MonthlyExpensesCard'
import TopClientsCard from '@/components/Dashboard/TopClientsCard'
import YearlyRevenueCard from '@/components/Dashboard/YearlyRevenueCard'
import AverageTicketCard from '@/components/AverageTicketCard'
import ServiceBreakdownChart from '@/components/Dashboard/ServiceBreakdownChart'
import MarketingFunnelsChart from '@/components/Dashboard/MarketingFunnelsChart'
import ProfitLossDashboard from '@/components/Dashboard/ProfitLossDashboard'
import YearlyDashboard from '@/components/Dashboard/YearlyDashboard'
import GettingStartedTips from '@/components/Dashboard/GettingStartedTips'
import TutorialLauncher from '@/components/Tutorial/TutorialLauncher'
import TutorialInfoButton from '@/components/Tutorial/TutorialInfoButton'
import TrialPromptModal from '@/components/Dashboard/TrialPromptModal'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/utils/supabaseClient'
import { isTrialActive } from '@/utils/trial'
import { useIsMobile } from '@/hooks/useIsMobile'
import { DASHBOARD_TUTORIAL_STEPS } from '@/lib/tutorials/dashboard'

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
  const isSyncing = useRef(false)
  const showGettingStarted = isTrialUser
  const showTrialNote = isTrialUser && !profile?.onboarded

  // Check if we should show soft/urgent prompt
  useEffect(() => {
    if (trialPromptMode === 'soft') {
      // Once per day for soft prompt
      const dismissedDate = localStorage.getItem(SOFT_PROMPT_DISMISSED_KEY)
      const today = new Date().toDateString()
      if (dismissedDate !== today) {
        setShowTrialPrompt(true)
      }
    } else if (trialPromptMode === 'urgent') {
      // Once per session for urgent prompt
      const dismissedThisSession = sessionStorage.getItem(URGENT_PROMPT_DISMISSED_KEY)
      if (!dismissedThisSession) {
        setShowTrialPrompt(true)
      }
    } else {
      setShowTrialPrompt(false)
    }
  }, [trialPromptMode])

  // handleAddCard is kept for interface compatibility but modal handles checkout internally
  const handleAddCard = useCallback(() => {
    // Modal now handles checkout directly, this is a fallback
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


  const cardClass =
    'bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 flex flex-col flex-1'

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

  // -------------------- RE-SYNC ON MONTH/YEAR CHANGE -------------------- Comment out to remove autosync
  useEffect(() => {
    if (!user || !hasSyncedInitially.current) return
    syncAcuityData()
  }, [selectedMonth, selectedYear])

  if (!user) {
    return <div className="flex justify-center items-center h-screen text-white">Please log in to access your dashboard.</div>
  }

  // -------------------- SYNC FUNCTIONS --------------------
  const syncAcuityData = async () => {
    if (!user) return
    if (isSyncing.current) return

    isSyncing.current = true
    setIsRefreshing(true)
    const toastId = toast.loading(`Syncing data for ${selectedMonth} ${selectedYear}...`)

    try {
      // New pipeline endpoint: triggers provider pull + truth table upserts + aggregations
      const res = await fetch(
        `/api/pull?granularity=month&month=${encodeURIComponent(selectedMonth)}&year=${selectedYear}`
      )

      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || body.details || 'Pull failed')

      setRefreshKey(prev => prev + 1)
      toast.success(`Data updated for ${selectedMonth} ${selectedYear}`, { id: toastId })
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Error syncing data.', { id: toastId })
    } finally {
      isSyncing.current = false
      setIsRefreshing(false)
      toast.dismiss(toastId)
    }
  }

  const handleFullAcuitySync = async () => {
    setIsRefreshing(true)
    const toastId = toast.loading('Performing full sync...')

    try {
      // Closest equivalent of "pull-all": sync the selected year
      const res = await fetch(`/api/pull?granularity=year&year=${selectedYear}`)

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

  const scrollToWeeklyReports = () => {
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


  if (isLoading) return <div className="flex justify-center items-center h-screen text-white">Loading dashboard...</div>
  if (error) return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>

  // -------------------- HEADER COMPONENT --------------------
  const DashboardHeader = () => (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
    >
      {/* Welcome + Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full">
        <div>
          <h1 className={`font-bold bg-gradient-to-r from-amber-200 to-lime-300 bg-clip-text text-transparent ${isMobile ? 'text-xl' : 'text-2xl'} animate-gradient`}>
            Welcome back!
          </h1>
          <p className="text-xs text-[#bdbdbd]">Here’s your local daily & monthly summary.</p>
        </div>

        {/* Controls — stacked nicely on mobile */}
        <div data-tutorial-id="dashboard-view-switcher" className="flex gap-1 w-full sm:w-auto bg-[#1a1a1a] rounded-full p-1">
          <button
            onClick={() => setDashboardView('monthly')}
            className={`flex-1 sm:flex-none px-5 py-3 rounded-full text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
              dashboardView === 'monthly'
                ? 'bg-lime-300 text-black shadow-[0_0_8px_#c4ff85]'
                : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setDashboardView('yearly')}
            className={`flex-1 sm:flex-none px-5 py-3 rounded-full text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
              dashboardView === 'yearly'
                ? 'bg-sky-300 text-black shadow-[0_0_8px_#7fd9ff]'
                : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
            }`}
          >
            Yearly
          </button>
          <button
            onClick={() => setDashboardView('profit')}
            className={`flex-1 sm:flex-none px-5 py-3 rounded-full text-xs font-semibold transition-all duration-300 whitespace-nowrap ${
              dashboardView === 'profit'
                ? 'bg-rose-300 text-black shadow-[0_0_8px_#ff7f7f]'
                : 'text-[#bdbdbd] hover:text-white hover:bg-[#2a2a2a]'
            }`}
          >
            Profit/Loss
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
      </div>

      {/* Month + Year Selector */}
      <div data-tutorial-id="dashboard-date-controls" className="flex flex-col flex-row sm:flex-row sm:items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
        <button
          onClick={() => {
            syncAcuityData()
          }}
          disabled={isRefreshing}
          className="whitespace-nowrap flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Sync data"
        >
          <Loader2 className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Re-sync</span>
        </button>

        {isRefreshing && (
          <div className="flex items-center gap-1 text-xs text-[#fffb85] animate-pulse ml-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Syncing...</span>
          </div>
        )}
        
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
      </div>
    </motion.div>
  )

  // -------------------- MAIN DASHBOARD --------------------
  const MainDashboard = () => (
    <motion.div
      className={`grid gap-4 flex-1 ${
        isMobile
          ? 'grid-cols-1'
          : 'grid-cols-[minmax(200px,3fr)_minmax(150px,1.5fr)_minmax(100px,1fr)]'
      }`}
    >
      {/* LEFT COLUMN */}
      <div className="flex flex-col gap-4 pr-1">
        <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div className={cardClass}>
            <DailyRevenueCard
              key={`daily-${refreshKey}`}
              userId={user.id}
              selectedDate={`${selectedYear}-${String(MONTHS.indexOf(selectedMonth)+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`}
            />
          </motion.div>
          <motion.div className={cardClass}><MonthlyRevenueCard key={`monthly-${refreshKey}`} userId={user?.id} selectedMonth={selectedMonth} year={selectedYear} /></motion.div>
          <motion.div className={cardClass}><MonthlyExpensesCard key={`expenses-${refreshKey}`} userId={user?.id} month={selectedMonth} year={selectedYear} /></motion.div>
        </motion.div>
        <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div className={cardClass}><YearlyRevenueCard key={`yearly-${refreshKey}`} userId={user?.id} year={selectedYear} timeframe={'YTD'} /></motion.div>
          <motion.div className={cardClass}><AverageTicketCard key={`ticket-${refreshKey}`} userId={user?.id} selectedMonth={selectedMonth} year={selectedYear} /></motion.div>
        </motion.div>
        <motion.div variants={fadeInUp} className={cardClass}><ServiceBreakdownChart key={`services-${refreshKey}`} barberId={user?.id} month={selectedMonth} year={selectedYear} /></motion.div>
      </div>

      {/* MIDDLE COLUMN */}
      <div className="flex flex-col gap-4 px-1">
        <motion.div variants={fadeInUp} className={cardClass}><TopClientsCard key={`clients-${refreshKey}`} userId={user?.id} selectedMonth={selectedMonth} selectedYear={selectedYear} /></motion.div>
        <motion.div variants={fadeInUp} className={cardClass}><MarketingFunnelsChart key={`funnels-${refreshKey}`} barberId={user?.id} month={selectedMonth} year={selectedYear} /></motion.div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="flex flex-col gap-4 pl-1">
        <motion.div data-tutorial-id="dashboard-monthly-reports" variants={fadeInUp} className={cardClass}>
          <h2 className="text-[#d1e2c5] font-semibold mb-2 text-sm sm:text-lg">Monthly Reports</h2>
          <MonthlyReports key={`mreports-${refreshKey}`} userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
        </motion.div>
        <motion.div id="weekly-reports" data-tutorial-id="dashboard-weekly-reports" variants={fadeInUp} className={cardClass}>
          <h2 className="text-[#d1e2c5] font-semibold mb-2 text-sm sm:text-lg">Weekly Reports</h2>
          <WeeklyReports key={`wreports-${refreshKey}`} userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
        </motion.div>
        <motion.div data-tutorial-id="dashboard-weekly-comparison" variants={fadeInUp} className={cardClass}>
          <h2 className="text-[#d1e2c5] font-semibold mb-2 text-sm sm:text-lg">Weekly Comparison</h2>
          <WeeklyComparisonReports key={`wcompare-${refreshKey}`} userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
        </motion.div>
      </div>
    </motion.div>
  )

  // -------------------- PAGE CONTENT --------------------
  const content = (
    <div className="min-h-screen flex flex-col p-4 text-[var(--foreground)] pt-[100px] bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b]">
      <DashboardHeader />
      {showTrialNote && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-[#bdbdbd]">
          <span className="font-semibold text-white">Getting started:</span> Data will populate after your first sync.
          Use the Re‑sync button above after connecting your calendar.
        </div>
      )}
      {showGettingStarted && (
        <GettingStartedTips
          userId={user.id}
          onSync={syncAcuityData}
          onOpenWeeklyReports={scrollToWeeklyReports}
        />
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={dashboardView}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
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
    <OnboardingGuard>
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
          <div className="absolute inset-0 backdrop-blur-sm bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative bg-[var(--accent-2)] p-4 w-64 shadow-lg z-50 flex flex-col min-h-full">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[var(--highlight)] text-2xl font-bold">✂️ Corva</span>
              <button onClick={() => setMobileMenuOpen(false)} className="text-[var(--text-bright)] text-xl">✕</button>
            </div>
            <nav className="flex flex-col space-y-3 flex-1">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="text-[var(--text-bright)] text-lg font-semibold hover:text-[var(--highlight)]">Dashboard</Link>
            </nav>
            <div className="mt-auto w-full"><SignOutButton className="w-full" /></div>
          </div>
        </div>
      )}
      {content}
    </OnboardingGuard>
  )
}
