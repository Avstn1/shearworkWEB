/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, subHours } from 'date-fns'
import { DayPicker, DateRange } from 'react-day-picker'
import { RefreshCcw } from "lucide-react"
import 'react-day-picker/dist/style.css'

interface SystemLog {
  id: string
  timestamp: string
  source: string
  action: string
  status: 'success' | 'pending' | 'failed'
  details?: string
}

const STATUS_OPTIONS = ['success', 'pending', 'failed']
const SOURCE_OPTIONS = ['SYSTEM', 'USER']
const ITEMS_OPTIONS = [15, 25, 50, 100]
const DATE_PRESETS = ['Day', 'Week', 'Month', 'Custom'] as const
const SEARCH_DEBOUNCE_MS = 500

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState<typeof DATE_PRESETS[number]>('Month')
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined)
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [sortField, setSortField] = useState<'timestamp' | 'source' | 'status'>('timestamp')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(100)

  const pickerRef = useRef<HTMLDivElement>(null)
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Close custom picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowCustomPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchQuery(searchQuery), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handler)
  }, [searchQuery])

  const getDateRange = () => {
    const now = new Date()
    switch (datePreset) {
      case 'Day': return { from: startOfDay(now), to: endOfDay(now) }
      case 'Week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }
      case 'Month': return { from: startOfMonth(now), to: endOfMonth(now) }
      case 'Custom':
        const from = customRange?.from
        const to = customRange?.to
        if (from && to) return { from: startOfDay(from), to: endOfDay(to) }
        if (from) return { from: startOfDay(from), to: endOfDay(from) }
        return { from: startOfDay(now), to: endOfDay(now) }
    }
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let query = supabase.from('system_logs').select('id, timestamp, source, action, status, details')

      if (statusFilter) query = query.eq('status', statusFilter)
      if (sourceFilter) {
        query = sourceFilter === 'SYSTEM' ? query.eq('source', 'SYSTEM') : query.not('source', 'eq', 'SYSTEM')
      }

      const range = getDateRange()
      if (range.from) query = query.gte('timestamp', range.from.toISOString())
      if (range.to) query = query.lte('timestamp', range.to.toISOString())

      if (debouncedSearchQuery) {
        const term = `%${debouncedSearchQuery}%`
        query = query.or(
          `id.ilike.${term},source.ilike.${term},action.ilike.${term},status.ilike.${term},details.ilike.${term}`
        )
      }

      query = query.order(sortField, { ascending: sortOrder === 'asc' })
      const { data, error } = await query
      if (error) throw error
      setLogs(data || [])
      setCurrentPage(1)
    } catch (err: any) {
      console.error('Error fetching logs:', err)
      toast.error(`Failed to fetch system logs${err.message ? `: ${err.message}` : ''}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLogs() }, [debouncedSearchQuery, statusFilter, sourceFilter, datePreset, customRange, sortField, sortOrder])

  const totalPages = Math.ceil(logs.length / itemsPerPage)
  const paginatedLogs = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleSort = (field: 'timestamp' | 'source' | 'status') => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortOrder('asc') }
  }

  const getStatusBadge = (status: SystemLog['status']) => {
    const base = 'px-2 py-1 rounded-full text-xs font-semibold'
    if (status === 'success') return <span className={`${base} bg-green-100 text-green-800`}>Success</span>
    if (status === 'failed') return <span className={`${base} bg-red-100 text-red-800`}>Failed</span>
    return <span className={`${base} bg-yellow-100 text-yellow-800`}>Pending</span>
  }

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts)
    date.setHours(date.getHours() + 5)
    return format(date, 'MMM d yyyy HH:mm')
  }


  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter(null)
    setSourceFilter(null)
    setDatePreset('Day')
    setCustomRange(undefined)
    setItemsPerPage(15)
    setShowCustomPicker(false)
  }

  const Pagination = () =>
    totalPages > 1 ? (
      <div className="flex justify-center items-center gap-3 mt-2">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 rounded-lg bg-[#3a4431] text-[#F1F5E9] disabled:opacity-50 hover:bg-[#4b5a42] transition-colors"
        >&larr;</button>
        <span>Page {currentPage} of {totalPages}</span>
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-3 py-1 rounded-lg bg-[#3a4431] text-[#F1F5E9] disabled:opacity-50 hover:bg-[#4b5a42] transition-colors"
        >&rarr;</button>
      </div>
    ) : null

  return (
    <>
      <Navbar />
      <div className="p-4 sm:p-6 min-h-screen bg-[#1f2420] text-[#F1F5E9]">
        <h1 className="text-3xl font-bold text-[var(--highlight)] mb-6">System Logs</h1>

        <div className="sticky top-0 z-20 bg-[#1f2420] p-3 border-b border-[#55694b] flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Search all fields..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] placeholder-[#888] focus:outline-none focus:ring-2 focus:ring-[var(--accent-3)]"
          />
          <Pagination />

          <button
            onClick={fetchLogs}
            className="px-4 py-2 rounded-lg bg-[#3a4431] text-[#F1F5E9] hover:bg-[#4b5a42] transition-colors"
          >
            <RefreshCcw size={25} />
          </button>

          <select
            value={statusFilter || ''}
            onChange={e => setStatusFilter(e.target.value || null)}
            className="px-4 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] focus:outline-none focus:ring-2 focus:ring-[var(--accent-3)] appearance-none"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>

          <select
            value={sourceFilter || ''}
            onChange={e => setSourceFilter(e.target.value || null)}
            className="px-4 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] focus:outline-none focus:ring-2 focus:ring-[var(--accent-3)] appearance-none"
          >
            <option value="">All Sources</option>
            {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="relative" ref={pickerRef}>
            <select
              value={datePreset}
              onChange={e => {
                const value = e.target.value as typeof DATE_PRESETS[number]
                setDatePreset(value)
                if (value === 'Custom') setShowCustomPicker(true)
              }}
              className="px-4 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] focus:outline-none focus:ring-2 focus:ring-[var(--accent-3)] appearance-none"
            >
              {DATE_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {datePreset === 'Custom' && showCustomPicker && (
              <div className="absolute top-full mt-2 z-50 bg-[#2f3a2d] border border-[#55694b] rounded-lg shadow-lg p-2">
                <div className="flex justify-end mb-1">
                  <button
                    onClick={() => setShowCustomPicker(false)}
                    className="px-2 py-1 text-sm bg-red-600 rounded hover:bg-red-700"
                  >
                    ✕
                  </button>
                </div>
                <DayPicker
                  mode="range"
                  selected={customRange}
                  onSelect={range => setCustomRange(range as DateRange | undefined)}
                  className="rounded-lg border border-[#55694b] bg-[#2f3a2d] text-[#F1F5E9]"
                  modifiersClassNames={{
                    selected: 'bg-green-600 text-[#F1F5E9] rounded-full',
                    range_start: 'bg-green-700 text-[#F1F5E9] rounded-l-full',
                    range_end: 'bg-green-700 text-[#F1F5E9] rounded-r-full',
                    range_middle: 'bg-green-500 text-[#F1F5E9]',
                  }}
                  showOutsideDays
                />
              </div>
            )}
          </div>

          <select
            value={itemsPerPage}
            onChange={e => setItemsPerPage(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] focus:outline-none focus:ring-2 focus:ring-[var(--accent-3)] appearance-none"
          >
            {ITEMS_OPTIONS.map(i => <option key={i} value={i}>{i} per page</option>)}
          </select>

          <button onClick={resetFilters} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg">Reset</button>
        </div>

        <div className="mt-4 bg-[#2a2f27] rounded-xl shadow-md border border-[#55694b] max-h-[80vh] overflow-auto">
          <table className="min-w-full divide-y divide-[#55694b]">
            <thead className="bg-[#2f3a2d] sticky top-0 z-10">
              <tr>
                {['Log ID', 'Timestamp', 'Action', 'Details', 'Status', 'Source'].map((col, idx) => (
                  <th
                    key={idx}
                    onClick={() => idx <= 2 && handleSort((['timestamp', 'source', 'status'] as const)[idx])}
                    className={`px-6 py-3 text-left text-sm font-semibold cursor-pointer select-none ${idx <= 2 ? 'hover:text-[var(--highlight)]' : ''}`}
                  >
                    {col} {idx <= 2 && sortField === (['timestamp', 'source', 'status'] as const)[idx] ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-6">Loading...</td></tr>
              ) : paginatedLogs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6">No logs found.</td></tr>
              ) : (
                paginatedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-[#3a4431] transition-colors">
                    <td className="px-6 py-3">{log.id}</td>
                    <td className="px-6 py-3">{weekdays[new Date(log.timestamp).getUTCDay()]}, {formatTimestamp(log.timestamp)}</td>
                    <td className="px-6 py-3">{log.action}</td>
                    <td className="px-6 py-3 max-w-xs truncate">{log.details || '-'}</td>
                    <td className="px-6 py-3">{getStatusBadge(log.status)}</td>
                    <td className="px-6 py-3">{log.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}