'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import WeeklyReports from '@/components/WeeklyReports'
import MonthlyReports from '@/components/MonthlyReports'
import UserProfile from '@/components/UserProfile'
import toast from 'react-hot-toast'
import { useIsMobile } from '@/hooks/useIsMobile'
import AdminRevenueEditor from '@/components/AdminRevenueEditor'
import TopClientsEditor from '@/components/TopClientsEditor'
import { Editor } from '@tinymce/tinymce-react'
import Navbar from '@/components/Navbar'

// NEW: admin editors you asked to integrate
import AdminServiceBreakdownEditor from '@/components/AdminServiceBreakdownEditor'
import AdminAverageTicketEditor from '@/components/AdminAverageTicketEditor'
import AdminMarketingFunnelsEditor from '@/components/AdminMarketingFunnelsEditor'

interface Barber {
  user_id: string
  full_name: string
  avatar_url?: string
  role: string
}

interface ReportData {
  user_id: string
  type: 'weekly' | 'monthly'
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
  const [monthlyReportExists, setMonthlyReportExists] = useState(false)

  // --- User & Profile ---
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

  // --- Fetch Barbers ---
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

  // --- Filter Barbers ---
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

  // --- Add Report ---
  const handleAddReport = async () => {
    if (!selectedBarber || !reportData.content.trim()) {
      return toast.error('Please fill the report content and select a barber.')
    }

    const payload: any = {
      user_id: selectedBarber.user_id,
      type: reportData.type,
      content: reportData.content.trim(),
      year: reportData.year,
      month: reportData.month,
      created_at: new Date().toISOString(),
    }

    if (reportData.type === 'weekly') {
      payload.week_number = reportData.week_number
    }

    const { error } = await supabase.from('reports').insert([payload])
    if (error) return toast.error(`Error adding report: ${error.message}`)

    toast.success('✅ Report added successfully!')
    setReportData({
      user_id: '',
      type: 'weekly',
      week_number: 1,
      month: new Date().toLocaleString('default', { month: 'long' }),
      year: new Date().getFullYear(),
      content: '',
    })
    setRefreshReports(prev => prev + 1)
  }

  // --- Check if monthly report exists ---
  useEffect(() => {
    if (!selectedBarber || !selectedMonth) return

    const checkMonthlyReport = async () => {
      try {
        const { data: reports, error } = await supabase
          .from('reports')
          .select('id')
          .eq('user_id', selectedBarber.user_id)
          .eq('type', 'monthly')
          .eq('month', selectedMonth)
          .eq('year', reportData.year)
          .limit(1)

        if (error && error.code !== 'PGRST116') throw error
        setMonthlyReportExists(Array.isArray(reports) && reports.length > 0)
      } catch (err) {
        console.error('Error checking monthly report:', err)
        setMonthlyReportExists(false)
      }
    }

    checkMonthlyReport()
  }, [selectedBarber, selectedMonth, reportData.year])

  if (!userRole) return <p>Checking access...</p>
  if (loading) return <p>Loading barbers...</p>

  const isAdmin = true

  return (
    <>
      <Navbar/>
      <div className="flex flex-col gap-5 text-[var(--foreground)] bg-[var(--background)] min-h-screen p-3 sm:p-6 overflow-y-auto">

        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h1 className="text-2xl font-semibold text-[var(--highlight)] truncate flex-1 min-w-0">
            Admin Dashboard
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            {profile && <UserProfile />}
          </div>
        </div>

        {/* Search + Month Selector */}
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Search barbers..."
            className="flex-shrink-0 w-full sm:w-64 h-10 bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-3)]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <select
            className="h-10 px-3 rounded-md bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] text-sm"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value)
              setRefreshReports(prev => prev + 1)
            }}
          >
            {MONTHS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Barber List */}
        <section className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm overflow-x-auto">
          <h2 className="text-base font-semibold mb-3">Barbers</h2>
          <div className="flex gap-4 w-max min-w-full">
            {paginatedBarbers.length === 0 && <p>No barbers found.</p>}
            {paginatedBarbers.map((b) => (
              <div
                key={b.user_id}
                onClick={() =>
                  setSelectedBarber(prev => prev?.user_id === b.user_id ? null : b)
                }
                className={`cursor-pointer bg-[var(--accent-2)]/80 text-[var(--text-bright)] p-3 rounded-xl flex flex-col items-center justify-center transition-transform hover:scale-105 w-24 sm:w-32
                  ${selectedBarber?.user_id === b.user_id ? 'ring-2 ring-[var(--accent-3)]' : ''}`}
              >
                {b.avatar_url ? (
                  <img src={b.avatar_url} alt={b.full_name} className="w-12 h-12 sm:w-14 sm:h-14 rounded-full mb-1 object-cover border border-[var(--accent-3)]" />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[var(--accent-3)] mb-1 flex items-center justify-center font-bold text-lg">
                    {b.full_name[0]}
                  </div>
                )}
                <p className="text-xs sm:text-sm font-medium text-center leading-tight truncate w-full">{b.full_name}</p>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-4 gap-2 text-sm flex-wrap">
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

        {/* Reports & Add Report */}
        {selectedBarber ? (
          <div className="flex flex-col gap-6">

            <div className="flex flex-col xl:flex-row gap-4">

              {/* Reports */}
              <div className="flex flex-col gap-4 flex-1">
                <div className="bg-[var(--accent-4)]/10 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm">
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

              {/* Add Report */}
              <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm flex-1 min-w-0">
                <h3 className="text-base font-semibold mb-3">Add Report for {selectedBarber.full_name}</h3>
                <div className="flex flex-col gap-2">

                  {/* Report Type */}
                  <div className="flex gap-2 flex-wrap">
                    <select
                      className="bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] rounded-md px-2 py-1 text-xs"
                      value={reportData.type}
                      onChange={(e) =>
                        setReportData({
                          ...reportData,
                          type: e.target.value as 'weekly' | 'monthly',
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
                      className="bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] rounded-md px-2 py-1 text-xs"
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
                      className="bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] rounded-md px-2 py-1 text-xs"
                      value={reportData.year}
                      onChange={(e) => setReportData({ ...reportData, year: Number(e.target.value) })}
                    />
                  </div>

                  {/* TinyMCE Editor */}
                  <Editor
                    apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY}
                    value={reportData.content}
                    onEditorChange={(newValue) => setReportData({ ...reportData, content: newValue })}
                    init={{
                      height: 300,
                      width: '100%',
                      menubar: false,
                      plugins: [
                        'advlist','autolink','lists','link','charmap','preview','anchor',
                        'code','fullscreen','insertdatetime','media','table','help','wordcount'
                      ],
                      toolbar:
                        'undo redo | formatselect | bold italic backcolor | ' +
                        'alignleft aligncenter alignright alignjustify | ' +
                        'bullist numlist outdent indent | removeformat | help',
                      content_style: `
                        body { 
                          font-family:Helvetica,Arial,sans-serif; 
                          font-size:14px; 
                          color:#F1F5E9;
                          background-color:#1f2420;
                        }
                      `
                    }}
                  />

                  <button
                    onClick={handleAddReport}
                    className="bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] px-4 py-2 rounded-md mt-2"
                  >
                    Add Report
                  </button>
                </div>
              </div>
            </div>

            {/* Admin Revenue & Top Clients Editors */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <AdminRevenueEditor barberId={selectedBarber.user_id} month={selectedMonth} year={reportData.year} />
              <TopClientsEditor barberId={selectedBarber.user_id} month={selectedMonth} year={reportData.year} />
            </div>

            {/* Admin Tools - new editors grouped together */}
            <div className="mt-4">
              <h3 className="text-base font-semibold mb-3">Admin Tools</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AdminAverageTicketEditor month={selectedMonth} barberId={selectedBarber.user_id} />
                <AdminServiceBreakdownEditor month={selectedMonth} barberId={selectedBarber.user_id} />
                <AdminMarketingFunnelsEditor month={selectedMonth} barberId={selectedBarber.user_id} />
              </div>
            </div>

          </div>
        ) : (
          <p className="text-sm text-[#bdbdbd] mt-4">Select a barber to view reports and add new reports.</p>
        )}

      </div>
    </>
  )
}
