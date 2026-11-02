/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { format, getISOWeek, getYear, startOfISOWeek, endOfISOWeek, addWeeks, subWeeks } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight, Calendar, MessageSquare, CheckCircle, XCircle, Inbox, X } from 'lucide-react'
import { AppPage, PageHeader, EmptyState } from '@/components/ui/AppKit'
import 'react-day-picker/dist/style.css'

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface EngagementRecord {
  user_id: string
  full_name: string
  phone: string
  first_response_at: string
  bookings_recovered: number
  total_clients: number
  client_replies: number
}

interface SMSSentRecord {
  id: string
  user_id: string
  full_name: string
  phone_normalized: string
  message: string
  is_sent: boolean
  reason: string | null
  created_at: string
}

type Tab = 'engagement' | 'approval' | 'update'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  if (cleaned.length === 11 && cleaned[0] === '1') return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  return phone
}

const formatTime = (timestamp: string) =>
  format(new Date(timestamp), 'EEE, MMM d, yyyy • h:mm a')

const getWeekInfo = (date: Date) => {
  const weekNumber = getISOWeek(date)
  const year = getYear(date)
  const weekStart = startOfISOWeek(date)
  const weekEnd = endOfISOWeek(date)
  return {
    year, weekNumber, weekStart, weekEnd,
    title: `${year} - Week ${weekNumber} | ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
  }
}

const getISOWeekString = (date: Date) =>
  `${getYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`

// ----------------------------------------------------------------
// StatusPill
// ----------------------------------------------------------------

function StatusPill({ is_sent, reason }: { is_sent: boolean; reason: string | null }) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (is_sent) {
    return (
      <span className="badge badge-sage">
        <CheckCircle size={12} strokeWidth={1.75} /> Sent
      </span>
    )
  }

  return (
    <div className="relative inline-block">
      <span
        className="badge badge-danger cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <XCircle size={12} strokeWidth={1.75} /> Failed
      </span>
      {showTooltip && reason && (
        <div className="modal-surface absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 !rounded-lg px-3 py-2 text-xs text-ivory">
          {reason}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// WeekNav
// ----------------------------------------------------------------

function WeekNav({
  weekInfo, isCurrentWeek, showDatePicker, setShowDatePicker,
  currentWeek, pickerRef, onPrev, onNext, onDateSelect,
}: {
  weekInfo: ReturnType<typeof getWeekInfo>
  isCurrentWeek: boolean
  showDatePicker: boolean
  setShowDatePicker: (v: boolean) => void
  currentWeek: Date
  pickerRef: React.RefObject<HTMLDivElement | null>
  onPrev: () => void
  onNext: () => void
  onDateSelect: (d: Date | undefined) => void
}) {
  return (
    <div className="panel mb-4 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onPrev} className="btn btn-ghost btn-sm" aria-label="Previous week">
          <ChevronLeft size={16} strokeWidth={1.75} /><span className="hidden sm:inline">Previous</span>
        </button>
        <div className="flex flex-1 flex-wrap items-center justify-center gap-2 text-center">
          <span className="text-[15px] font-semibold tabular-nums text-ivory">{weekInfo.title}</span>
          {isCurrentWeek && <span className="badge badge-sage">Current week</span>}
        </div>
        <div className="flex items-center gap-1">
          <div className="relative" ref={pickerRef}>
            <button onClick={() => setShowDatePicker(!showDatePicker)} className="btn btn-glass btn-sm">
              <Calendar size={16} strokeWidth={1.75} /><span className="hidden sm:inline">Jump to date</span>
            </button>
            {showDatePicker && (
              <div className="modal-surface absolute right-0 top-full z-50 mt-2 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted">Select a date</span>
                  <button onClick={() => setShowDatePicker(false)} className="btn btn-ghost btn-sm !h-7 !px-1.5" aria-label="Close">
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </div>
                <DayPicker
                  mode="single" selected={currentWeek} onSelect={onDateSelect}
                  className="text-ivory"
                  modifiersClassNames={{ selected: 'bg-sage text-ink rounded-md font-semibold', today: 'text-sage-bright font-semibold' }}
                  style={{ ['--rdp-accent-color' as any]: '#8FB57A' }}
                  showOutsideDays
                />
              </div>
            )}
          </div>
          <button onClick={onNext} className="btn btn-ghost btn-sm" aria-label="Next week">
            <span className="hidden sm:inline">Next</span><ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Shared bits
// ----------------------------------------------------------------

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/[0.12] border-t-sage" />
      <span className="text-sm text-muted">Loading...</span>
    </div>
  )
}

function RowIndex({ n }: { n: number }) {
  return <span className="text-xs tabular-nums text-gray-500">{n}</span>
}

function Ratio({ value, total, tone }: { value: number; total: number; tone: 'sage' | 'info' }) {
  if (total <= 0) return <span className="text-gray-500">—</span>
  return (
    <span className={`badge tabular-nums ${value > 0 ? (tone === 'sage' ? 'badge-sage' : 'badge-info') : ''}`}>
      {value}/{total}
    </span>
  )
}

// ----------------------------------------------------------------
// EngagementTab
// ----------------------------------------------------------------

function EngagementTab({ records, loading }: { records: EngagementRecord[]; loading: boolean }) {
  const Empty = () => (
    <EmptyState icon={Inbox} title="No responses this week">
      Barbers who reply &quot;yes&quot; from Monday 10:00 AM will appear here.
    </EmptyState>
  )

  return (
    <section className="panel overflow-hidden">
      {/* Mobile cards */}
      <div className="divide-y divide-white/[0.05] sm:hidden">
        {loading ? <Spinner /> : records.length === 0 ? <Empty /> : records.map((record, index) => (
          <div key={record.user_id} className="p-4">
            <div className="mb-1 flex items-baseline gap-2">
              <RowIndex n={index + 1} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ivory">{record.full_name}</div>
                <div className="font-mono text-xs text-muted">{formatPhone(record.phone)}</div>
              </div>
            </div>
            <div className="mb-3 text-xs text-gray-500">{formatTime(record.first_response_at)}</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-raised px-3 py-2">
                <div className="stat-label mb-1">Bookings</div>
                <Ratio value={record.bookings_recovered} total={record.total_clients} tone="sage" />
              </div>
              <div className="rounded-md bg-raised px-3 py-2">
                <div className="stat-label mb-1">Replies</div>
                <Ratio value={record.client_replies} total={record.total_clients} tone="info" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="table-clean">
          <thead>
            <tr>
              {['#', 'Barber', 'Phone', 'First Response', 'Bookings Recovered', 'Client Replies'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><Spinner /></td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={6}><Empty /></td></tr>
            ) : records.map((record, index) => (
              <tr key={record.user_id}>
                <td className="w-10"><RowIndex n={index + 1} /></td>
                <td className="whitespace-nowrap font-medium text-ivory">{record.full_name}</td>
                <td className="whitespace-nowrap font-mono text-[13px] text-muted">{formatPhone(record.phone)}</td>
                <td className="whitespace-nowrap text-[13px] tabular-nums">{formatTime(record.first_response_at)}</td>
                <td className="whitespace-nowrap"><Ratio value={record.bookings_recovered} total={record.total_clients} tone="sage" /></td>
                <td className="whitespace-nowrap"><Ratio value={record.client_replies} total={record.total_clients} tone="info" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && records.length > 0 && (
        <div className="border-t border-white/[0.07] px-4 py-2.5 text-xs text-muted">{records.length} {records.length === 1 ? 'barber' : 'barbers'} responded this week</div>
      )}
    </section>
  )
}

// ----------------------------------------------------------------
// SMSSentTab
// ----------------------------------------------------------------

function SMSSentTab({ records, loading, emptyLabel }: { records: SMSSentRecord[]; loading: boolean; emptyLabel: string }) {
  const Empty = () => <EmptyState icon={Inbox} title={emptyLabel} />

  const MessageBody = ({ message }: { message: string }) => (
    <div className="whitespace-pre-wrap break-words rounded-md bg-raised px-3 py-2 text-xs leading-relaxed text-gray-300">
      {message || <span className="italic text-gray-500">No message</span>}
    </div>
  )

  return (
    <section className="panel overflow-hidden">
      {/* Mobile cards */}
      <div className="divide-y divide-white/[0.05] sm:hidden">
        {loading ? <Spinner /> : records.length === 0 ? <Empty /> : records.map((record, index) => (
          <div key={record.id} className="p-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-2">
                <RowIndex n={index + 1} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ivory">{record.full_name}</div>
                  <div className="font-mono text-xs text-muted">{formatPhone(record.phone_normalized)}</div>
                </div>
              </div>
              <StatusPill is_sent={record.is_sent} reason={record.reason} />
            </div>
            <div className="mb-2 text-xs text-gray-500">{formatTime(record.created_at)}</div>
            <MessageBody message={record.message} />
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="table-clean">
          <thead>
            <tr>
              {['#', 'Barber', 'Phone', 'Sent At', 'Status', 'Message'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><Spinner /></td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={6}><Empty /></td></tr>
            ) : records.map((record, index) => (
              <tr key={record.id} className="align-top">
                <td className="w-10"><RowIndex n={index + 1} /></td>
                <td className="whitespace-nowrap font-medium text-ivory">{record.full_name}</td>
                <td className="whitespace-nowrap font-mono text-[13px] text-muted">{formatPhone(record.phone_normalized)}</td>
                <td className="whitespace-nowrap text-[13px] tabular-nums">{formatTime(record.created_at)}</td>
                <td className="whitespace-nowrap"><StatusPill is_sent={record.is_sent} reason={record.reason} /></td>
                <td className="max-w-sm"><MessageBody message={record.message} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && records.length > 0 && (
        <div className="border-t border-white/[0.07] px-4 py-2.5 text-xs text-muted">{records.length} {records.length === 1 ? 'message' : 'messages'} this week</div>
      )}
    </section>
  )
}

// ----------------------------------------------------------------
// Main
// ----------------------------------------------------------------

export default function NudgeEngagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>('engagement')
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const [engagementRecords, setEngagementRecords] = useState<EngagementRecord[]>([])
  const [engagementLoading, setEngagementLoading] = useState(true)
  const [approvalRecords, setApprovalRecords] = useState<SMSSentRecord[]>([])
  const [approvalLoading, setApprovalLoading] = useState(true)
  const [updateRecords, setUpdateRecords] = useState<SMSSentRecord[]>([])
  const [updateLoading, setUpdateLoading] = useState(true)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowDatePicker(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchEngagements = async (weekDate: Date) => {
    setEngagementLoading(true)
    try {
      const weekInfo = getWeekInfo(weekDate)
      const isoWeekString = getISOWeekString(weekDate)
      const mondayTenAM = new Date(weekInfo.weekStart); mondayTenAM.setHours(10, 0, 0, 0)
      const mondayStart = new Date(weekInfo.weekStart); mondayStart.setHours(0, 0, 0, 0)
      const sundayEnd = new Date(weekInfo.weekEnd); sundayEnd.setHours(23, 59, 59, 999)

      const { data: replies, error: repliesError } = await supabase
        .from('sms_replies').select('user_id, received_at, phone_number')
        .gte('received_at', mondayTenAM.toISOString()).lte('received_at', sundayEnd.toISOString())
        .order('received_at', { ascending: true })
      if (repliesError) throw repliesError
      if (!replies || replies.length === 0) { setEngagementRecords([]); return }

      const userFirstResponses = new Map<string, { received_at: string; phone_number: string }>()
      replies.forEach(r => { if (!userFirstResponses.has(r.user_id)) userFirstResponses.set(r.user_id, { received_at: r.received_at, phone_number: r.phone_number }) })
      const userIds = Array.from(userFirstResponses.keys())

      const [
        { data: profiles, error: pErr },
        { data: nudgeSuccess, error: nErr },
        { data: smartBuckets, error: sErr },
        { data: clientReplies, error: cErr },
      ] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, phone').in('user_id', userIds),
        supabase.from('barber_nudge_success').select('user_id, client_ids').in('user_id', userIds).eq('iso_week_number', isoWeekString),
        supabase.from('sms_smart_buckets').select('user_id, total_clients').in('user_id', userIds).eq('iso_week', isoWeekString),
        supabase.from('sms_replies').select('user_id, phone_number').in('user_id', userIds).not('client_id', 'is', null).gte('received_at', mondayStart.toISOString()).lte('received_at', sundayEnd.toISOString()),
      ])
      if (pErr) throw pErr; if (nErr) throw nErr; if (sErr) throw sErr; if (cErr) throw cErr

      const nudgeSuccessMap = new Map<string, number>()
      ;(nudgeSuccess || []).forEach(r => nudgeSuccessMap.set(r.user_id, r.client_ids?.length ?? 0))
      const smartBucketsMap = new Map<string, number>()
      ;(smartBuckets || []).forEach(b => smartBucketsMap.set(b.user_id, (smartBucketsMap.get(b.user_id) ?? 0) + (b.total_clients ?? 0)))
      const clientRepliesPhones = new Map<string, Set<string>>()
      ;(clientReplies || []).forEach(r => { if (!clientRepliesPhones.has(r.user_id)) clientRepliesPhones.set(r.user_id, new Set()); clientRepliesPhones.get(r.user_id)!.add(r.phone_number) })
      const clientRepliesMap = new Map<string, number>()
      clientRepliesPhones.forEach((phones, uid) => clientRepliesMap.set(uid, phones.size))

      const records: EngagementRecord[] = (profiles || []).map(p => ({
        user_id: p.user_id, full_name: p.full_name || 'Unknown',
        phone: p.phone || userFirstResponses.get(p.user_id)!.phone_number,
        first_response_at: userFirstResponses.get(p.user_id)!.received_at,
        bookings_recovered: nudgeSuccessMap.get(p.user_id) ?? 0,
        total_clients: smartBucketsMap.get(p.user_id) ?? 0,
        client_replies: clientRepliesMap.get(p.user_id) ?? 0,
      }))
      records.sort((a, b) => new Date(a.first_response_at).getTime() - new Date(b.first_response_at).getTime())
      setEngagementRecords(records)
    } catch (err: any) {
      console.error(err); toast.error(`Failed to fetch engagements: ${err.message ?? err}`)
    } finally { setEngagementLoading(false) }
  }

  const fetchSMSSent = async (
    weekDate: Date,
    purpose: 'barber_sms' | 'barber_sms_update',
    setter: (r: SMSSentRecord[]) => void,
    loadSetter: (v: boolean) => void
  ) => {
    loadSetter(true)
    try {
      const weekInfo = getWeekInfo(weekDate)
      const mondayStart = new Date(weekInfo.weekStart); mondayStart.setHours(0, 0, 0, 0)
      const sundayEnd = new Date(weekInfo.weekEnd); sundayEnd.setHours(23, 59, 59, 999)

      const { data: sent, error: sentError } = await supabase
        .from('sms_sent').select('id, user_id, phone_normalized, message, is_sent, reason, created_at')
        .eq('purpose', purpose)
        .gte('created_at', mondayStart.toISOString())
        .lte('created_at', sundayEnd.toISOString())
        .order('created_at', { ascending: true })
      if (sentError) throw sentError
      if (!sent || sent.length === 0) { setter([]); return }

      const userIds = [...new Set(sent.map(r => r.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
      const profileMap = new Map<string, string>((profiles || []).map(p => [p.user_id, p.full_name || 'Unknown']))

      setter(sent.map(r => ({
        id: r.id, user_id: r.user_id,
        full_name: profileMap.get(r.user_id) ?? 'Unknown',
        phone_normalized: r.phone_normalized ?? '',
        message: r.message ?? '', is_sent: r.is_sent,
        reason: r.reason ?? null, created_at: r.created_at,
      })))
    } catch (err: any) {
      console.error(err); toast.error(`Failed to fetch SMS data: ${err.message ?? err}`)
    } finally { loadSetter(false) }
  }

  useEffect(() => {
    fetchEngagements(currentWeek)
    fetchSMSSent(currentWeek, 'barber_sms', setApprovalRecords, setApprovalLoading)
    fetchSMSSent(currentWeek, 'barber_sms_update', setUpdateRecords, setUpdateLoading)
  }, [currentWeek])

  const weekInfo = getWeekInfo(currentWeek)
  const isCurrentWeek = getISOWeek(new Date()) === weekInfo.weekNumber && getYear(new Date()) === weekInfo.year

  const TABS: { key: Tab; label: string; short: string; count: number; loading: boolean }[] = [
    { key: 'engagement', label: 'Nudge Engagement', short: 'Engagement', count: engagementRecords.length, loading: engagementLoading },
    { key: 'approval', label: 'Approval SMS', short: 'Approval', count: approvalRecords.length, loading: approvalLoading },
    { key: 'update', label: 'Update SMS', short: 'Update', count: updateRecords.length, loading: updateLoading },
  ]

  return (
    <AppPage>
      <PageHeader
        title="Nudge Dashboard"
        subtitle="Weekly overview of barber engagement, approvals, and update messages"
        actions={
          <div className="panel flex items-center gap-3 px-3.5 py-2">
            <MessageSquare size={18} strokeWidth={1.75} className="text-sage" />
            <div>
              <div className="stat-label">This week</div>
              <div className="text-[15px] font-semibold tabular-nums text-ivory">
                {engagementLoading ? '...' : `${engagementRecords.length} engaged`}
              </div>
            </div>
          </div>
        }
      />

      {/* Week Nav */}
      <WeekNav
        weekInfo={weekInfo} isCurrentWeek={isCurrentWeek}
        showDatePicker={showDatePicker} setShowDatePicker={setShowDatePicker}
        currentWeek={currentWeek} pickerRef={pickerRef}
        onPrev={() => setCurrentWeek(prev => subWeeks(prev, 1))}
        onNext={() => setCurrentWeek(prev => addWeeks(prev, 1))}
        onDateSelect={d => { if (d) { setCurrentWeek(d); setShowDatePicker(false) } }}
      />

      {/* Tabs */}
      <div className="segmented mb-4 flex w-full sm:inline-flex sm:w-auto" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            data-active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="segmented-item flex items-center justify-center gap-1.5"
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.short}</span>
            {!tab.loading && (
              <span className={`badge tabular-nums ${activeTab === tab.key ? 'badge-sage' : ''}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'engagement' && <EngagementTab records={engagementRecords} loading={engagementLoading} />}
      {activeTab === 'approval' && <SMSSentTab records={approvalRecords} loading={approvalLoading} emptyLabel="No approval SMS sent this week" />}
      {activeTab === 'update' && <SMSSentTab records={updateRecords} loading={updateLoading} emptyLabel="No update SMS sent this week" />}
    </AppPage>
  )
}
