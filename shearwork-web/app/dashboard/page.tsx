'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Layout from '@/components/Layout'
import WeeklyReports from '@/components/WeeklyReports'
import MonthlyReports from '@/components/MonthlyReports'
import UserProfile from '@/components/UserProfile'
import { supabase } from '@/utils/supabaseClient'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toLocaleString('default', { month: 'long' })
  )

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        setLoading(true)
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

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

  const dailyData = [
    { date: '2025-10-29', revenue: 1950, expenses: 460, clients: 49, returning: 44, newC: 5, avg: 39.8, top: 'Lineup' },
    { date: '2025-10-28', revenue: 1850, expenses: 430, clients: 47, returning: 43, newC: 4, avg: 39.36, top: 'Haircut' },
    { date: '2025-10-27', revenue: 2075, expenses: 500, clients: 53, returning: 49, newC: 4, avg: 39.15, top: 'Kids Haircut' },
    { date: '2025-10-26', revenue: 2200, expenses: 540, clients: 57, returning: 52, newC: 5, avg: 38.6, top: 'Haircut + Eyebrows' },
    { date: '2025-10-25', revenue: 1980, expenses: 450, clients: 50, returning: 45, newC: 5, avg: 39.6, top: 'Haircut' },
    { date: '2025-10-24', revenue: 2140, expenses: 520, clients: 55, returning: 49, newC: 6, avg: 38.91, top: 'Lineup' },
  ]

  return (
    <Layout>
      <motion.div
        className="p-6 space-y-6 h-screen flex flex-col text-[var(--foreground)]"
        initial="hidden"
        animate="visible"
      >
        {/* Header Section */}
        <motion.div variants={fadeInUp} custom={0}>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-[#F5E6C5]">Welcome back!</h1>
              <p className="text-sm text-[#bdbdbd]">Here’s your weekly overview.</p>
            </div>
            <div className="flex items-center gap-2">
              <UserProfile />
            </div>
          </div>
        </motion.div>

        {/* Month Selector */}
        <motion.div variants={fadeInUp} custom={1} className="flex justify-start items-center gap-3 mt-2 mb-4">
          <h3 className="text-[#bdbdbd] font-semibold">Viewing reports for</h3>
          <select
            className="bg-[#334030] rounded-md px-2 py-1 text-sm border border-[#55694b] text-black"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </motion.div>

        {/* Top Summary Boxes */}
        <motion.div variants={fadeInUp} custom={2} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: 'Appointments', value: 2 },
            { title: 'Clients', value: 1 },
            { title: 'Revenue', value: '$550' },
          ].map((item, i) => (
            <motion.div
              key={i}
              variants={fadeInUp}
              custom={i + 3}
              className="bg-[#F1F5E9] rounded-lg p-4"
            >
              <p className="text-xs text-gray-600">{item.title}</p>
              <p className="text-2xl font-bold text-gray-900">{item.value}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Middle Cards: Monthly & Weekly Reports */}
        <motion.div variants={fadeInUp} custom={6} className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
          <motion.div variants={fadeInUp} custom={7} className="bg-[#1f1f1a] rounded-xl p-6 shadow-md flex-1 min-h-0 overflow-y-auto">
            <h2 className="text-[#c4d2b8] text-lg font-semibold mb-4">Monthly Reports</h2>
            <MonthlyReports
              userId={user?.id}
              filterMonth={selectedMonth}
            />
          </motion.div>

          <motion.div variants={fadeInUp} custom={8} className="bg-[#1f1f1a] rounded-xl p-6 shadow-md flex-1 min-h-0 flex flex-col">
            <h2 className="text-[#c4d2b8] text-lg font-semibold mb-4 flex-shrink-0">
              Weekly Reports
            </h2>
            <div className="overflow-y-auto flex-1">
              <WeeklyReports
                userId={user?.id}
                filterMonth={selectedMonth}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Daily Summaries */}
        <motion.div variants={fadeInUp} custom={9} className="bg-[#1f1f1a] rounded-xl p-6 shadow-md overflow-x-auto">
          <h2 className="text-[#c4d2b8] text-lg font-semibold mb-4">Daily Summaries</h2>
          <div className="flex gap-4 pb-2">
            {dailyData.map((d, i) => (
              <motion.div
                key={i}
                variants={fadeInUp}
                custom={i + 10}
                className="min-w-[200px] bg-[#334030] rounded-lg p-4 flex-shrink-0 text-sm text-[#F1F5E9]"
              >
                <p className="font-semibold">{d.date}</p>
                <p>Revenue: ${d.revenue}</p>
                <p>Expenses: ${d.expenses}</p>
                <p>Total Clients: {d.clients}</p>
                <p>Returning: {d.returning}</p>
                <p>New: {d.newC}</p>
                <p>Avg Ticket: ${d.avg}</p>
                <p>Top: {d.top}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </Layout>
  )
}
