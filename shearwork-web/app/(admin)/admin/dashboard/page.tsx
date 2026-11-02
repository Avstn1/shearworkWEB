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
import { AppPage, PageHeader, Panel, Segmented, EmptyState } from '@/components/ui/AppKit'
import { CalendarClock, ChevronLeft, ChevronRight, RefreshCw, Search, Users } from 'lucide-react'

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

      toast.success('Report generated and saved successfully!')
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

      toast.success('Yearly appointments sync completed successfully!')
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

      toast.success('Client sync completed successfully!')
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

        if (!profileData || profileData.role !== 'Admin') {
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
          .not('full_name', 'is', null)
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

    toast.success('Report added successfully!')
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

  if (!userRole) return <AppPage><p className="text-sm text-muted">Checking access...</p></AppPage>
  if (loading) return <AppPage><p className="text-sm text-muted">Loading barbers...</p></AppPage>

  const isAdmin = true

  return (
    <AppPage>
      <PageHeader
        title="Admin dashboard"
        subtitle="Pick a barber to manage reports and monthly figures."
        actions={profile && <UserProfile />}
      />

      <div className="flex flex-col gap-4">
        {/* Filters & actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search barbers..."
              className="field !pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="field !w-auto"
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
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <button onClick={handleYearlySync} className="btn btn-glass btn-sm whitespace-nowrap">
              <RefreshCw size={16} strokeWidth={1.75} />
              Manual Yearly Acuity Sync (ALL)
            </button>
            <button onClick={() => router.push('/admin/qstash')} className="btn btn-glass btn-sm whitespace-nowrap">
              <CalendarClock size={16} strokeWidth={1.75} />
              QStash Schedules
            </button>
          </div>
        </div>

        {/* --- Barbers List with Pagination --- */}
        <section className="panel">
          <header className="panel-header">
            <div className="min-w-0">
              <h2 className="panel-title">Barbers</h2>
              <p className="panel-subtitle">{filteredBarbers.length} total</p>
            </div>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex shrink-0 items-center gap-1 text-xs text-muted">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="btn btn-ghost btn-sm !h-8 !px-2"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} strokeWidth={1.75} />
                </button>
                <span className="tabular-nums">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="btn btn-ghost btn-sm !h-8 !px-2"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} strokeWidth={1.75} />
                </button>
              </div>
            )}
          </header>
          <div className="overflow-x-auto p-3">
            <div className="flex w-max min-w-full gap-2">
              {paginatedBarbers.length === 0 && <p className="px-2 py-4 text-sm text-muted">No barbers found.</p>}
              {paginatedBarbers.map((b) => {
                const active = selectedBarber?.user_id === b.user_id
                return (
                  <button
                    type="button"
                    key={b.user_id}
                    onClick={() => setSelectedBarber(prev => prev?.user_id === b.user_id ? null : b)}
                    className={`flex w-24 flex-col items-center justify-center gap-1.5 rounded-lg border p-3 transition-colors sm:w-32 ${
                      active
                        ? 'border-sage/50 bg-sage/10'
                        : 'border-white/[0.07] bg-raised hover:border-white/[0.12]'
                    }`}
                  >
                    {b.avatar_url ? (
                      <img src={b.avatar_url} alt={b.full_name} className="h-11 w-11 rounded-full border border-white/[0.12] object-cover sm:h-12 sm:w-12" />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-base font-semibold text-ivory sm:h-12 sm:w-12">
                        {b.full_name[0]}
                      </div>
                    )}
                    <p className={`w-full truncate text-center text-xs font-medium leading-tight sm:text-[13px] ${active ? 'text-sage-bright' : 'text-ivory'}`}>{b.full_name}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {selectedBarber ? (
          <>
            <div className="overflow-x-auto">
              <Segmented
                value={activeTab}
                onChange={setActiveTab}
                options={[
                  { value: 'addReport', label: 'Add Report' },
                  { value: 'revenue', label: 'Revenue' },
                  { value: 'clients', label: 'Top Clients' },
                  { value: 'ticket', label: 'Average Ticket' },
                  { value: 'breakdown', label: 'Service Breakdown' },
                  { value: 'funnels', label: 'Marketing Funnels' },
                ]}
              />
            </div>

            {activeTab === 'addReport' && (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <Panel title="Monthly reports">
                    <MonthlyReports
                      userId={selectedBarber.user_id}
                      filterMonth={selectedMonth}
                      isAdmin={isAdmin}
                      refresh={refreshReports}
                    />
                  </Panel>

                  <Panel title="Weekly reports">
                    <WeeklyReports
                      userId={selectedBarber.user_id}
                      filterMonth={selectedMonth}
                      isAdmin={isAdmin}
                      refresh={refreshReports}
                    />
                  </Panel>

                  <Panel title="Weekly comparison reports">
                    <WeeklyComparisonReports
                      userId={selectedBarber.user_id}
                      filterMonth={selectedMonth}
                      isAdmin={isAdmin}
                      refresh={refreshReports}
                    />
                  </Panel>
                </div>

                <Panel title={`Add report for ${selectedBarber.full_name}`} subtitle={`${selectedMonth} ${reportData.year}`}>
                  <div className="mb-4 flex w-full flex-wrap gap-3">
                    <div className="min-w-[180px] flex-1">
                      <label className="field-label">Report type</label>
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
                        className="field"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="weekly_comparison">Weekly Comparison</option>
                      </select>
                    </div>

                    {(reportData.type === 'weekly' || reportData.type === 'weekly_comparison') && (
                      <div className="w-32">
                        <label className="field-label">Week number</label>
                        <select
                          value={reportData.week_number}
                          onChange={(e) =>
                            setReportData({ ...reportData, week_number: Number(e.target.value) })
                          }
                          className="field"
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

                    <div className="w-32">
                      <label className="field-label">Year</label>
                      <select
                        value={reportData.year}
                        onChange={(e) => setReportData({ ...reportData, year: Number(e.target.value) })}
                        className="field"
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-white/[0.07]">
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
                          body { font-family:system-ui,-apple-system,'Segoe UI',sans-serif; font-size:14px; color:#ECEDEA; background-color:#171A18; }
                          table { width:100%; border-collapse:collapse; }
                          th, td { border:1px solid rgba(255,255,255,0.12); padding:6px; }
                          th { background:#1D201E; white-space:nowrap; }
                        `,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button onClick={handleAddReport} className="btn btn-primary btn-sm">
                      Add report
                    </button>
                  </div>

                  <div className="divider my-4" />
                  <p className="field-label">Generate with AI</p>
                  <div className="flex flex-wrap gap-2">
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
                        className="btn btn-glass btn-sm"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </Panel>
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
          <div className="panel">
            <EmptyState icon={Users} title="No barber selected">
              Select a barber to view reports and add new reports.
            </EmptyState>
          </div>
        )}
      </div>
    </AppPage>
  )
}
