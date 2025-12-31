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

interface QStashEvent {
  messageId: string
  state: string
  url: string
  topicName?: string
  createdAt?: number
  nextDeliveryTime?: number
  [key: string]: any
}

interface QStashDLQMessage {
  messageId: string
  url: string
  method?: string
  header?: Record<string, string[]>
  createdAt?: number
  [key: string]: any
}

export default function QStashPage() {
  const router = useRouter()
  const [schedules, setSchedules] = useState<QStashSchedule[]>([])
  const [events, setEvents] = useState<QStashEvent[]>([])
  const [dlqMessages, setDlqMessages] = useState<QStashDLQMessage[]>([])
  const [activeTab, setActiveTab] = useState<'schedules' | 'events' | 'dlq'>('events')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [stateFilter, setStateFilter] = useState<string>('all')
  const ITEMS_PER_PAGE = 15

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
        throw new Error(data.error || 'Failed to fetch data')
      }

      setSchedules(Array.isArray(data.schedules) ? data.schedules : [])
      
      // Deduplicate events by messageId
      const eventsArray = Array.isArray(data.events) ? data.events : []
      const uniqueEvents = eventsArray.reduce((acc: QStashEvent[], event: QStashEvent) => {
        if (!acc.find(e => e.messageId === event.messageId)) {
          acc.push(event)
        }
        return acc
      }, [])
      setEvents(uniqueEvents)
      
      setDlqMessages(Array.isArray(data.dlq) ? data.dlq : [])
      
      console.log('Loaded:', {
        schedules: data.schedules?.length || 0,
        events: uniqueEvents.length,
        eventsRaw: eventsArray.length,
        dlq: data.dlq?.length || 0
      })
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error(error.message || 'Failed to fetch data')
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

  // Pagination logic with filtering
  const getCurrentData = () => {
    let data = activeTab === 'schedules' ? schedules : activeTab === 'events' ? events : dlqMessages
    
    // Apply state filter for events
    if (activeTab === 'events' && stateFilter !== 'all') {
      data = (data as QStashEvent[]).filter(event => event.state === stateFilter)
    }
    
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return { data: data.slice(startIndex, endIndex), totalPages, total: data.length }
  }

  const { data: paginatedData, totalPages, total } = getCurrentData()
  
  // Get unique states from events for filter dropdown
  const uniqueStates = Array.from(new Set(events.map(e => e.state))).sort()

  if (loading) {
    return (
      <>
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
      <div className="min-h-screen bg-[var(--background)] p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6 gap-3">
            <h1 className="text-2xl font-semibold text-[var(--highlight)]">
              QStash Schedules
            </h1>
            <div className="flex gap-2 items-center">
              {activeTab === 'events' && (
                <select
                  value={stateFilter}
                  onChange={(e) => {
                    setStateFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="px-3 py-2 bg-[#2f3a2d] text-[#F1F5E9] border-2 border-[#a8d88e] rounded-md text-sm min-w-[150px]"
                >
                  <option value="all">All States</option>
                  {uniqueStates.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              )}
              <button
                onClick={fetchSchedules}
                className="px-4 py-2 bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] rounded-md"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-4 border-b border-[var(--accent-2)]/30 pb-2">
            <button
              onClick={() => { setActiveTab('events'); setCurrentPage(1); setStateFilter('all'); }}
              className={`px-4 py-2 rounded-t-md transition-colors ${
                activeTab === 'events'
                  ? 'bg-[var(--accent-3)] text-[var(--text-bright)]'
                  : 'bg-[var(--accent-1)]/20 text-[var(--foreground)] hover:bg-[var(--accent-1)]/30'
              }`}
            >
              Events ({events.length})
            </button>
            <button
              onClick={() => { setActiveTab('schedules'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-t-md transition-colors ${
                activeTab === 'schedules'
                  ? 'bg-[var(--accent-3)] text-[var(--text-bright)]'
                  : 'bg-[var(--accent-1)]/20 text-[var(--foreground)] hover:bg-[var(--accent-1)]/30'
              }`}
            >
              Schedules ({schedules.length})
            </button>
            <button
              onClick={() => { setActiveTab('dlq'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-t-md transition-colors ${
                activeTab === 'dlq'
                  ? 'bg-[var(--accent-3)] text-[var(--text-bright)]'
                  : 'bg-[var(--accent-1)]/20 text-[var(--foreground)] hover:bg-[var(--accent-1)]/30'
              }`}
            >
              DLQ ({dlqMessages.length})
            </button>
          </div>

          {/* Schedules Table */}
          {activeTab === 'schedules' && (
            paginatedData.length === 0 ? (
              <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-6">
                <p className="text-[var(--foreground)]">No recurring schedules found.</p>
              </div>
            ) : (
              <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[var(--accent-2)]/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Schedule ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Cron</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Destination</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Created</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--accent-2)]/30">
                      {(paginatedData as QStashSchedule[]).map((schedule) => (
                        <tr key={schedule.scheduleId} className="hover:bg-[var(--accent-1)]/5">
                          <td className="px-4 py-3 text-sm text-[var(--foreground)] font-mono">{schedule.scheduleId}</td>
                          <td className="px-4 py-3 text-sm text-[var(--foreground)]">{formatCron(schedule.cron)}</td>
                          <td className="px-4 py-3 text-sm text-[var(--foreground)] max-w-xs truncate">{schedule.destination}</td>
                          <td className="px-4 py-3 text-sm text-[var(--foreground)]">{formatDate(schedule.createdAt)}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${schedule.isPaused ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>
                              {schedule.isPaused ? 'Paused' : 'Active'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              onClick={() => handleDelete(schedule.scheduleId)}
                              disabled={deleting === schedule.scheduleId}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
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
            )
          )}

          {/* Events Table */}
          {activeTab === 'events' && (
            paginatedData.length === 0 ? (
              <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-6">
                <p className="text-[var(--foreground)]">No events found.</p>
              </div>
            ) : (
              <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[var(--accent-2)]/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Message ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">State</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">URL</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Created</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Next Delivery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--accent-2)]/30">
                      {(paginatedData as QStashEvent[]).map((event) => (
                        <tr key={event.messageId} className="hover:bg-[var(--accent-1)]/5">
                          <td className="px-4 py-3 text-sm text-[var(--foreground)] font-mono">{event.messageId}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              event.state === 'DELIVERED' ? 'bg-green-500/20 text-green-300' :
                              event.state === 'ERROR' ? 'bg-red-500/20 text-red-300' :
                              'bg-blue-500/20 text-blue-300'
                            }`}>
                              {event.state}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-[var(--foreground)] max-w-xs truncate">{event.url}</td>
                          <td className="px-4 py-3 text-sm text-[var(--foreground)]">{formatDate(event.createdAt)}</td>
                          <td className="px-4 py-3 text-sm text-[var(--foreground)]">{formatDate(event.nextDeliveryTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* DLQ Table */}
          {activeTab === 'dlq' && (
            paginatedData.length === 0 ? (
              <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl p-6">
                <p className="text-[var(--foreground)]">No failed messages in DLQ.</p>
              </div>
            ) : (
              <div className="bg-[var(--accent-1)]/10 border border-[var(--accent-2)]/30 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[var(--accent-2)]/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Message ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">URL</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Method</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-bright)]">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--accent-2)]/30">
                      {(paginatedData as QStashDLQMessage[]).map((msg) => (
                        <tr key={msg.messageId} className="hover:bg-[var(--accent-1)]/5">
                          <td className="px-4 py-3 text-sm text-[var(--foreground)] font-mono">{msg.messageId}</td>
                          <td className="px-4 py-3 text-sm text-[var(--foreground)] max-w-xs truncate">{msg.url}</td>
                          <td className="px-4 py-3 text-sm text-[var(--foreground)]">{msg.method || 'POST'}</td>
                          <td className="px-4 py-3 text-sm text-[var(--foreground)]">{formatDate(msg.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-[var(--foreground)]/70">
                <p>Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-[var(--foreground)]">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {totalPages <= 1 && (
            <div className="mt-4 text-sm text-[var(--foreground)]/70">
              <p>Total: {total}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}