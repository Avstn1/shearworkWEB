'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import WeeklyReports from '@/components/WeeklyReports'
import MonthlyReports from '@/components/MonthlyReports'
import UserProfile from '@/components/UserProfile'
import toast from 'react-hot-toast'

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

export default function AdminDashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [reportData, setReportData] = useState<ReportData>({
    user_id: '',
    type: 'weekly',
    weekly: true,
    week_number: 1,
    month: 'January',
    year: new Date().getFullYear(),
    content: '',
  })
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toLocaleString('default', { month: 'long' })
  )
  const [loading, setLoading] = useState(true)
  const [refreshReports, setRefreshReports] = useState<number>(0)

  // Fetch user & profile for top-right display and access control
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

  // Fetch barbers
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
      } catch (err) {
        console.error('Fetch barbers failed:', err)
        toast.error('Failed to load barbers.')
      } finally {
        setLoading(false)
      }
    }
    fetchBarbers()
  }, [])

  // Add report handler
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
      month: 'January',
      year: new Date().getFullYear(),
      content: '',
    })
    setRefreshReports(prev => prev + 1)
  }

  if (!userRole) return <p>Checking access...</p>
  if (loading) return <p>Loading barbers...</p>

  return (
    <Layout>
      <div className="p-6 flex flex-col gap-6 text-[var(--foreground)] h-screen">
        {/* Header with top-right UserProfile */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-semibold mb-4 text-[var(--highlight)]">Admin Dashboard</h1>
          {profile && <UserProfile />}
        </div>

        {/* Barber List */}
        <section className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-2xl p-5 shadow-md">
          <h2 className="text-xl font-semibold mb-3">Barbers</h2>
          <div className="flex flex-wrap gap-4">
            {barbers.length === 0 && <p>No barbers found.</p>}
            {barbers.map((b) => (
              <div
                key={b.user_id}
                onClick={() =>
                  setSelectedBarber(prev => prev?.user_id === b.user_id ? null : b)
                }
                className={`cursor-pointer bg-[var(--accent-2)] text-[var(--text-bright)] p-4 rounded-xl flex flex-col items-center min-w-[180px] transition-transform hover:scale-105 ${
                  selectedBarber?.user_id === b.user_id ? 'ring-4 ring-[var(--accent-3)]' : ''
                }`}
              >
                {b.avatar_url ? (
                  <img
                    src={b.avatar_url}
                    alt={b.full_name}
                    className="w-16 h-16 rounded-full mb-2 object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[var(--accent-3)] mb-2 flex items-center justify-center font-bold">
                    {b.full_name[0]}
                  </div>
                )}
                <p className="font-semibold">{b.full_name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Month Selector */}
        {selectedBarber && (
          <div className="flex justify-start items-center gap-3 mt-4 mb-2">
            <h3 className="text-[#bdbdbd] font-semibold">
              Viewing reports for
            </h3>
            <select
              className="bg-[#334030] rounded-md px-2 py-1 text-sm border border-[#55694b] text-black"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}

        {/* Reports Grid */}
        {selectedBarber ? (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
            {/* Left: Monthly + Weekly Reports */}
            <div className="flex flex-col gap-3 h-full min-h-0">
              <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-2xl p-4 shadow-md flex-1 min-h-0 overflow-y-auto">
                <h3 className="text-lg font-semibold mb-2">Monthly Reports</h3>
                <MonthlyReports
                  userId={selectedBarber.user_id}
                  refresh={refreshReports}
                  filterMonth={selectedMonth}
                />
              </div>

              <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-2xl p-4 shadow-md flex-1 min-h-0 overflow-y-auto">
                <h3 className="text-lg font-semibold mb-2">Weekly Reports</h3>
                <WeeklyReports
                  userId={selectedBarber.user_id}
                  refresh={refreshReports}
                  filterMonth={selectedMonth}
                />
              </div>
            </div>

            {/* Right: Add Report Form */}
            <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-2xl p-6 shadow-md flex flex-col h-full min-h-0 overflow-y-auto">
              <h3 className="text-lg font-semibold mb-3">Add Report for {selectedBarber.full_name}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <select
                  className="bg-[#334030] border border-[#55694b] text-[#F1F5E9] rounded-md px-3 py-2 text-sm"
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

                {reportData.type === 'weekly' ? (
                  <>
                    <select
                      className="bg-[#334030] border border-[#55694b] text-[#F1F5E9] rounded-md px-3 py-2 text-sm"
                      value={reportData.week_number}
                      onChange={(e) =>
                        setReportData({ ...reportData, week_number: Number(e.target.value) })
                      }
                    >
                      {[1,2,3,4,5].map((week) => (
                        <option key={week} value={week} className="text-black">
                          Week {week}
                        </option>
                      ))}
                    </select>

                    <select
                      className="bg-[#334030] border border-[#55694b] text-[#F1F5E9] rounded-md px-3 py-2 text-sm"
                      value={reportData.month}
                      onChange={(e) => setReportData({ ...reportData, month: e.target.value })}
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <select
                    className="bg-[#334030] border border-[#55694b] text-[#F1F5E9] rounded-md px-3 py-2 text-sm"
                    value={reportData.month}
                    onChange={(e) => setReportData({ ...reportData, month: e.target.value })}
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}

                <input
                  type="number"
                  placeholder="Year"
                  className="bg-[#334030] border border-[#55694b] text-[#F1F5E9] rounded-md px-3 py-2 text-sm"
                  value={reportData.year}
                  onChange={(e) => setReportData({ ...reportData, year: Number(e.target.value) })}
                />

                <textarea
                  placeholder="Report content..."
                  className="bg-[#334030] border border-[#55694b] text-[#F1F5E9] rounded-md px-3 py-2 col-span-1 sm:col-span-2 h-32 text-sm"
                  value={reportData.content}
                  onChange={(e) => setReportData({ ...reportData, content: e.target.value })}
                />
              </div>

              <button
                onClick={handleAddReport}
                className="bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] rounded-lg px-6 py-2 transition"
              >
                Add Report
              </button>
            </div>
          </section>
        ) : (
          <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-2xl p-6 shadow-md text-center text-[var(--text-muted)] flex-1">
            Click a barber to display or add reports
          </div>
        )}
      </div>
    </Layout>
  )
}
