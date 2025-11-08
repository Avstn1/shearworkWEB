'use client'

import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

import Layout from '@/components/Layout'
import Navbar from '@/components/Navbar'
import OnboardingGuard from '@/components/Wrappers/OnboardingGuard'
import SignOutButton from '@/components/SignOutButton'

import YearDropdown from '@/components/YearDropdown'
import MonthDropdown from '@/components/MonthDropdown'
import DailySelector from '@/components/Dashboard/DailySelector'
import TipsDropdown from '@/components/TipsDropdown'

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

import { supabase } from '@/utils/supabaseClient'
import { useIsMobile } from '@/hooks/useIsMobile'

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

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>(getLocalMonthYear().month)
  const [selectedYear, setSelectedYear] = useState<number>(getLocalMonthYear().year)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showProfitLoss, setShowProfitLoss] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate())

  const isMobile = useIsMobile(MOBILE_BREAKPOINT)
  const hasSyncedInitially = useRef(false)
  const firstSyncAfterConnect = useRef(false)

  const cardClass =
    'bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 flex flex-col flex-1'

  // -------------------- USER & PROFILE --------------------
  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        setLoading(true)
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) throw new Error('No user session found.')
        setUser(user)

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        if (profileError) throw profileError
        setProfile(profileData)

        setIsAdmin(['admin', 'owner'].includes(profileData?.role?.toLowerCase()))

        if (profileData?.acuity_access_token && !profileData?.last_acuity_sync) {
          firstSyncAfterConnect.current = true
        }
      } catch (err: any) {
        console.error(err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchUserAndProfile()
  }, [])

  // -------------------- INITIAL ACUITY SYNC --------------------
  useEffect(() => {
    if (!user || hasSyncedInitially.current) return

    const handleInitialSync = async () => {
      hasSyncedInitially.current = true
      if (firstSyncAfterConnect.current) {
        toast('Performing first-time Acuity sync...')
        await handleFullAcuitySync()
      } else {
        await syncAcuityData()
      }
    }
    handleInitialSync()
  }, [user])

  // -------------------- RE-SYNC ON MONTH/YEAR CHANGE --------------------
  useEffect(() => {
    if (!user || !hasSyncedInitially.current) return
    syncAcuityData()
  }, [selectedMonth, selectedYear])

  // -------------------- SYNC FUNCTIONS --------------------
  const syncAcuityData = async () => {
    if (!user) return
    setIsRefreshing(true)
    const toastId = toast.loading(`Syncing data for ${selectedMonth} ${selectedYear}...`)
    try {
      const res = await fetch(`/api/acuity/pull?endpoint=appointments&month=${encodeURIComponent(selectedMonth)}&year=${selectedYear}`)
      if (!res.ok) throw new Error('Acuity data fetch failed')
      await res.json()
      setRefreshKey(prev => prev + 1)
      toast.success(`Data updated for ${selectedMonth} ${selectedYear}`, { id: toastId })
    } catch (err) {
      console.error(err)
      toast.error('Error fetching Acuity data.', { id: toastId })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleFullAcuitySync = async () => {
    setIsRefreshing(true)
    const toastId = toast.loading('Performing full Acuity sync...')
    try {
      const res = await fetch('/api/acuity/sync-full', { method: 'POST' })
      if (!res.ok) throw new Error('Full Acuity sync failed')
      await res.json()
      toast.success('Full Acuity sync complete!', { id: toastId })
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      console.error(err)
      toast.error('Full Acuity sync failed.', { id: toastId })
    } finally {
      setIsRefreshing(false)
    }
  }

  if (loading) return <div className="flex justify-center items-center h-screen text-white">Loading dashboard...</div>
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
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowProfitLoss(prev => !prev)}
            className={`w-full sm:w-auto px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
              showProfitLoss
                ? 'bg-lime-300 text-black shadow-[0_0_8px_#c4ff85]'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {showProfitLoss ? 'Main Dashboard' : 'Profit/Loss View'}
          </button>
          <TipsDropdown barberId={user?.id} onRefresh={() => setRefreshKey(prev => prev + 1)} />
        </div>
      </div>

      {/* Month + Year Selector */}
      <div className="flex flex-col flex-row sm:flex-row sm:items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto">
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
    <motion.div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-[2fr_1.5fr_1fr]'} flex-1`}>
      {/* LEFT COLUMN */}
      <div className="flex flex-col gap-4 pr-1">
        <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div className={cardClass}>
            <DailyRevenueCard
              key={`daily-${refreshKey}`}
              userId={user?.id}
              selectedDate={`${selectedYear}-${String(MONTHS.indexOf(selectedMonth)+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`}
            />
          </motion.div>
          <motion.div className={cardClass}><MonthlyRevenueCard key={`monthly-${refreshKey}`} userId={user?.id} selectedMonth={selectedMonth} year={selectedYear} /></motion.div>
          <motion.div className={cardClass}><MonthlyExpensesCard key={`expenses-${refreshKey}`} userId={user?.id} month={selectedMonth} year={selectedYear} /></motion.div>
        </motion.div>
        <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div className={cardClass}><YearlyRevenueCard key={`yearly-${refreshKey}`} userId={user?.id} year={selectedYear} /></motion.div>
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
        <motion.div variants={fadeInUp} className={cardClass}>
          <h2 className="text-[#d1e2c5] font-semibold mb-2 text-sm sm:text-lg">Monthly Reports</h2>
          <MonthlyReports key={`mreports-${refreshKey}`} userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
        </motion.div>
        <motion.div variants={fadeInUp} className={cardClass}>
          <h2 className="text-[#d1e2c5] font-semibold mb-2 text-sm sm:text-lg">Weekly Reports</h2>
          <WeeklyReports key={`wreports-${refreshKey}`} userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
        </motion.div>
        <motion.div variants={fadeInUp} className={cardClass}>
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
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={showProfitLoss ? 'profit-loss-view' : 'main-dashboard-view'}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
        >
          {showProfitLoss
            ? <ProfitLossDashboard userId={user?.id} selectedMonth={selectedMonth} selectedYear={selectedYear} globalRefreshKey={refreshKey} />
            : <MainDashboard />
          }
        </motion.div>
      </AnimatePresence>
    </div>
  )

  // -------------------- RENDER --------------------
  return (
    <OnboardingGuard>
      <Navbar />
      {isMobile && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative bg-[var(--accent-2)] p-4 w-64 shadow-lg z-50 flex flex-col min-h-full">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[var(--highlight)] text-2xl font-bold">✂️ ShearWork</span>
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
