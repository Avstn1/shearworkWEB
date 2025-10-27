'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter, usePathname } from 'next/navigation'
import Layout from '@/components/Layout'
import WeeklyReports from '@/components/WeeklyReports'
import MonthlyReports from '@/components/MonthlyReports'
import UserProfile from '@/components/UserProfile'
import toast from 'react-hot-toast'
import { useIsMobile } from '@/hooks/useIsMobile'
import { motion } from 'framer-motion'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'

interface Barber {
  user_id: string
  full_name: string
  avatar_url?: string
  role: string
}

interface ReportData {
  user_id: string
  type: 'weekly' | 'monthly'
  weekly: boolean
  week_number: number
  month: string
  year: number
  content: string
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const ITEMS_PER_PAGE = 6
const MOBILE_BREAKPOINT = 768

export default function AdminDashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile(MOBILE_BREAKPOINT)

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [filteredBarbers, setFilteredBarbers] = useState<Barber[]>([])
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [reportData, setReportData] = useState<ReportData>({
    user_id: '',
    type: 'weekly',
    weekly: true,
    week_number: 1,
    month: new Date().toLocaleString('default', { month: 'long' }),
    year: new Date().getFullYear(),
    content: '',
  })
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toLocaleString('default', { month: 'long' })
  )
  const [loading, setLoading] = useState(true)
  const [refreshReports, setRefreshReports] = useState<number>(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinksBase = [{ href: '/dashboard', label: 'Dashboard' }]

  useEffect(() => {
    const fetchUserAndProfile = async () => {
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

        if (!profileData || (profileData.role !== 'Owner' && profileData.role !== 'Admin')) {
          router.push('/dashboard')
        } else {
          setUserRole(profileData.role)
        }
      } catch (err) {
        console.error('Error fetching user/profile:', err)
        toast.error('Failed to fetch user profile.')
      }
    }

    fetchUserAndProfile()
  }, [router])

  useEffect(() => {
    async function fetchBarbers() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .ilike('role', 'barber')
          .order('full_name', { ascending: true })
        if (error) throw error
        setBarbers(data as Barber[])
        setFilteredBarbers(data as Barber[])
      } catch (err) {
        console.error('Fetch barbers failed:', err)
        toast.error('Failed to load barbers.')
      } finally {
        setLoading(false)
      }
    }
    fetchBarbers()
  }, [])

  useEffect(() => {
    const query = searchQuery.toLowerCase()
    const filtered = barbers.filter(b => b.full_name.toLowerCase().includes(query))
    setFilteredBarbers(filtered)
    setCurrentPage(1)
  }, [searchQuery, barbers])

  const totalPages = Math.ceil(filteredBarbers.length / ITEMS_PER_PAGE)
  const paginatedBarbers = filteredBarbers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleAddReport = async () => {
    if (!selectedBarber || !reportData.content.trim()) {
      return toast.error('Please fill the report content and select a barber.')
    }

    const payload: any = {
      user_id: selectedBarber.user_id,
      type: reportData.type,
      weekly: reportData.type === 'weekly',
      content: reportData.content.trim(),
      year: reportData.year,
      month: reportData.month,
      created_at: new Date().toISOString(),
    }

    if (reportData.type === 'weekly') payload.week_number = reportData.week_number

    const { error } = await supabase.from('reports').insert([payload])
    if (error) return toast.error(`Error adding report: ${error.message}`)

    toast.success('✅ Report added successfully!')
    setReportData({
      user_id: '',
      type: 'weekly',
      weekly: true,
      week_number: 1,
      month: new Date().toLocaleString('default', { month: 'long' }),
      year: new Date().getFullYear(),
      content: '',
    })
    setRefreshReports(prev => prev + 1)
  }

  if (!userRole) return <p>Checking access...</p>
  if (loading) return <p>Loading barbers...</p>

  const isAdmin = true

  // ----- MOBILE MENU -----
  const renderMobileMenu = () => {
    const navLinks = isAdmin
      ? navLinksBase.filter(link => link.href !== '/dashboard').concat({
          href: '/admin/dashboard',
          label: 'Admin Dashboard',
        })
      : navLinksBase

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex flex-col">
        <div className="bg-[var(--accent-2)] p-4 flex justify-between items-center">
          <span className="text-[var(--highlight)] text-lg font-bold">✂️ ShearWork</span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="text-[var(--text-bright)] text-xl"
          >
            ✕
          </button>
        </div>
        <nav className="flex flex-col p-4 space-y-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[var(--text-bright)] text-base font-semibold hover:text-[var(--highlight)]"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <SignOutButton className="w-full" />
        </div>
      </div>
    )
  }

  // ----- MAIN CONTENT -----
  const content = (
    <div className="p-3 sm:p-6 flex flex-col gap-5 text-[var(--foreground)] min-h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-[var(--highlight)]">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          {profile && <UserProfile />}
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-xl text-[var(--highlight)]"
            >
              ☰
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <input
          type="text"
          placeholder="Search barbers..."
          className="flex-1 bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-3)]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Barber List */}
      <section className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm">
        <h2 className="text-base font-semibold mb-3">Barbers</h2>
        <div
          className="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] sm:grid-cols-[repeat(auto-fit,minmax(120px,1fr))] 
                    gap-4 justify-items-center place-items-center"
        >
          {paginatedBarbers.length === 0 && <p>No barbers found.</p>}
          {paginatedBarbers.map((b) => (
            <div
              key={b.user_id}
              onClick={() =>
                setSelectedBarber(prev => prev?.user_id === b.user_id ? null : b)
              }
              className={`cursor-pointer bg-[var(--accent-2)]/80 text-[var(--text-bright)] p-3 
                        rounded-xl flex flex-col items-center justify-center 
                        transition-transform hover:scale-105 w-full max-w-[110px] sm:max-w-[140px]
                        ${
                          selectedBarber?.user_id === b.user_id
                            ? 'ring-2 ring-[var(--accent-3)]'
                            : ''
                        }`}
            >
              {b.avatar_url ? (
                <img
                  src={b.avatar_url}
                  alt={b.full_name}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full mb-1 object-cover border border-[var(--accent-3)]"
                />
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[var(--accent-3)] mb-1 flex items-center justify-center font-bold text-lg">
                  {b.full_name[0]}
                </div>
              )}
              <p className="text-xs sm:text-sm font-medium text-center leading-tight truncate w-full">
                {b.full_name}
              </p>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-4 gap-2 text-sm">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-[var(--accent-2)] text-[var(--text-bright)] disabled:opacity-40 hover:bg-[var(--accent-3)]"
            >
              Prev
            </button>
            <span className="px-2 py-1">{currentPage}/{totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-[var(--accent-2)] text-[var(--text-bright)] disabled:opacity-40 hover:bg-[var(--accent-3)]"
            >
              Next
            </button>
          </div>
        )}
      </section>


      {/* Reports Section */}
      {selectedBarber ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3 mt-2 mb-1">
            <h3 className="text-sm font-semibold text-[#bdbdbd]">Viewing reports for</h3>
            <select
              className="bg-[#2f3a2d] rounded-md px-2 py-1 text-xs border border-[#55694b] text-white"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm">
                <h3 className="text-base font-semibold mb-2">Monthly Reports</h3>
                <MonthlyReports
                  userId={selectedBarber.user_id}
                  filterMonth={selectedMonth}
                  isAdmin={isAdmin}
                  refresh={refreshReports}
                />
              </div>

              <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm">
                <h3 className="text-base font-semibold mb-2">Weekly Reports</h3>
                <WeeklyReports
                  userId={selectedBarber.user_id}
                  filterMonth={selectedMonth}
                  isAdmin={isAdmin}
                  refresh={refreshReports}
                />
              </div>
            </div>

            {/* Add report */}
            <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm">
              <h3 className="text-base font-semibold mb-3">
                Add Report for {selectedBarber.full_name}
              </h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <select
                  className="bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] rounded-md px-2 py-1 text-xs"
                  value={reportData.type}
                  onChange={(e) =>
                    setReportData({
                      ...reportData,
                      type: e.target.value as 'weekly' | 'monthly',
                      weekly: e.target.value === 'weekly',
                    })
                  }
                >
                  <option value="weekly" className="text-black">Weekly</option>
                  <option value="monthly" className="text-black">Monthly</option>
                </select>

                {reportData.type === 'weekly' && (
                  <select
                    className="bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] rounded-md px-2 py-1 text-xs"
                    value={reportData.week_number}
                    onChange={(e) =>
                      setReportData({ ...reportData, week_number: Number(e.target.value) })
                    }
                  >
                    {[1,2,3,4,5].map((week) => (
                      <option key={week} value={week}>Week {week}</option>
                    ))}
                  </select>
                )}
                <select
                  className="bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] rounded-md px-2 py-1 text-xs col-span-2"
                  value={reportData.month}
                  onChange={(e) => setReportData({ ...reportData, month: e.target.value })}
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Year"
                  className="bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] rounded-md px-2 py-1 text-xs col-span-2"
                  value={reportData.year}
                  onChange={(e) => setReportData({ ...reportData, year: Number(e.target.value) })}
                />

                <textarea
                  placeholder="Report content..."
                  className="bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] rounded-md px-2 py-1 col-span-2 h-24 text-xs"
                  value={reportData.content}
                  onChange={(e) => setReportData({ ...reportData, content: e.target.value })}
                />
              </div>

              <button
                onClick={handleAddReport}
                className="bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] rounded-md px-4 py-2 text-xs font-semibold transition-all shadow-sm w-full"
              >
                Add Report
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-8 shadow-sm text-center text-[var(--text-muted)]">
          Click a barber to display or add reports
        </div>
      )}
    </div>
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
