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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

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
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toLocaleString('default', { month: 'long' })
  )
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isMobile = useIsMobile(MOBILE_BREAKPOINT)

  const navLinksBase = [{ href: '/dashboard', label: 'Dashboard' }]

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
          <div className="mt-auto">
            <SignOutButton className="w-full" />
          </div>
        </div>
      </div>
    )
  }

  const content = (
    <motion.div
      className="min-h-screen flex flex-col p-6 text-[var(--foreground)] pt-[110px]"
      initial="hidden"
      animate="visible"
    >
      {/* HEADER */}
      <motion.div variants={fadeInUp} custom={0} className="mb-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className={`font-bold text-[#F5E6C5] ${isMobile ? 'text-xl' : 'text-3xl'}`}>
              Welcome back!
            </h1>
            <p className="text-xs text-[#bdbdbd]">Here’s your monthly summary.</p>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <h3 className="text-[#bdbdbd] font-semibold text-sm">Reports for</h3>
            <select
              className="bg-[#334030] rounded-md px-2 py-1 text-xs border border-[#55694b] text-white"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </motion.div>

      {/* DASHBOARD GRID */}
      <div
        className={`grid gap-6 ${
          isMobile ? 'grid-cols-1' : 'grid-cols-[2fr_1.5fr_2fr]'
        } overflow-hidden flex-1`}
        style={{ height: 'calc(100vh - 230px)' }}
      >
        {/* --- LEFT SECTION --- */}
        <div className="flex flex-col gap-6 pr-2">
          <motion.div variants={fadeInUp} custom={1}>
            <YearlyRevenueCard userId={user?.id} />
          </motion.div>
          <motion.div variants={fadeInUp} custom={2} className="grid grid-cols-2 gap-4">
            <MonthlyRevenueCard userId={user?.id} selectedMonth={selectedMonth} />
            <AverageTicketCard userId={user?.id} selectedMonth={selectedMonth} />
          </motion.div>
          <motion.div variants={fadeInUp} custom={3} className="flex-1">
            <ServiceBreakdownChart barberId={user?.id} month={selectedMonth} year={new Date().getFullYear()}/>
          </motion.div>
        </div>

        {/* --- MIDDLE SECTION --- */}
        <div className="flex flex-col gap-6 px-2">
          <motion.div variants={fadeInUp} custom={4}>
            <TopClientsCard userId={user?.id} selectedMonth={selectedMonth} />
          </motion.div>
          <motion.div variants={fadeInUp} custom={5} className="flex-1">
            <MarketingFunnelsChart barberId={user?.id} month={selectedMonth} year={new Date().getFullYear()}/>
          </motion.div>
        </div>

        {/* --- RIGHT SECTION --- */}
        <motion.div
          variants={fadeInUp}
          custom={6}
          className="flex flex-col gap-6 pl-2"
        >
          <div className="bg-[#1f1f1a] rounded-lg shadow-md p-6 flex flex-col flex-1">
            <h2 className="text-[#c4d2b8] font-semibold mb-3 text-lg">Monthly Reports</h2>
            <div className="flex-1">
              <MonthlyReports userId={user?.id} filterMonth={selectedMonth} isAdmin={isAdmin} />
            </div>
          </div>

          <div className="bg-[#1f1f1a] rounded-lg shadow-md p-6 flex flex-col flex-1">
            <h2 className="text-[#c4d2b8] font-semibold mb-3 text-lg">Weekly Reports</h2>
            <div className="flex-1">
              <WeeklyReports userId={user?.id} filterMonth={selectedMonth} isAdmin={isAdmin} />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )

  return (
    <>
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
    </>
  )
}
