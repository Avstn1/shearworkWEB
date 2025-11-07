'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/utils/supabaseClient'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/useIsMobile'

import AdminRevenueEditor from '@/components/AdminComponents/AdminRevenueEditor'
import TopClientsEditor from '@/components/AdminComponents/TopClientsEditor'
import AdminAverageTicketEditor from '@/components/AdminComponents/AdminAverageTicketEditor'
import AdminServiceBreakdownEditor from '@/components/AdminComponents/AdminServiceBreakdownEditor'
import AdminMarketingFunnelsEditor from '@/components/AdminComponents/AdminMarketingFunnelsEditor'
import WeeklyReports from '@/components/Dashboard/WeeklyReports'
import WeeklyComparisonReports from '@/components/Dashboard/WeeklyComparisonReports'
import MonthlyReports from '@/components/Dashboard/MonthlyReports'
import UserProfile from '@/components/UserProfile'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

export default function UserEditorPage() {
  const router = useRouter()
  const isMobile = useIsMobile(768)

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleString('default', { month: 'long' })
  )
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [activeTab, setActiveTab] = useState<'revenue' | 'clients' | 'ticket' | 'breakdown' | 'funnels' | 'reports'>('revenue')

  // Fetch user & profile
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) return router.push('/login')
        setUser(user)

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
        if (profileError) throw profileError
        setProfile(profileData)
      } catch (err) {
        console.error('Error fetching user/profile:', err)
        toast.error('Failed to fetch user profile.')
      }
    }
    fetchUser()
  }, [router])

  if (!user || !profile) {
    return (
      <div className="flex justify-center items-center h-screen text-[#bdbdbd]">
        Loading your dashboard...
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <motion.div
        className="min-h-screen pt-[100px] px-4 sm:px-8 pb-8 bg-gradient-to-br from-[#0e100f] via-[#1a1e18] to-[#2b3a29] text-[var(--foreground)]"
        initial="hidden"
        animate="visible"
      >
        {/* HEADER */}
        <motion.div
          variants={fadeInUp}
          className="flex flex-wrap justify-between items-center gap-4 mb-6"
        >
          <div>
            <h1 className="font-bold bg-gradient-to-r from-amber-200 to-lime-400 bg-clip-text text-transparent text-2xl animate-gradient">
              Barber Data Editor
            </h1>
            <p className="text-xs text-[#bdbdbd]">Manage analytics and insights in real time.</p>
          </div>
        </motion.div>

        {/* Month / Year Selectors */}
        <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-[#d4e1c1]">Month:</label>
            {/* Month Selector */}
            <select
            value={selectedMonth ?? ''}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="ml-2 px-4 py-2 rounded-full bg-zinc-900/90 text-white text-sm font-semibold border border-zinc-700 shadow-[0_0_10px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 transition-all hover:border-amber-300 hover:shadow-[0_0_15px_rgba(255,200,100,0.2)]"
            >
            <option value="" disabled className="text-gray-400">
                Select Month
            </option>
            {MONTHS.map((m) => (
                <option
                key={m}
                value={m}
                className="bg-zinc-900 text-white font-semibold"
                >
                {m}
                </option>
            ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-[#d4e1c1]">Year:</label>
            <select
            value={selectedYear ?? ''}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="ml-2 px-4 py-2 rounded-full bg-zinc-900/90 text-white text-sm font-semibold border border-zinc-700 shadow-[0_0_10px_rgba(255,255,255,0.1)] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 transition-all hover:border-amber-300 hover:shadow-[0_0_15px_rgba(255,200,100,0.2)]"
            >
            <option value="" disabled className="text-gray-400">
                Select Year
            </option>
            {YEARS.map((y) => (
                <option
                key={y}
                value={y}
                className="bg-zinc-900 text-white font-semibold"
                >
                {y}
                </option>
            ))}
            </select>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          variants={fadeInUp}
          className="flex flex-wrap gap-2 border-b border-white/10 pb-2 mb-4"
        >
          {[
            { key: 'revenue', label: 'Revenue' },
            { key: 'clients', label: 'Top Clients' },
            { key: 'breakdown', label: 'Service Breakdown' },
            { key: 'funnels', label: 'Marketing Funnels' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-amber-400 to-lime-400 text-black shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Main Content */}
        <motion.div variants={fadeInUp} className="grid gap-6">
          {activeTab === 'revenue' && (
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6">
              <AdminRevenueEditor barberId={user.id} month={selectedMonth} year={selectedYear} />
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6">
              <TopClientsEditor barberId={user.id} month={selectedMonth} year={selectedYear} />
            </div>
          )}

          {/* {activeTab === 'ticket' && (
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6">
              <AdminAverageTicketEditor month={selectedMonth} barberId={user.id} />
            </div>
          )} */}

          {activeTab === 'breakdown' && (
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6">
              <AdminServiceBreakdownEditor month={selectedMonth} barberId={user.id} />
            </div>
          )}

          {activeTab === 'funnels' && (
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6">
              <AdminMarketingFunnelsEditor month={selectedMonth} barberId={user.id} />
            </div>
          )}
        </motion.div>
      </motion.div>
    </>
  )
}
