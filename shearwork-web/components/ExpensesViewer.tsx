/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { Pencil, Repeat, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import { EmptyState, Panel, Segmented } from '@/components/ui/AppKit'

interface ExpenseStatus {
  lastAdded: string | null
  nextPending: string | null
}

interface ExpensesViewerProps {
  barberId: string
  month: string
  year: string
  onUpdate?: () => void
}

interface RecurringExpense {
  id: number
  user_id: string
  label: string
  amount: number
  frequency: 'once' | 'weekly' | 'monthly' | 'yearly'
  start_date: string
  end_date: string | null
  weekly_days: string[] | null
  monthly_day: number | null
  yearly_month: number | null
  yearly_day: number | null
  created_at: string
  updated_at: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ExpensesViewer({ barberId, month, year, onUpdate }: ExpensesViewerProps) {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Editable fields
  const [editLabel, setEditLabel] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editFrequency, setEditFrequency] = useState<'once' | 'weekly' | 'monthly' | 'yearly'>('once')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState<string | null>(null)
  const [editSelectedDays, setEditSelectedDays] = useState<string[]>([])
  const [editMonthlyDay, setEditMonthlyDay] = useState<number>(1)
  const [editYearlyMonth, setEditYearlyMonth] = useState<number>(0)
  const [editYearlyDay, setEditYearlyDay] = useState<number>(1)

  // Pagination
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 4
  const [totalCount, setTotalCount] = useState(0)

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

  // Helper to parse date strings as local dates (not UTC)
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Fetch expenses with pagination
  const fetchExpenses = async () => {
    console.log('📊 fetchExpenses START')
    setLoading(true)
    try {
      const monthIndex = MONTHS.indexOf(month)
      console.log('📊 monthIndex:', monthIndex, 'month:', month, 'year:', year)
      const yearNum = parseInt(year)
      const monthStart = new Date(yearNum, monthIndex, 1)
      const monthEnd = new Date(yearNum, monthIndex + 1, 0)

      console.log('📊 Querying recurring_expenses for user:', barberId)
      const { data: allExpenses, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('user_id', barberId)
        .order('created_at', { ascending: false })

      console.log('📊 Query result:', { count: allExpenses?.length, error })
      
      if (error) throw error

      // Filter client-side based on frequency and activity
      const filteredExpenses = (allExpenses || []).filter((exp: RecurringExpense) => {
        const start = parseLocalDate(exp.start_date)
        const end = exp.end_date ? parseLocalDate(exp.end_date) : null

        if (exp.frequency === 'once') {
          const matches = start.getMonth() === monthIndex && start.getFullYear() === yearNum
          return matches
        } else {
          // For recurring, show if active period overlaps with selected month
          if (start > monthEnd || (end && end < monthStart)) {
            return false // Not active this month, don't show
          }
          
          // Additional check: verify it actually has occurrences in this month
          const status = getExpenseStatus(exp, month, yearNum)
          return status.lastAdded !== null || status.nextPending !== null
        }
      })

      // Apply pagination to filtered results
      const totalFiltered = filteredExpenses.length
      setTotalCount(totalFiltered)

      const maxPage = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
      const validPage = Math.min(page, maxPage)

      const paginatedData = filteredExpenses.slice(
        (validPage - 1) * PAGE_SIZE,
        validPage * PAGE_SIZE
      )

      setExpenses(paginatedData)

      if (validPage !== page) {
        setPage(validPage)
      }
    } catch (err) {
    console.error('📊 fetchExpenses ERROR:', err)
    toast.error('Failed to load recurring expenses')
  } finally {
    console.log('📊 fetchExpenses FINALLY - setting loading to false')
    setLoading(false)
  }
  }

  // Real-time subscription
  useEffect(() => {
    console.log('📊 ExpensesViewer effect - barberId:', barberId)
    if (!barberId) {
      console.log('📊 No barberId, skipping fetch')
      setLoading(false)
      return
    }

    fetchExpenses()

    const channel = supabase
      .channel(`realtime-recurring-${barberId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recurring_expenses',
          filter: `user_id=eq.${barberId}`,
        },
        () => fetchExpenses()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recurring_expenses',
          filter: `user_id=eq.${barberId}`,
        },
        () => fetchExpenses()
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'recurring_expenses',
          filter: `user_id=eq.${barberId}`,
        },
        () => fetchExpenses()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [barberId, page, month, year])

  // Add this useEffect to handle automatic page navigation
  useEffect(() => {
    // If we're on a page beyond the last valid page, go back
    const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
    if (page > maxPage) {
      setPage(maxPage)
    }
  }, [totalCount, page])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this recurring expense?')) return
    try {
      const { error } = await supabase.from('recurring_expenses').delete().eq('id', id)
      if (error) throw error
      toast.success('Expense deleted')
      fetchExpenses()
      onUpdate?.()

      const { error: insertError } = await supabase
      .from('system_logs')
      .insert({
          source: barberId,
          action: 'expense_deleted',
          status: 'success',
          details: `Recurring expense deleted`,
      })

      if (insertError) throw insertError

    } catch (err) {
      console.error(err)
      toast.error('Failed to delete expense')
    }
  }

  const startEdit = (exp: RecurringExpense) => {
    setEditingId(exp.id)
    setEditLabel(exp.label)
    setEditAmount(exp.amount.toFixed(2))
    setEditFrequency(exp.frequency)
    setEditStartDate(exp.start_date)
    setEditEndDate(exp.end_date)
    setEditSelectedDays(exp.weekly_days || [])
    setEditMonthlyDay(exp.monthly_day || 1)
    setEditYearlyMonth(exp.yearly_month || 0)
    setEditYearlyDay(exp.yearly_day || 1)
  }

  const handleDayToggle = (day: string) => {
    setEditSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const handleSaveEdit = async () => {
    if (!editLabel.trim() || isNaN(parseFloat(editAmount))) return toast.error('Invalid input')

    try {
      const { error } = await supabase
        .from('recurring_expenses')
        .update({
          label: editLabel.trim(),
          amount: parseFloat(editAmount),
          frequency: editFrequency,
          start_date: editStartDate,
          end_date: editEndDate,
          weekly_days: editFrequency === 'weekly' ? editSelectedDays : null,
          monthly_day: editFrequency === 'monthly' ? editMonthlyDay : null,
          yearly_month: editFrequency === 'yearly' ? editYearlyMonth : null,
          yearly_day: editFrequency === 'yearly' ? editYearlyDay : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId)
      if (error) throw error
      toast.success('Expense updated')
      setEditingId(null)
      fetchExpenses()
      onUpdate?.()

      const { error: insertError } = await supabase
      .from('system_logs')
      .insert({
          source: barberId,
          action: 'expense_edited',
          status: 'success',
          details: `Recurring expense edited`,
      })

      if (insertError) throw insertError

    } catch (err) {
      console.error(err)
      toast.error('Failed to update expense')
    }
  }

  // Helper to get expense status for selected month
  const getExpenseStatus = (exp: RecurringExpense, month: string, year: number): ExpenseStatus => {
    const monthIndex = MONTHS.indexOf(month)
    const today = new Date()
    const start = parseLocalDate(exp.start_date)
    const end = exp.end_date ? parseLocalDate(exp.end_date) : null
    const monthStart = new Date(year, monthIndex, 1)
    const monthEnd = new Date(year, monthIndex + 1, 0)
    
    let lastAdded: string | null = null
    let nextPending: string | null = null
    
    // Check if expense is active during selected month
    if (start > monthEnd || (end && end < monthStart)) {
      return { lastAdded: null, nextPending: null }
    }

    const occurrences: Date[] = []
    
    switch (exp.frequency) {
      case 'once':
        const expDate = parseLocalDate(exp.start_date)
        if (expDate.getMonth() === monthIndex && expDate.getFullYear() === year) {
          occurrences.push(expDate)
        }
        break
      case 'weekly':
        const daysOfWeek = exp.weekly_days || []
        // Skip if no days selected
        if (daysOfWeek.length === 0) break
        
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(year, monthIndex, d)
          if (date >= start && (!end || date <= end)) {
            const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()]
            if (daysOfWeek.includes(dayName)) occurrences.push(date)
          }
        }
        break
      case 'monthly':
        if (exp.monthly_day && exp.monthly_day <= monthEnd.getDate()) {
          const occurrenceDate = new Date(year, monthIndex, exp.monthly_day)
          if (occurrenceDate >= start && (!end || occurrenceDate <= end)) {
            occurrences.push(occurrenceDate)
          }
        }
        break
      case 'yearly':
        if (exp.yearly_month === monthIndex && exp.yearly_day && exp.yearly_day <= monthEnd.getDate()) {
          const occurrenceDate = new Date(year, monthIndex, exp.yearly_day)
          if (occurrenceDate >= start && (!end || occurrenceDate <= end)) {
            occurrences.push(occurrenceDate)
          }
        }
        break
    }

    // Find last added and next pending
    occurrences.forEach(occ => {
      if (occ <= today) {
        if (!lastAdded || occ > new Date(lastAdded)) {
          lastAdded = occ.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }
      } else {
        if (!nextPending || occ < new Date(nextPending)) {
          nextPending = occ.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }
      }
    })

    return { lastAdded, nextPending }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <Panel
      title="Recurring expenses"
      subtitle={`${month} ${year}`}
      actions={totalCount > 0 ? <span className="badge tabular-nums">{totalCount}</span> : undefined}
      className="flex min-h-[420px] flex-col"
      bodyClassName="flex flex-1 flex-col min-h-0"
    >
      {loading ? (
        <p className="px-5 py-6 text-sm text-muted">Loading recurring expenses…</p>
      ) : expenses.length === 0 ? (
        <EmptyState icon={Repeat} title="No recurring expenses">
          Expenses that are active in {month} will show up here.
        </EmptyState>
      ) : (
        <>
          <ul className="flex-1 divide-y divide-white/[0.06] overflow-y-auto">
            {expenses.map(exp => (
              <li key={exp.id} className="px-5 py-4">
                {editingId === exp.id ? (
                  <div className="flex w-full flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="field-label">Label</label>
                        <input
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          placeholder="Label"
                          className="field"
                        />
                      </div>
                      <div>
                        <label className="field-label">Amount</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          placeholder="Amount"
                          className="field tabular-nums"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="field-label">Frequency</span>
                      <Segmented
                        className="w-full"
                        value={editFrequency}
                        onChange={setEditFrequency}
                        options={[
                          { value: 'once', label: 'Once' },
                          { value: 'weekly', label: 'Weekly' },
                          { value: 'monthly', label: 'Monthly' },
                          { value: 'yearly', label: 'Yearly' },
                        ]}
                      />
                    </div>

                    {editFrequency === 'weekly' && (
                      <div>
                        <span className="field-label">Days</span>
                        <div className="segmented flex w-full flex-wrap">
                          {DAYS.map(d => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => handleDayToggle(d)}
                              data-active={editSelectedDays.includes(d)}
                              aria-pressed={editSelectedDays.includes(d)}
                              className="segmented-item"
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {editFrequency === 'monthly' && (
                      <div className="w-32">
                        <label className="field-label">Day of month</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={editMonthlyDay}
                          onChange={e => setEditMonthlyDay(parseInt(e.target.value))}
                          className="field tabular-nums"
                        />
                      </div>
                    )}

                    {editFrequency === 'yearly' && (
                      <div className="grid grid-cols-2 gap-3 sm:w-64">
                        <div>
                          <label className="field-label">Month</label>
                          <select
                            value={editYearlyMonth}
                            onChange={e => setEditYearlyMonth(parseInt(e.target.value))}
                            className="field"
                          >
                            {Array.from({ length: 12 }, (_, i) => i).map(i => (
                              <option key={i} value={i}>{i + 1}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="field-label">Day</label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={editYearlyDay}
                            onChange={e => setEditYearlyDay(parseInt(e.target.value))}
                            className="field tabular-nums"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="field-label">Start date</label>
                        <input
                          type="date"
                          value={editStartDate}
                          onChange={e => setEditStartDate(e.target.value)}
                          className="field"
                        />
                      </div>
                      <div>
                        <label className="field-label">End date (optional)</label>
                        <input
                          type="date"
                          value={editEndDate || ''}
                          onChange={e => setEditEndDate(e.target.value || null)}
                          className="field"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">Cancel</button>
                      <button onClick={handleSaveEdit} className="btn btn-primary btn-sm">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <p className="truncate text-sm font-medium text-ivory">{exp.label}</p>
                        <p className="text-sm font-semibold tabular-nums text-ivory">${exp.amount.toFixed(2)}</p>
                      </div>
                      <p className="mt-0.5 text-[13px] capitalize text-muted">
                        {exp.frequency}
                        {exp.frequency === 'weekly' && exp.weekly_days?.length
                          ? ` (${exp.weekly_days.join(', ')})`
                          : ''}
                        <span className="text-gray-500 normal-case">
                          {' · '}{exp.start_date}{exp.end_date ? ` → ${exp.end_date}` : ''}
                        </span>
                      </p>

                      {/* Status badges */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(() => {
                          const status = getExpenseStatus(exp, month, parseInt(year))
                          return (
                            <>
                              {status.lastAdded && (
                                <span className="badge badge-sage">Added {status.lastAdded}</span>
                              )}
                              {status.nextPending && (
                                <span className="badge">Next {status.nextPending}</span>
                              )}
                              {!status.lastAdded && !status.nextPending && (
                                <span className="badge">Not active this month</span>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => startEdit(exp)} className="btn btn-ghost btn-sm" aria-label={`Edit ${exp.label}`}>
                        <Pencil size={15} strokeWidth={1.75} />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="btn btn-ghost btn-sm hover:!text-[#D99A8B]"
                        aria-label={`Delete ${exp.label}`}
                      >
                        <Trash2 size={15} strokeWidth={1.75} />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-5 py-3">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="btn btn-glass btn-sm"
              >
                Previous
              </button>
              <span className="text-xs tabular-nums text-muted">{page} / {totalPages}</span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="btn btn-glass btn-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </Panel>
  )
}
