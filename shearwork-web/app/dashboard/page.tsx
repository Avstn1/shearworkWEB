'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Layout from '@/components/Layout'
import WeeklyReports from '@/components/WeeklyReports'
import MonthlyReports from '@/components/MonthlyReports'
import UserProfile from '@/components/UserProfile'
import { supabase } from '@/utils/supabaseClient'
import { useIsMobile } from '@/hooks/useIsMobile'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import MonthlyRevenueCard from '@/components/MonthlyRevenueCard'
import TopClientsCard from '@/components/TopClientsCard'
import YearlyRevenueCard from '@/components/YearlyRevenueCard'
import AverageTicketCard from '@/components/AverageTicketCard'
import ServiceBreakdownChart from '@/components/ServiceBreakdownChart'
import MarketingFunnelsChart from '@/components/MarketingFunnelsChart'
import Navbar from '@/components/Navbar'
import OnboardingGuard from '@/components/Wrappers/OnboardingGuard'
import WeeklyComparisonReports from '@/components/WeeklyComparisonReports'
import MonthlyExpensesCard from '@/components/MonthlyExpensesCard'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import YearDropdown from '@/components/YearDropdown'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i)

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

const MOBILE_BREAKPOINT = 768

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const CURRENT_MONTH = MONTHS[new Date().getMonth()]
  const [selectedMonth, setSelectedMonth] = useState<string>(CURRENT_MONTH)
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const isMobile = useIsMobile(MOBILE_BREAKPOINT)

  // 🔹 Load user + profile
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
        setIsAdmin(
          profileData?.role?.toLowerCase() === 'admin' ||
          profileData?.role?.toLowerCase() === 'owner'
        )
      } catch (err: any) {
        console.error(err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchUserAndProfile()
  }, [])

  // 🔹 Fetch and refresh data when month/year changes
  useEffect(() => {
    if (!user) return

    const fetchMonthData = async () => {
      setIsRefreshing(true)
      const toastId = toast.loading(`Syncing data for ${selectedMonth} ${selectedYear}...`)

      try {
        console.log(`🔄 Syncing Acuity data for ${selectedMonth} ${selectedYear}...`)
        const res = await fetch(
          `/api/acuity/pull?endpoint=appointments&month=${encodeURIComponent(selectedMonth)}&year=${selectedYear}`
        )

        if (!res.ok) throw new Error('Acuity data fetch failed')
        const data = await res.json()
        console.log('✅ Acuity data synced:', data)

        // Bump refresh key so components update
        setRefreshKey(prev => prev + 1)

        toast.success(`Data updated for ${selectedMonth} ${selectedYear}`, { id: toastId })
      } catch (err) {
        console.error('❌ Error syncing data:', err)
        toast.error('Error fetching Acuity data.', { id: toastId })
      } finally {
        setIsRefreshing(false)
      }
    }

    fetchMonthData()
  }, [user, selectedMonth, selectedYear])

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen text-white">
        Loading dashboard...
      </div>
    )

  if (error)
    return (
      <div className="flex justify-center items-center h-screen text-red-500">
        {error}
      </div>
    )

  const cardClass =
    'bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 flex flex-col flex-1'

  const content = (
    <motion.div
      className="min-h-screen flex flex-col p-4 text-[var(--foreground)] pt-[100px] bg-gradient-to-br from-[#0e100f] via-[#1a1e18] to-[#2b3a29]"
      initial="hidden"
      animate="visible"
    >
      {/* HEADER */}
      <motion.div variants={fadeInUp} className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div>
          <h1 className={`font-bold bg-gradient-to-r from-amber-200 to-lime-400 bg-clip-text text-transparent ${isMobile ? 'text-xl' : 'text-2xl'} animate-gradient`}>
            Welcome back!
          </h1>
          <p className="text-xs text-[#bdbdbd]">Here’s your monthly summary.</p>
        </div>

        {/* Month + Year Selector */}
        <div className="flex flex-wrap gap-2 mt-2 sm:mt-0 items-center">
          {isRefreshing && (
            <div className="flex items-center gap-1 text-xs text-[#fffb85] animate-pulse ml-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}
          {MONTHS.map((m) => (
            <button
              key={m}
              onClick={() => !isRefreshing && setSelectedMonth(m)}
              disabled={isRefreshing}
              className={`
                px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200
                ${selectedMonth === m
                  ? 'bg-gradient-to-r from-amber-300 to-lime-300 text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
                }
                ${isRefreshing
                  ? 'cursor-not-allowed opacity-80 animate-pulse shadow-[0_0_8px_#fffb85]'
                  : 'hover:scale-105 active:scale-95'
                }
              `}
            >
              {m.slice(0,3)}
            </button>
          ))}
          <YearDropdown
            years={YEARS}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            disabled={isRefreshing}
          />

        </div>
      </motion.div>

      {/* GRID */}
      <motion.div
        className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-[2fr_1.5fr_2fr]'} flex-1`}
      >
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-4 pr-1">
          <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-4">
            <div className={cardClass}>
              <YearlyRevenueCard key={`yearly-${refreshKey}`} userId={user?.id} year={selectedYear} />
            </div>
            <div className={cardClass}>
              <MonthlyExpensesCard key={`expenses-${refreshKey}`} userId={user?.id} month={selectedMonth} year={selectedYear} />
            </div>
          </motion.div>

          <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div className={cardClass}>
              <MonthlyRevenueCard key={`revenue-${refreshKey}`} userId={user?.id} selectedMonth={selectedMonth} year={selectedYear} />
            </motion.div>
            <motion.div className={cardClass}>
              <AverageTicketCard key={`ticket-${refreshKey}`} userId={user?.id} selectedMonth={selectedMonth} year={selectedYear} />
            </motion.div>
          </motion.div>

          <motion.div variants={fadeInUp} className={cardClass}>
            <ServiceBreakdownChart key={`services-${refreshKey}`} barberId={user?.id} month={selectedMonth} year={selectedYear} />
          </motion.div>
        </div>

        {/* MIDDLE COLUMN */}
        <div className="flex flex-col gap-4 px-1">
          <motion.div variants={fadeInUp} className={cardClass}>
            <TopClientsCard key={`clients-${refreshKey}`} userId={user?.id} selectedMonth={selectedMonth} selectedYear={selectedYear} />
          </motion.div>
          <motion.div variants={fadeInUp} className={cardClass}>
            <MarketingFunnelsChart key={`funnels-${refreshKey}`} barberId={user?.id} month={selectedMonth} year={selectedYear} />
          </motion.div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-4 pl-1">
          <motion.div variants={fadeInUp} className={cardClass}>
            <h2 className="text-[#c4d2b8] font-semibold mb-2 text-sm sm:text-lg">Monthly Reports</h2>
            <MonthlyReports key={`mreports-${refreshKey}`} userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
          </motion.div>
          <motion.div variants={fadeInUp} className={cardClass}>
            <h2 className="text-[#c4d2b8] font-semibold mb-2 text-sm sm:text-lg">Weekly Reports</h2>
            <WeeklyReports key={`wreports-${refreshKey}`} userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
          </motion.div>
          <motion.div variants={fadeInUp} className={cardClass}>
            <h2 className="text-[#c4d2b8] font-semibold mb-2 text-sm sm:text-lg">Weekly Comparison Reports</h2>
            <WeeklyComparisonReports key={`wcompare-${refreshKey}`} userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  )

  return (
    <OnboardingGuard>
      <Navbar />
      {isMobile ? (
        <>
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 flex flex-col">
              <div className="absolute inset-0 backdrop-blur-sm bg-black/40" onClick={() => setMobileMenuOpen(false)} />
              <div className="relative bg-[var(--accent-2)] p-4 w-64 shadow-lg z-50 flex flex-col min-h-full">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[var(--highlight)] text-2xl font-bold">✂️ ShearWork</span>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-[var(--text-bright)] text-xl">✕</button>
                </div>
                <nav className="flex flex-col space-y-3 flex-1">
                  <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="text-[var(--text-bright)] text-lg font-semibold hover:text-[var(--highlight)]">
                    Dashboard
                  </Link>
                </nav>
                <div className="mt-auto w-full">
                  <SignOutButton className="w-full" />
                </div>
              </div>
            </div>
          )}
          {content}
        </>
      ) : (
        content
      )}
    </OnboardingGuard>
  )
}
