// app/admin/qstash/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import Navbar from '@/components/Navbar'

interface QStashSchedule {
  scheduleId: string
  cron?: string
  destination: string
  createdAt?: number
  isPaused?: boolean
  [key: string]: any
}

export default function QStashPage() {
  const router = useRouter()
  const [schedules, setSchedules] = useState<QStashSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (!profile || (profile.role !== 'Owner' && profile.role !== 'Admin')) {
        router.push('/dashboard')
        return
      }

      fetchSchedules()
    }

    checkAuth()
  }, [router])

  const fetchSchedules = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/client-messaging/qstash_schedule_check')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch schedules')
      }

      const schedulesArray = Array.isArray(data.schedules) 
        ? data.schedules 
        : []

      setSchedules(schedulesArray)
    } catch (error: any) {
      console.error('Error fetching schedules:', error)
      toast.error(error.message || 'Failed to fetch schedules')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return

    try {
      setDeleting(scheduleId)
      const response = await fetch(`/api/client-messaging/qstash_schedule_check?scheduleId=${scheduleId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete schedule')
      }

      toast.success('Schedule deleted successfully')
      fetchSchedules()
    } catch (error: any) {
      console.error('Error deleting schedule:', error)
      toast.error(error.message || 'Failed to delete schedule')
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleString()
  }

  const formatCron = (cron?: string) => {
    if (!cron) return 'N/A'
    
    // Extract timezone if present
    let timezone = ''
    let cronExpression = cron
    
    if (cron.startsWith('CRON_TZ=')) {
      const parts = cron.split(' ')
      timezone = parts[0].replace('CRON_TZ=', '')
      cronExpression = parts.slice(1).join(' ')
    }
    
    const parts = cronExpression.split(' ')
    
    // Handle 6-part cron (with seconds)
    if (parts.length === 6) {
      const [second, minute, hour, day, month, weekday] = parts
      
      if (second !== '*' && minute !== '*' && hour !== '*' && day !== '*' && month === '*' && weekday === '*') {
        const date = `${month}/${day}`
        const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`
        return timezone 
          ? `On ${date} at ${time} (${timezone})`
          : `On ${date} at ${time}`
      }
      
      if (second !== '*' && minute !== '*' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
        const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`
        return timezone 
          ? `Daily at ${time} (${timezone})`
          : `Daily at ${time}`
      }
    }
    
    // Handle 5-part cron
    if (parts.length === 5) {
      const [minute, hour, day, month, weekday] = parts
      
      if (minute !== '*' && hour !== '*' && day !== '*' && month === '*' && weekday === '*') {
        const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
        return timezone 
          ? `Monthly on day ${day} at ${time} (${timezone})`
          : `Monthly on day ${day} at ${time}`
      }
      
      if (minute !== '*' && hour !== '*' && day === '*' && month === '*' && weekday === '*') {
        const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
        return timezone 
          ? `Daily at ${time} (${timezone})`
          : `Daily at ${time}`
      }
    }

    return cron
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-[var(--background)] p-6">
          <div className="max-w-7xl mx-auto">
            <p className="text-[var(--foreground)]">Loading schedules...</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--background)] p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-[var(--highlight)]">
              QStash Schedules
            </h1>
            <button
              onClick={fetchSchedules}
              className="px-4 py-2 bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] rounded-md"
            >
              Refresh
            </button>
          </div>

          {schedules.length === 0 ? (
            <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-6">
              <p className="text-[var(--foreground)]">No scheduled messages found.</p>
            </div>
          ) : (
            <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--accent-2)]/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">
                        Schedule ID
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">
                        Cron
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">
                        Destination
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">
                        Created
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--accent-2)]/30">
                    {schedules.map((schedule) => (
                      <tr key={schedule.scheduleId} className="hover:bg-[var(--accent-1)]/5">
                        <td className="px-4 py-3 text-sm text-[var(--foreground)] font-mono">
                          {schedule.scheduleId}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                          {formatCron(schedule.cron)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--foreground)] max-w-xs truncate">
                          {schedule.destination}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                          {formatDate(schedule.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              schedule.isPaused
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : 'bg-green-500/20 text-green-300'
                            }`}
                          >
                            {schedule.isPaused ? 'Paused' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => handleDelete(schedule.scheduleId)}
                            disabled={deleting === schedule.scheduleId}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deleting === schedule.scheduleId ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-4 text-sm text-[var(--foreground)]/70">
            <p>Total schedules: {schedules.length}</p>
          </div>
        </div>
      </div>
    </>
  )
}