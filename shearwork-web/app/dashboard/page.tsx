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

  // Mobile menu with blur backdrop
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
      className={`p-6 space-y-6 text-[var(--foreground)] flex flex-col ${
        isMobile ? 'min-h-screen overflow-y-auto' : 'h-screen'
      }`}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={fadeInUp} custom={0}>
        {isMobile && (
          <div className="text-[var(--highlight)] text-2xl font-bold text-center">✂️ ShearWork</div>
        )}
        <div className="flex justify-between items-center flex-nowrap mb-2">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex flex-col truncate">
              <h1 className={`font-bold text-[#F5E6C5] ${isMobile ? 'text-xl' : 'text-3xl'} truncate`}>
                Welcome back!
              </h1>
              <p className="text-xs text-[#bdbdbd] truncate">Here’s your monthly summary.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {profile && <UserProfile />}
            {isMobile && (
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="text-2xl text-[var(--highlight)]"
              >
                ☰
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Month Selector */}
      <motion.div
        variants={fadeInUp}
        custom={1}
        className={`flex items-center gap-2 ${
          isMobile ? 'mt-1 mb-2 text-sm' : 'mt-2 mb-4'
        }`}
      >
        <h3 className="text-[#bdbdbd] font-semibold">Reports for</h3>
        <select
          className="bg-[#334030] rounded-md px-2 py-1 text-xs border border-[#55694b] text-black"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {MONTHS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </motion.div>

      {/* Revenue + Top Clients Row */}
      <motion.div
        variants={fadeInUp}
        custom={2}
        className={`grid gap-4 ${
          isMobile ? 'grid-cols-1' : 'grid-cols-2'
        }`}
      >
        <MonthlyRevenueCard userId={user?.id} selectedMonth={selectedMonth} />
        <TopClientsCard userId={user?.id} selectedMonth={selectedMonth} />
      </motion.div>

      {/* Reports Section */}
      <motion.div
        variants={fadeInUp}
        custom={6}
        className={`grid gap-4 flex-1 min-h-0 ${
          isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2 gap-6'
        }`}
      >
        <motion.div
          variants={fadeInUp}
          custom={7}
          className={`bg-[#1f1f1a] rounded-lg shadow-md ${
            isMobile ? 'p-3' : 'p-6'
          } flex-1 min-h-0 overflow-y-auto`}
        >
          <h2 className="text-[#c4d2b8] text-base font-semibold mb-2">
            Monthly Reports
          </h2>
          <MonthlyReports userId={user?.id} filterMonth={selectedMonth} />
        </motion.div>

        <motion.div
          variants={fadeInUp}
          custom={8}
          className={`bg-[#1f1f1a] rounded-lg shadow-md ${
            isMobile ? 'p-3' : 'p-6'
          } flex-1 min-h-0 flex flex-col`}
        >
          <h2 className="text-[#c4d2b8] text-base font-semibold mb-2 flex-shrink-0">
            Weekly Reports
          </h2>
          <div className="overflow-y-auto flex-1">
            <WeeklyReports userId={user?.id} filterMonth={selectedMonth} />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )

  return (
    <>
      {isMobile ? (
        <>
          {mobileMenuOpen && renderMobileMenu()}
          {content}
        </>
      ) : (
        <Layout>{content}</Layout>
      )}
    </>
  )
}
