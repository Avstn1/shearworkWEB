/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { format, getISOWeek, getYear, startOfISOWeek, endOfISOWeek, addWeeks, subWeeks } from 'date-fns'
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import 'react-day-picker/dist/style.css'

interface EngagementRecord {
  user_id: string
  full_name: string
  phone: string
  first_response_at: string
}

export default function NudgeEngagementPage() {
  const [records, setRecords] = useState<EngagementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close date picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getWeekInfo = (date: Date) => {
    const weekNumber = getISOWeek(date)
    const year = getYear(date)
    const weekStart = startOfISOWeek(date)
    const weekEnd = endOfISOWeek(date)
    
    return {
      year,
      weekNumber,
      weekStart,
      weekEnd,
      title: `${year} - Week ${weekNumber} | ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
    }
  }

  const fetchEngagements = async () => {
    setLoading(true)
    try {
      const weekInfo = getWeekInfo(currentWeek)
      
      // Get Monday 10am of the week
      const mondayDate = weekInfo.weekStart
      const mondayTenAM = new Date(mondayDate)
      mondayTenAM.setHours(10, 0, 0, 0)
      
      // Get end of Sunday
      const sundayEnd = weekInfo.weekEnd
      const sundayEndOfDay = new Date(sundayEnd)
      sundayEndOfDay.setHours(23, 59, 59, 999)

      console.log('Fetching engagements for week:', {
        week: weekInfo.title,
        startTime: mondayTenAM.toISOString(),
        endTime: sundayEndOfDay.toISOString()
      })

      // Fetch all SMS replies for the week starting from Monday 10am
      const { data: replies, error: repliesError } = await supabase
        .from('sms_replies')
        .select('user_id, received_at, phone_number')
        .gte('received_at', mondayTenAM.toISOString())
        .lte('received_at', sundayEndOfDay.toISOString())
        .order('received_at', { ascending: true })

      if (repliesError) throw repliesError

      console.log(`Found ${replies?.length || 0} replies in date range`)

      if (!replies || replies.length === 0) {
        setRecords([])
        setLoading(false)
        return
      }

      // Group by user_id and get first response per user
      const userFirstResponses = new Map<string, { received_at: string; phone_number: string }>()
      
      replies.forEach(reply => {
        if (!userFirstResponses.has(reply.user_id)) {
          userFirstResponses.set(reply.user_id, {
            received_at: reply.received_at,
            phone_number: reply.phone_number
          })
        }
      })

      console.log(`${userFirstResponses.size} unique users responded`)

      // Fetch user profiles
      const userIds = Array.from(userFirstResponses.keys())
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('user_id', userIds)

      if (profilesError) throw profilesError

      console.log(`Found ${profiles?.length || 0} matching profiles`)

      // Combine data
      const engagementRecords: EngagementRecord[] = (profiles || []).map(profile => {
        const firstResponse = userFirstResponses.get(profile.user_id)!
        return {
          user_id: profile.user_id,
          full_name: profile.full_name || 'Unknown',
          phone: profile.phone || firstResponse.phone_number,
          first_response_at: firstResponse.received_at
        }
      })

      // Sort by first response time (earliest first)
      engagementRecords.sort((a, b) => 
        new Date(a.first_response_at).getTime() - new Date(b.first_response_at).getTime()
      )

      setRecords(engagementRecords)
    } catch (err: any) {
      console.error('Error fetching engagements:', err)
      toast.error(`Failed to fetch engagement data${err.message ? `: ${err.message}` : ''}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEngagements()
  }, [currentWeek])

  const handlePreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1))
  }

  const handleNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1))
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCurrentWeek(date)
      setShowDatePicker(false)
    }
  }

  const formatResponseTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return format(date, 'EEE, MMM d, yyyy • h:mm a')
  }

  const formatPhone = (phone: string) => {
    // Format as (XXX) XXX-XXXX if 10 digits
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  const weekInfo = getWeekInfo(currentWeek)
  const isCurrentWeek = getISOWeek(new Date()) === weekInfo.weekNumber && 
                        getYear(new Date()) === weekInfo.year

  return (
    <div className="pt-25 p-4 min-h-screen bg-[#1f2420] text-[#F1F5E9]">
      {/* Header with Stats */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--highlight)] mb-1">
            Nudge Engagement
          </h1>
          <p className="text-[#9ca89a] text-xs">
            Track client responses from Monday 10:00 AM onwards, showing only first response per week
          </p>
        </div>
        
        {/* Stats Card - Inline */}
        <div className="bg-gradient-to-br from-[#2a2f27] to-[#242924] rounded-xl p-3 border border-[#55694b] shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-600/20 border-2 border-green-600/40 flex items-center justify-center">
              <span className="text-lg">💬</span>
            </div>
            <div>
              <div className="text-[#9ca89a] text-xs font-medium">Total Responses</div>
              <div className="text-xl font-bold text-[var(--highlight)]">
                {loading ? '...' : records.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="mb-4 bg-[#2a2f27] rounded-xl p-3 border border-[#55694b] shadow-md">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Previous Week Button */}
          <button
            onClick={handlePreviousWeek}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3a4431] text-[#F1F5E9] hover:bg-[#4b5a42] transition-all hover:scale-105 active:scale-95 text-sm"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {/* Week Title */}
          <div className="flex-1 text-center">
            <div className="text-lg font-bold text-[var(--highlight)]">
              {weekInfo.title}
            </div>
            {isCurrentWeek && (
              <div className="inline-block px-2 py-0.5 rounded-full bg-green-600/20 border border-green-600/40 text-green-400 text-[10px] font-semibold mt-1">
                Current Week
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3a4431] text-[#F1F5E9] hover:bg-[#4b5a42] transition-all hover:scale-105 active:scale-95 text-sm"
            >
              <Calendar size={16} />
              <span className="hidden sm:inline">Jump to Date</span>
            </button>

            {showDatePicker && (
              <div className="absolute right-0 top-full mt-2 z-50 bg-[#2f3a2d] border border-[#55694b] rounded-xl shadow-2xl p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-[var(--highlight)]">Select a Date</span>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="px-2 py-0.5 text-xs bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <DayPicker
                  mode="single"
                  selected={currentWeek}
                  onSelect={handleDateSelect}
                  className="rounded-lg bg-[#2f3a2d] text-[#F1F5E9]"
                  modifiersClassNames={{
                    selected: 'bg-green-600 text-[#F1F5E9] rounded-full font-bold',
                    today: 'bg-green-600/30 text-[#F1F5E9] rounded-full font-semibold',
                  }}
                  showOutsideDays
                />
              </div>
            )}
          </div>

          {/* Next Week Button */}
          <button
            onClick={handleNextWeek}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3a4431] text-[#F1F5E9] hover:bg-[#4b5a42] transition-all hover:scale-105 active:scale-95 text-sm"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#2a2f27] rounded-xl shadow-xl border border-[#55694b] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#55694b]">
            <thead className="bg-[#2f3a2d]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--highlight)]">
                  #
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--highlight)]">
                  Client Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--highlight)]">
                  Phone Number
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--highlight)]">
                  First Response
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#55694b]/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-[#55694b] border-t-green-600 rounded-full animate-spin"></div>
                      <span className="text-[#9ca89a]">Loading engagement data...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-[#3a4431] flex items-center justify-center">
                        <span className="text-3xl opacity-50">📭</span>
                      </div>
                      <div className="text-[#9ca89a] text-lg">No responses this week</div>
                      <div className="text-[#9ca89a]/60 text-sm">
                        Clients who respond on or after Monday 10:00 AM will appear here
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((record, index) => (
                  <tr 
                    key={record.user_id} 
                    className="hover:bg-[#3a4431] transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#3a4431] group-hover:bg-[#4b5a42] text-sm font-bold text-[var(--highlight)] transition-colors">
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-base font-semibold text-[#F1F5E9]">
                        {record.full_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-[#9ca89a] bg-[#1f2420] px-3 py-1.5 rounded-lg inline-block">
                        {formatPhone(record.phone)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[#F1F5E9]">
                        {formatResponseTime(record.first_response_at)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Info */}
      {!loading && records.length > 0 && (
        <div className="mt-3 text-center text-xs text-[#9ca89a]">
          Showing {records.length} {records.length === 1 ? 'client' : 'clients'} who responded during this week
        </div>
      )}
    </div>
  )
}