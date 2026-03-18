/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { format, getISOWeek, getYear, startOfISOWeek, endOfISOWeek, addWeeks, subWeeks } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight, Calendar, MessageSquare, CheckCircle, XCircle } from 'lucide-react'
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
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-green-400 bg-green-600/15 border border-green-600/30">
        <CheckCircle className="w-3 h-3" /> Sent
      </span>
    )
  }

  return (
    <div className="relative inline-block">
      <span
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-red-400 bg-red-600/15 border border-red-600/30 cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <XCircle className="w-3 h-3" /> Failed
      </span>
      {showTooltip && reason && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 bg-[#1f2420] border border-[#55694b] rounded-lg px-3 py-2 text-xs text-[#F1F5E9] shadow-xl">
          {reason}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#55694b]" />
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
    <div className="mb-4 bg-[#2a2f27] rounded-xl p-3 border border-[#55694b] shadow-md">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onPrev} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3a4431] text-[#F1F5E9] hover:bg-[#4b5a42] transition-all hover:scale-105 active:scale-95 text-sm">
          <ChevronLeft size={16} /><span className="hidden sm:inline">Previous</span>
        </button>
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-[var(--highlight)]">{weekInfo.title}</div>
          {isCurrentWeek && (
            <div className="inline-block px-2 py-0.5 rounded-full bg-green-600/20 border border-green-600/40 text-green-400 text-[10px] font-semibold mt-1">Current Week</div>
          )}
        </div>
        <div className="relative" ref={pickerRef}>
          <button onClick={() => setShowDatePicker(!showDatePicker)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3a4431] text-[#F1F5E9] hover:bg-[#4b5a42] transition-all hover:scale-105 active:scale-95 text-sm">
            <Calendar size={16} /><span className="hidden sm:inline">Jump to Date</span>
          </button>
          {showDatePicker && (
            <div className="absolute right-0 top-full mt-2 z-50 bg-[#2f3a2d] border border-[#55694b] rounded-xl shadow-2xl p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-[var(--highlight)]">Select a Date</span>
                <button onClick={() => setShowDatePicker(false)} className="px-2 py-0.5 text-xs bg-red-600 rounded-lg hover:bg-red-700 transition-colors">✕</button>
              </div>
              <DayPicker
                mode="single" selected={currentWeek} onSelect={onDateSelect}
                className="rounded-lg bg-[#2f3a2d] text-[#F1F5E9]"
                modifiersClassNames={{ selected: 'bg-green-600 text-[#F1F5E9] rounded-full font-bold', today: 'bg-green-600/30 text-[#F1F5E9] rounded-full font-semibold' }}
                showOutsideDays
              />
            </div>
          )}
        </div>
        <button onClick={onNext} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3a4431] text-[#F1F5E9] hover:bg-[#4b5a42] transition-all hover:scale-105 active:scale-95 text-sm">
          <span className="hidden sm:inline">Next</span><ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// EngagementTab
// ----------------------------------------------------------------

function EngagementTab({ records, loading }: { records: EngagementRecord[]; loading: boolean }) {
  const Spinner = () => (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="w-10 h-10 border-4 border-[#55694b] border-t-green-600 rounded-full animate-spin" />
      <span className="text-[#9ca89a] text-sm">Loading...</span>
    </div>
  )
  const Empty = () => (
    <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#3a4431] flex items-center justify-center"><span className="text-3xl opacity-50">📭</span></div>
      <div className="text-[#9ca89a]">No responses this week</div>
      <div className="text-[#9ca89a]/60 text-sm">Barbers who reply "yes" from Monday 10:00 AM will appear here</div>
    </div>
  )

  return (
    <div className="bg-[#2a2f27] rounded-xl shadow-xl border border-[#55694b] overflow-hidden">
      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-[#55694b]/50">
        {loading ? <Spinner /> : records.length === 0 ? <Empty /> : records.map((record, index) => {
          const hasData = record.total_clients > 0
          return (
            <div key={record.user_id} className="p-4 hover:bg-[#3a4431] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#3a4431] flex items-center justify-center text-xs font-bold text-[var(--highlight)]">{index + 1}</div>
                  <div>
                    <div className="text-sm font-semibold text-[#F1F5E9]">{record.full_name}</div>
                    <div className="text-xs font-mono text-[#9ca89a]">{formatPhone(record.phone)}</div>
                  </div>
                </div>
              </div>
              <div className="text-xs text-[#9ca89a] mb-3">{formatTime(record.first_response_at)}</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#1f2420] rounded-lg px-3 py-2">
                  <div className="text-[10px] text-[#9ca89a] uppercase tracking-wide mb-1">Bookings</div>
                  <div className={`text-sm font-bold ${record.bookings_recovered > 0 ? 'text-green-400' : 'text-[#9ca89a]'}`}>
                    {hasData ? `${record.bookings_recovered}/${record.total_clients}` : '—'}
                  </div>
                </div>
                <div className="bg-[#1f2420] rounded-lg px-3 py-2">
                  <div className="text-[10px] text-[#9ca89a] uppercase tracking-wide mb-1">Replies</div>
                  <div className={`text-sm font-bold ${record.client_replies > 0 ? 'text-sky-300' : 'text-[#9ca89a]'}`}>
                    {hasData ? `${record.client_replies}/${record.total_clients}` : '—'}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-[#55694b]">
          <thead className="bg-[#2f3a2d]">
            <tr>
              {['#', 'Barber', 'Phone', 'First Response', 'Bookings Recovered', 'Client Replies'].map(h => (
                <th key={h} className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--highlight)] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#55694b]/50">
            {loading ? (
              <tr><td colSpan={6} className="py-12"><Spinner /></td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={6}><Empty /></td></tr>
            ) : records.map((record, index) => {
              const hasData = record.total_clients > 0
              const isRecovered = record.bookings_recovered > 0
              const hasReplies = record.client_replies > 0
              return (
                <tr key={record.user_id} className="hover:bg-[#3a4431] transition-colors group">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#3a4431] group-hover:bg-[#4b5a42] text-sm font-bold text-[var(--highlight)] transition-colors">{index + 1}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap"><div className="text-base font-semibold text-[#F1F5E9]">{record.full_name}</div></td>
                  <td className="px-4 py-4 whitespace-nowrap"><div className="text-sm font-mono text-[#9ca89a] bg-[#1f2420] px-3 py-1.5 rounded-lg inline-block">{formatPhone(record.phone)}</div></td>
                  <td className="px-4 py-4 whitespace-nowrap"><div className="text-sm text-[#F1F5E9]">{formatTime(record.first_response_at)}</div></td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${!hasData ? 'text-[#9ca89a] bg-[#1f2420]' : isRecovered ? 'text-green-400 bg-green-600/15 border border-green-600/30' : 'text-[#9ca89a] bg-[#1f2420]'}`}>
                      {isRecovered && <span>✓</span>}{hasData ? `${record.bookings_recovered}/${record.total_clients}` : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold ${hasReplies ? 'text-sky-300 bg-sky-600/15 border border-sky-600/30' : 'text-[#9ca89a] bg-[#1f2420]'}`}>
                      {hasData ? `${record.client_replies}/${record.total_clients}` : '—'}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!loading && records.length > 0 && (
        <div className="py-3 text-center text-xs text-[#9ca89a]">{records.length} {records.length === 1 ? 'barber' : 'barbers'} responded this week</div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// SMSSentTab
// ----------------------------------------------------------------

function SMSSentTab({ records, loading, emptyLabel }: { records: SMSSentRecord[]; loading: boolean; emptyLabel: string }) {
  const Spinner = () => (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="w-10 h-10 border-4 border-[#55694b] border-t-green-600 rounded-full animate-spin" />
      <span className="text-[#9ca89a] text-sm">Loading...</span>
    </div>
  )
  const Empty = () => (
    <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#3a4431] flex items-center justify-center"><span className="text-3xl opacity-50">📭</span></div>
      <div className="text-[#9ca89a]">{emptyLabel}</div>
    </div>
  )

  return (
    <div className="bg-[#2a2f27] rounded-xl shadow-xl border border-[#55694b] overflow-hidden">
      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-[#55694b]/50">
        {loading ? <Spinner /> : records.length === 0 ? <Empty /> : records.map((record, index) => (
          <div key={record.id} className="p-4 hover:bg-[#3a4431] transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#3a4431] flex items-center justify-center text-xs font-bold text-[var(--highlight)]">{index + 1}</div>
                <div>
                  <div className="text-sm font-semibold text-[#F1F5E9]">{record.full_name}</div>
                  <div className="text-xs font-mono text-[#9ca89a] mt-0.5">{formatPhone(record.phone_normalized)}</div>
                </div>
              </div>
              <StatusPill is_sent={record.is_sent} reason={record.reason} />
            </div>
            <div className="text-xs text-[#9ca89a] mb-2">{formatTime(record.created_at)}</div>
            <div className="bg-[#1f2420] rounded-lg px-3 py-2 text-xs text-[#F1F5E9]/80 leading-relaxed whitespace-pre-wrap break-words">
              {record.message || <span className="text-[#9ca89a] italic">No message</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-[#55694b]">
          <thead className="bg-[#2f3a2d]">
            <tr>
              {['#', 'Barber', 'Phone', 'Sent At', 'Status', 'Message'].map(h => (
                <th key={h} className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--highlight)] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#55694b]/50">
            {loading ? (
              <tr><td colSpan={6} className="py-12"><Spinner /></td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={6}><Empty /></td></tr>
            ) : records.map((record, index) => (
              <tr key={record.id} className="hover:bg-[#3a4431] transition-colors group align-top">
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#3a4431] group-hover:bg-[#4b5a42] text-sm font-bold text-[var(--highlight)] transition-colors">{index + 1}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap"><div className="text-base font-semibold text-[#F1F5E9]">{record.full_name}</div></td>
                <td className="px-4 py-4 whitespace-nowrap"><div className="text-sm font-mono text-[#9ca89a] bg-[#1f2420] px-3 py-1.5 rounded-lg inline-block">{formatPhone(record.phone_normalized)}</div></td>
                <td className="px-4 py-4 whitespace-nowrap"><div className="text-sm text-[#F1F5E9]">{formatTime(record.created_at)}</div></td>
                <td className="px-4 py-4 whitespace-nowrap"><StatusPill is_sent={record.is_sent} reason={record.reason} /></td>
                <td className="px-4 py-4 max-w-sm">
                  <div className="bg-[#1f2420] rounded-lg px-3 py-2 text-xs text-[#F1F5E9]/80 leading-relaxed whitespace-pre-wrap break-words">
                    {record.message || <span className="text-[#9ca89a] italic">No message</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && records.length > 0 && (
        <div className="py-3 text-center text-xs text-[#9ca89a]">{records.length} {records.length === 1 ? 'message' : 'messages'} this week</div>
      )}
    </div>
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
    <div className="pt-25 p-4 min-h-screen bg-[#1f2420] text-[#F1F5E9]">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[var(--highlight)] mb-1">Nudge Dashboard</h1>
          <p className="text-[#9ca89a] text-xs">Weekly overview of barber engagement, approvals, and update messages</p>
        </div>
        <div className="bg-gradient-to-br from-[#2a2f27] to-[#242924] rounded-xl p-3 border border-[#55694b] shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-600/20 border-2 border-green-600/40 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-[#9ca89a] text-xs font-medium">This Week</div>
              <div className="text-xl font-bold text-[var(--highlight)]">
                {engagementLoading ? '...' : `${engagementRecords.length} engaged`}
              </div>
            </div>
          </div>
        </div>
      </div>

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
      <div className="flex gap-1 mb-4 bg-[#2a2f27] p-1 rounded-xl border border-[#55694b]">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-[#3a4431] text-[var(--highlight)] shadow-md'
                : 'text-[#9ca89a] hover:text-[#F1F5E9] hover:bg-[#3a4431]/50'
            }`}
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.short}</span>
            {!tab.loading && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === tab.key ? 'bg-green-600/30 text-green-400' : 'bg-[#1f2420] text-[#9ca89a]'
              }`}>
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
    </div>
  )
}