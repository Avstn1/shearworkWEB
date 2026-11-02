/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, subHours } from 'date-fns'
import { DayPicker, DateRange } from 'react-day-picker'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, RefreshCcw, ScrollText, X } from "lucide-react"
import { AppPage, EmptyState, PageHeader } from '@/components/ui/AppKit'
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

      console.log('Fetching logs with query params:', { statusFilter, sourceFilter, range, search: debouncedSearchQuery, sortField, sortOrder })
      query = query.order(sortField, { ascending: sortOrder === 'asc' })
      const { data, error } = await query
      console.log(`Fetched ${data?.length || 0} logs`)  
      if (error) throw error
      setLogs(data || [])
      setCurrentPage(1)
    } catch (err: any) {
      console.error('Error fetching logs:', err)
      toast.error(`Failed to fetch system logs${err.message ? `: ${err.message}` : ''}`)
    } finally {
      console.log('Finished fetching logs')
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
    if (status === 'success') return <span className="badge badge-sage">Success</span>
    if (status === 'failed') return <span className="badge badge-danger">Failed</span>
    return <span className="badge badge-warn">Pending</span>
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
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className="btn btn-ghost btn-sm px-2"
        ><ChevronLeft size={16} strokeWidth={1.75} /></button>
        <span className="tabular-nums">Page {currentPage} of {totalPages}</span>
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className="btn btn-ghost btn-sm px-2"
        ><ChevronRight size={16} strokeWidth={1.75} /></button>
      </div>
    ) : null

  const sortKeys = ['timestamp', 'source', 'status'] as const

  return (
    <AppPage>
      <PageHeader
        title="System logs"
        subtitle={loading ? 'Loading…' : `${logs.length} entries in range`}
        actions={
          <>
            <Pagination />
            <button onClick={fetchLogs} className="btn btn-glass btn-sm" aria-label="Refresh logs">
              <RefreshCcw size={16} strokeWidth={1.75} />
              Refresh
            </button>
          </>
        }
      />

      <section className="panel">
        <div className="panel-header flex-wrap justify-start gap-2">
          <input
            type="text"
            placeholder="Search all fields..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="field h-9 min-w-[200px] flex-1"
          />

          <select
            value={statusFilter || ''}
            onChange={e => setStatusFilter(e.target.value || null)}
            className="field h-9 w-auto"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>

          <select
            value={sourceFilter || ''}
            onChange={e => setSourceFilter(e.target.value || null)}
            className="field h-9 w-auto"
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
              className="field h-9 w-auto"
            >
              {DATE_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {datePreset === 'Custom' && showCustomPicker && (
              <div className="modal-surface absolute top-full z-50 mt-2 p-2">
                <div className="mb-1 flex justify-end">
                  <button
                    onClick={() => setShowCustomPicker(false)}
                    aria-label="Close date picker"
                    className="btn btn-ghost btn-sm h-8 px-2"
                  >
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </div>
                <DayPicker
                  mode="range"
                  selected={customRange}
                  onSelect={range => setCustomRange(range as DateRange | undefined)}
                  className="rounded-lg bg-raised text-ivory"
                  modifiersClassNames={{
                    selected: 'bg-sage text-ink rounded-md',
                    range_start: 'bg-sage text-ink rounded-l-md',
                    range_end: 'bg-sage text-ink rounded-r-md',
                    range_middle: 'bg-sage/20 text-ivory',
                  }}
                  showOutsideDays
                />
              </div>
            )}
          </div>

          <select
            value={itemsPerPage}
            onChange={e => setItemsPerPage(Number(e.target.value))}
            className="field h-9 w-auto"
          >
            {ITEMS_OPTIONS.map(i => <option key={i} value={i}>{i} per page</option>)}
          </select>

          <button onClick={resetFilters} className="btn btn-ghost btn-sm h-9">Reset</button>
        </div>

        <div className="max-h-[75vh] overflow-auto">
          <table className="table-clean min-w-full">
            <thead>
              <tr>
                {['Log ID', 'Timestamp', 'Action', 'Details', 'Status', 'Source'].map((col, idx) => (
                  <th
                    key={idx}
                    onClick={() => idx <= 2 && handleSort(sortKeys[idx])}
                    className={`select-none ${idx <= 2 ? 'cursor-pointer hover:text-ivory' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col}
                      {idx <= 2 && sortField === sortKeys[idx] && (
                        sortOrder === 'asc'
                          ? <ArrowUp size={12} strokeWidth={1.75} />
                          : <ArrowDown size={12} strokeWidth={1.75} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-muted">Loading syslogs...</td></tr>
              ) : paginatedLogs.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={ScrollText} title="No logs found." /></td></tr>
              ) : (
                paginatedLogs.map(log => (
                  <tr key={log.id}>
                    <td className="font-mono text-xs text-muted">{log.id}</td>
                    <td className="whitespace-nowrap tabular-nums">{weekdays[new Date(log.timestamp).getUTCDay()]}, {formatTimestamp(log.timestamp)}</td>
                    <td>{log.action}</td>
                    <td className="max-w-xs truncate text-muted">{log.details || '-'}</td>
                    <td>{getStatusBadge(log.status)}</td>
                    <td className="text-muted">{log.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppPage>
  )
}
