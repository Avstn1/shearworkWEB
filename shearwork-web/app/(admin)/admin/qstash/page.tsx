// app/admin/qstash/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import { Inbox, RefreshCcw, Trash2, Timer } from 'lucide-react'
import { AppPage, EmptyState, PageHeader } from '@/components/ui/AppKit'

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

      if (!profile || (profile.role !== 'Admin')) {
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
      <AppPage>
        <div className="mx-auto max-w-7xl">
          <PageHeader icon={Timer} tone="sky" title="QStash schedules" subtitle="Loading schedules..." />
        </div>
      </AppPage>
    )
  }

  const tabs = [
    { id: 'events' as const, label: 'Events', count: events.length, onSelect: () => { setActiveTab('events'); setCurrentPage(1); setStateFilter('all'); } },
    { id: 'schedules' as const, label: 'Schedules', count: schedules.length, onSelect: () => { setActiveTab('schedules'); setCurrentPage(1); } },
    { id: 'dlq' as const, label: 'DLQ', count: dlqMessages.length, onSelect: () => { setActiveTab('dlq'); setCurrentPage(1); } },
  ]

  const eventBadge = (state: string) =>
    state === 'DELIVERED' ? 'badge-sage' : state === 'ERROR' ? 'badge-danger' : 'badge-info'

  return (
    <AppPage>
      <div className="mx-auto max-w-7xl">
        <PageHeader icon={Timer} tone="sky"
          title="QStash schedules"
          subtitle="Scheduled jobs, delivery events and the dead-letter queue."
          actions={
            <button onClick={fetchSchedules} className="btn btn-glass btn-sm">
              <RefreshCcw size={16} strokeWidth={1.75} />
              Refresh
            </button>
          }
        />

        <section className="panel">
          <div className="panel-header flex-wrap">
            <div className="segmented max-w-full overflow-x-auto" role="tablist">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  data-active={activeTab === tab.id}
                  onClick={tab.onSelect}
                  className="segmented-item"
                >
                  {tab.label} <span className="tabular-nums text-gray-500">{tab.count}</span>
                </button>
              ))}
            </div>
            {activeTab === 'events' && (
              <select
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="field h-9 w-auto min-w-[150px]"
              >
                <option value="all">All States</option>
                {uniqueStates.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            )}
          </div>

          {/* Schedules Table */}
          {activeTab === 'schedules' && (
            paginatedData.length === 0 ? (
              <EmptyState icon={Inbox} title="No recurring schedules found." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Schedule ID</th>
                      <th>Cron</th>
                      <th>Destination</th>
                      <th>Created</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(paginatedData as QStashSchedule[]).map((schedule) => (
                      <tr key={schedule.scheduleId}>
                        <td className="font-mono text-xs">{schedule.scheduleId}</td>
                        <td>{formatCron(schedule.cron)}</td>
                        <td className="max-w-xs truncate text-muted">{schedule.destination}</td>
                        <td className="whitespace-nowrap tabular-nums text-muted">{formatDate(schedule.createdAt)}</td>
                        <td>
                          <span className={`badge ${schedule.isPaused ? 'badge-warn' : 'badge-sage'}`}>
                            {schedule.isPaused ? 'Paused' : 'Active'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => handleDelete(schedule.scheduleId)}
                            disabled={deleting === schedule.scheduleId}
                            className="btn btn-ghost btn-sm h-8 text-[#D99A8B] hover:text-[#D99A8B]"
                          >
                            <Trash2 size={14} strokeWidth={1.75} />
                            {deleting === schedule.scheduleId ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Events Table */}
          {activeTab === 'events' && (
            paginatedData.length === 0 ? (
              <EmptyState icon={Inbox} title="No events found." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Message ID</th>
                      <th>State</th>
                      <th>URL</th>
                      <th>Created</th>
                      <th>Next Delivery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(paginatedData as QStashEvent[]).map((event) => (
                      <tr key={event.messageId}>
                        <td className="font-mono text-xs">{event.messageId}</td>
                        <td>
                          <span className={`badge ${eventBadge(event.state)}`}>
                            {event.state}
                          </span>
                        </td>
                        <td className="max-w-xs truncate text-muted">{event.url}</td>
                        <td className="whitespace-nowrap tabular-nums text-muted">{formatDate(event.createdAt)}</td>
                        <td className="whitespace-nowrap tabular-nums text-muted">{formatDate(event.nextDeliveryTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* DLQ Table */}
          {activeTab === 'dlq' && (
            paginatedData.length === 0 ? (
              <EmptyState icon={Inbox} title="No failed messages in DLQ." />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-clean">
                  <thead>
                    <tr>
                      <th>Message ID</th>
                      <th>URL</th>
                      <th>Method</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(paginatedData as QStashDLQMessage[]).map((msg) => (
                      <tr key={msg.messageId}>
                        <td className="font-mono text-xs">{msg.messageId}</td>
                        <td className="max-w-xs truncate text-muted">{msg.url}</td>
                        <td><span className="badge">{msg.method || 'POST'}</span></td>
                        <td className="whitespace-nowrap tabular-nums text-muted">{formatDate(msg.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-3 text-[13px] text-muted">
            {totalPages > 1 ? (
              <>
                <p className="tabular-nums">Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn btn-glass btn-sm h-8"
                  >
                    Previous
                  </button>
                  <span className="tabular-nums">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn btn-glass btn-sm h-8"
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <p className="tabular-nums">Total: {total}</p>
            )}
          </div>
        </section>
      </div>
    </AppPage>
  )
}
