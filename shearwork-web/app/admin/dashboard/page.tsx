/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import WeeklyReports from '@/components/Dashboard/WeeklyReports'
import WeeklyComparisonReports from '@/components/Dashboard/WeeklyComparisonReports'
import MonthlyReports from '@/components/Dashboard/MonthlyReports'
import UserProfile from '@/components/UserProfile'
import toast from 'react-hot-toast'
import { useIsMobile } from '@/hooks/useIsMobile'
import AdminRevenueEditor from '@/components/AdminComponents/AdminRevenueEditor'
import TopClientsEditor from '@/components/AdminComponents/TopClientsEditor'
import { Editor } from '@tinymce/tinymce-react'
import Navbar from '@/components/Navbar'
import AdminServiceBreakdownEditor from '@/components/AdminComponents/AdminServiceBreakdownEditor'
import AdminAverageTicketEditor from '@/components/AdminComponents/AdminAverageTicketEditor'
import AdminMarketingFunnelsEditor from '@/components/AdminComponents/AdminMarketingFunnelsEditor'

interface Barber {
  user_id: string
  full_name: string
  avatar_url?: string
  role: string
}

interface ReportData {
  user_id: string
  type: 'weekly' | 'monthly' | 'weekly_comparison'
  week_number: number
  month: string
  year: number
  content: string
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
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

  const [activeTab, setActiveTab] = useState<'revenue' | 'clients' | 'ticket' | 'breakdown' | 'funnels' | 'addReport'>('addReport')

  const handleGenerateReport = async (type: 
    'monthly/rental' | 'monthly/commission' |
    'weekly/rental' | 'weekly/commission' |
    'weekly_comparison/rental' | 'weekly_comparison/commission'
  ) => {
    if (!selectedBarber) {
      toast.error('Please select a barber first.')
      return
    }

    try {
      toast.loading('Generating report...')

      const url = `/api/openai/generate`
      const token = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          user_id: selectedBarber.user_id,
          month: selectedMonth,
          year: reportData.year,
          week_number: reportData.week_number,
        }),
      })

      const data = await response.json()
      console.log('Raw response:', data)
      
      toast.dismiss()

      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to generate report.')

      toast.success('✅ Report generated and saved successfully!')
      setRefreshReports(prev => prev + 1)

    } catch (err: any) {
      console.error(err)
      toast.dismiss()
      toast.error(err.message || 'Failed to generate report.')
    }
  }

  const handleYearlySync = async () => {
    try {
      toast.loading('Syncing all Acuity appointments...')
      
      const token = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      const response = await fetch('/api/analytics/acuity_sync_yearly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()
      toast.dismiss()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync Acuity appointments.')
      }

      toast.success('✅ Yearly appointments sync completed successfully!')
    } catch (err: any) {
      console.error(err)
      toast.dismiss()
      toast.error(err.message || 'Failed to sync Acuity appointments.')
    }
  }

  const handleClientsSync = async () => {
    try {
      toast.loading('Syncing all Acuity clients...')
      
      const token = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      const response = await fetch('/api/analytics/acuity_sync_clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()
      toast.dismiss()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to sync Acuity clients.')
      }

      toast.success('✅ Client sync completed successfully!')
    } catch (err: any) {
      console.error(err)
      toast.dismiss()
      toast.error(err.message || 'Failed to sync Acuity clients.')
    }
  }

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
      month: selectedMonth,
      created_at: new Date().toISOString(),
    }

    if (reportData.type === 'weekly' || reportData.type === 'weekly_comparison') {
      payload.week_number = reportData.week_number
    }

    const { error } = await supabase.from('reports').insert([payload])
    if (error) return toast.error(`Error adding report: ${error.message}`)

    toast.success('✅ Report added successfully!')
    setReportData({
      user_id: '',
      type: 'weekly',
      week_number: 1,
      month: selectedMonth,
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
      <Navbar />
      <div className="flex flex-col gap-5 text-[var(--foreground)] bg-[var(--background)] min-h-screen p-3 sm:p-6 overflow-y-auto">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h1 className="text-2xl font-semibold text-[var(--highlight)] truncate flex-1 min-w-0">
            Admin Dashboard
          </h1>
          {profile && <UserProfile />}
        </div>

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
          <button
            onClick={handleYearlySync}
            className="h-10 px-4 rounded-md bg-[var(--accent-1)] hover:bg-[var(--accent-2)] text-[var(--text-bright)] text-sm whitespace-nowrap"
          >
            Manual Yearly Acuity Sync (ALL)
          </button>

          <button
            onClick={() => router.push('/admin/qstash')}
            className="h-10 px-4 rounded-md bg-[var(--accent-1)] hover:bg-[var(--accent-2)] text-[var(--text-bright)] text-sm whitespace-nowrap"
          >
            QStash Schedules
          </button>
        </div>

        

        {/* --- Barbers List with Pagination --- */}
        <section className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm overflow-x-auto">
          <h2 className="text-base font-semibold mb-3">Barbers</h2>
          <div className="flex gap-4 w-max min-w-full">
            {paginatedBarbers.length === 0 && <p>No barbers found.</p>}
            {paginatedBarbers.map((b) => (
              <div
                key={b.user_id}
                onClick={() => setSelectedBarber(prev => prev?.user_id === b.user_id ? null : b)}
                className={`cursor-pointer bg-[var(--accent-2)]/80 text-[var(--text-bright)] p-3 rounded-xl flex flex-col items-center justify-center transition-transform hover:scale-105 w-24 sm:w-32 ${
                  selectedBarber?.user_id === b.user_id ? 'ring-2 ring-[var(--accent-3)]' : ''
                }`}
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-3">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-md bg-[var(--accent-3)] text-[var(--text-bright)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-4)]"
              >
                &larr;
              </button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-md bg-[var(--accent-3)] text-[var(--text-bright)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-4)]"
              >
                &rarr;
              </button>
            </div>
          )}
        </section>

        {selectedBarber ? (
          <>
            <div className="flex gap-3 border-b border-[var(--accent-2)]/50 pb-2 mb-3 flex-wrap">
              {[
                { key: 'addReport', label: 'Add Report' },
                { key: 'revenue', label: 'Revenue' },
                { key: 'clients', label: 'Top Clients' },
                { key: 'ticket', label: 'Average Ticket' },
                { key: 'breakdown', label: 'Service Breakdown' },
                { key: 'funnels', label: 'Marketing Funnels' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-3 py-1.5 rounded-md text-sm ${
                    activeTab === tab.key
                      ? 'bg-[var(--accent-3)] text-[var(--text-bright)]'
                      : 'bg-transparent hover:bg-[var(--accent-1)]/30'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'addReport' && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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

                  <div className="bg-[var(--accent-2)]/10 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm">
                    <h3 className="text-base font-semibold mb-2">Weekly Comparison Reports</h3>
                    <WeeklyComparisonReports
                      userId={selectedBarber.user_id}
                      filterMonth={selectedMonth}
                      isAdmin={isAdmin}
                      refresh={refreshReports}
                    />
                  </div>
                </div>

                <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-4 shadow-sm">
                  <h3 className="text-base font-semibold mb-3">
                    Add Report for {selectedBarber.full_name}
                  </h3>

                  <div className="flex gap-2 flex-wrap w-full mb-4">
                    <div className="flex-1">
                      <label className="block mb-1 font-semibold">Report Type</label>
                      <select
                        value={reportData.type}
                        onChange={(e) => {
                          const newType = e.target.value as ReportData['type']
                          setReportData(prev => ({
                            ...prev,
                            type: newType,
                            week_number: newType === 'weekly_comparison' ? 2 : 1,
                          }))
                        }}
                        className="w-full p-2 rounded bg-[var(--accent-3)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--highlight)]"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="weekly_comparison">Weekly Comparison</option>
                      </select>
                    </div>

                    {(reportData.type === 'weekly' || reportData.type === 'weekly_comparison') && (
                      <div>
                        <label className="block mb-1 font-semibold">Week Number</label>
                        <select
                          value={reportData.week_number}
                          onChange={(e) =>
                            setReportData({ ...reportData, week_number: Number(e.target.value) })
                          }
                          className="w-full p-2 rounded bg-[var(--accent-3)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--highlight)]"
                        >
                          {(reportData.type === 'weekly'
                            ? [1, 2, 3, 4, 5]
                            : [2, 3, 4, 5]
                          ).map(w => (
                            <option key={w} value={w}>
                              Week {w}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block mb-1 font-semibold">Year</label>
                      <select
                        value={reportData.year}
                        onChange={(e) => setReportData({ ...reportData, year: Number(e.target.value) })}
                        className="w-full p-2 rounded bg-[var(--accent-3)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--highlight)]"
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <Editor
                    apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY}
                    value={reportData.content}
                    onEditorChange={(newValue) =>
                      setReportData({ ...reportData, content: newValue })
                    }
                    init={{
                      height: 300,
                      menubar: false,
                      plugins: [
                        'advlist',
                        'autolink',
                        'lists',
                        'link',
                        'charmap',
                        'preview',
                        'anchor',
                        'code',
                        'fullscreen',
                        'insertdatetime',
                        'media',
                        'table',
                        'help',
                        'wordcount',
                      ],
                      toolbar:
                        'undo redo | formatselect | bold italic backcolor | ' +
                        'alignleft aligncenter alignright alignjustify | ' +
                        'bullist numlist outdent indent | removeformat | help',
                      content_style: `
                        body { font-family:Helvetica,Arial,sans-serif; font-size:14px; color:#F1F5E9; background-color:#1f2420; }
                        table { width:100%; border-collapse:collapse; }
                        th, td { border:1px solid #444; padding:6px; }
                        th { background:#333; white-space:nowrap; }
                      `,
                    }}
                  />
                  <button
                    onClick={handleAddReport}
                    className="bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] px-4 py-2 rounded-md mt-2"
                  >
                    Add Report
                  </button>

                  <div className="flex flex-wrap gap-2 mt-4 border-t border-[var(--accent-2)]/50 pt-3">
                    {[
                      { label: 'Monthly Report (Rental)', type: 'monthly/rental' },
                      { label: 'Monthly Report (Commission)', type: 'monthly/commission' },
                      { label: 'Weekly Report (Rental)', type: 'weekly/rental' },
                      { label: 'Weekly Report (Commission)', type: 'weekly/commission' },
                      { label: 'Weekly Comparison (Rental)', type: 'weekly_comparison/rental' },
                      { label: 'Weekly Comparison (Commission)', type: 'weekly_comparison/commission' },
                    ].map(btn => (
                      <button
                        key={btn.type}
                        onClick={() => handleGenerateReport(btn.type as any)}
                        className="bg-[var(--accent-1)] hover:bg-[var(--accent-2)] text-[var(--text-bright)] px-4 py-2 rounded-md"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>


                </div>
              </div>
            )}

            {activeTab === 'revenue' && (
              <AdminRevenueEditor barberId={selectedBarber.user_id} month={selectedMonth} year={reportData.year} />
            )}
            {activeTab === 'clients' && (
              <TopClientsEditor barberId={selectedBarber.user_id} month={selectedMonth} year={reportData.year} />
            )}
            {activeTab === 'ticket' && (
              <AdminAverageTicketEditor month={selectedMonth} barberId={selectedBarber.user_id} />
            )}
            {activeTab === 'breakdown' && (
              <AdminServiceBreakdownEditor month={selectedMonth} barberId={selectedBarber.user_id} />
            )}
            {activeTab === 'funnels' && (
              <AdminMarketingFunnelsEditor month={selectedMonth} barberId={selectedBarber.user_id} />
            )}
          </>
        ) : (
          <p className="text-sm text-[#bdbdbd] mt-4">Select a barber to view reports and add new reports.</p>
        )}
      </div>
    </>
  )
}