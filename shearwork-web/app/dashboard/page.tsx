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
  const [monthlyDataCache, setMonthlyDataCache] = useState<Record<string, any>>({})
  const isMobile = useIsMobile(MOBILE_BREAKPOINT)

  const navLinksBase = [{ href: '/dashboard', label: 'Dashboard' }]

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

  // 🔹 Fetch only the selected month (not the full year)
  useEffect(() => {
    if (!user || !selectedMonth || !selectedYear) return

    const fetchSelectedMonth = async () => {
      const cacheKey = `${selectedYear}-${selectedMonth}`
      if (monthlyDataCache[cacheKey]) return // already cached

      try {
        console.log(`🔄 Fetching Acuity appointments for ${selectedMonth} ${selectedYear}...`)
        const res = await fetch(
          `/api/acuity/pull?endpoint=appointments&month=${encodeURIComponent(selectedMonth)}&year=${selectedYear}`
        )
        const data = await res.json()
        setMonthlyDataCache(prev => ({ ...prev, [cacheKey]: data }))
      } catch (err) {
        console.error(`❌ Failed to fetch ${selectedMonth} ${selectedYear}:`, err)
      }
    }

    fetchSelectedMonth()
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

  const renderMobileMenu = () => {
    const navLinks = isAdmin
      ? navLinksBase.filter(link => link.href !== '/dashboard').concat({
          href: '/admin/dashboard',
          label: 'Admin Dashboard',
        })
      : navLinksBase

    return (
      <div className="fixed inset-0 z-50 flex flex-col">
        <div
          className="absolute inset-0 backdrop-blur-sm bg-black/40"
          onClick={() => setMobileMenuOpen(false)}
        />
        <div className="relative bg-[var(--accent-2)] p-4 w-64 shadow-lg z-50 flex flex-col min-h-full">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[var(--highlight)] text-2xl font-bold">✂️ ShearWork</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="text-[var(--text-bright)] text-xl"
            >
              ✕
            </button>
          </div>
          <nav className="flex flex-col space-y-3 flex-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[var(--text-bright)] text-lg font-semibold hover:text-[var(--highlight)]"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto w-full">
            <SignOutButton className="w-full" />
          </div>
        </div>
      </div>
    )
  }

  const cardClass =
    'bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 flex flex-col flex-1'

  const content = (
    <motion.div
      className="min-h-screen flex flex-col p-4 text-[var(--foreground)] pt-[100px] bg-gradient-to-br from-[#0e100f] via-[#1a1e18] to-[#2b3a29]"
      initial="hidden"
      animate="visible"
    >
      {/* HEADER */}
      <motion.div variants={fadeInUp} custom={0} className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div>
          <h1 className={`font-bold bg-gradient-to-r from-amber-200 to-lime-400 bg-clip-text text-transparent ${isMobile ? 'text-xl' : 'text-2xl'} animate-gradient`}>
            Welcome back!
          </h1>
          <p className="text-xs text-[#bdbdbd]">Here’s your monthly summary.</p>
        </div>

        {/* Month + Year Selector */}
        <div className="flex flex-wrap gap-2 mt-2 sm:mt-0 items-center">
          {MONTHS.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMonth(m)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                selectedMonth === m
                  ? 'bg-amber-300 text-black'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {m.slice(0,3)}
            </button>
          ))}
          <select
            value={selectedYear ?? ''}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="appearance-none pr-10 pl-4 py-2 rounded-full bg-gradient-to-r from-amber-500/30 to-orange-500/30 text-black font-semibold text-sm border border-white/20 shadow-md focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1 hover:scale-105 transition-all"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* GRID */}
      <motion.div
        className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-[2fr_1.5fr_2fr]'} flex-1`}
        style={{ overflow: 'visible' }}
      >
        {/* --- LEFT --- */}
        <div className="flex flex-col gap-4 pr-1">
          {/* Row with Yearly Revenue + Monthly Expenses */}
          <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-4">
            <div className={cardClass}>
              <YearlyRevenueCard userId={user?.id} year={selectedYear} />
            </div>
            <div className={cardClass}>
              <MonthlyExpensesCard userId={user?.id} month={selectedMonth} year={selectedYear} />
            </div>
          </motion.div>

          {/* Row with Monthly Revenue + Average Ticket */}
          <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div className={cardClass}>
              <MonthlyRevenueCard userId={user?.id} selectedMonth={selectedMonth} year={selectedYear} />
            </motion.div>
            <motion.div className={cardClass}>
              <AverageTicketCard userId={user?.id} selectedMonth={selectedMonth} year={selectedYear} />
            </motion.div>
          </motion.div>

          <motion.div variants={fadeInUp} className={cardClass}>
            <ServiceBreakdownChart barberId={user?.id} month={selectedMonth} year={selectedYear ?? CURRENT_YEAR}/>
          </motion.div>
        </div>


        {/* --- MIDDLE --- */}
        <div className="flex flex-col gap-4 px-1">
          <motion.div variants={fadeInUp} custom={4} className={cardClass}>
            <TopClientsCard userId={user?.id} selectedMonth={selectedMonth} selectedYear={selectedYear} />
          </motion.div>
          <motion.div variants={fadeInUp} custom={5} className={cardClass}>
            <MarketingFunnelsChart barberId={user?.id} month={selectedMonth} year={selectedYear ?? CURRENT_YEAR}/>
          </motion.div>
        </div>

        {/* --- RIGHT --- */}
        <div className="flex flex-col gap-4 pl-1">
          <motion.div variants={fadeInUp} custom={6} className={cardClass}>
            <h2 className="text-[#c4d2b8] font-semibold mb-2 text-sm sm:text-lg">Monthly Reports</h2>
            <MonthlyReports userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
          </motion.div>
          <motion.div variants={fadeInUp} custom={7} className={cardClass}>
            <h2 className="text-[#c4d2b8] font-semibold mb-2 text-sm sm:text-lg">Weekly Reports</h2>
            <WeeklyReports userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
          </motion.div>
          <motion.div variants={fadeInUp} custom={8} className={cardClass}>
            <h2 className="text-[#c4d2b8] font-semibold mb-2 text-sm sm:text-lg">Weekly Comparison Reports</h2>
            <WeeklyComparisonReports userId={user?.id} filterMonth={selectedMonth} filterYear={selectedYear} isAdmin={isAdmin} />
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
          {mobileMenuOpen && renderMobileMenu()}
          {content}
        </>
      ) : (
        content
      )}
    </OnboardingGuard>
  )
}
