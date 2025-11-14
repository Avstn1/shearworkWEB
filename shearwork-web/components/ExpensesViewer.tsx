/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'

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

  // Fetch expenses with pagination
  const fetchExpenses = async () => {
    setLoading(true)
    try {
      // Total count
      const { count, error: countError } = await supabase
        .from('recurring_expenses')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', barberId)
      if (countError) throw countError
      setTotalCount(count || 0)

      // Page data
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('user_id', barberId)
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      setExpenses(data || [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load recurring expenses')
    } finally {
      setLoading(false)
    }
  }

  // Real-time subscription
  useEffect(() => {
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
  }, [barberId, page])

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

  if (loading) return <p className="text-sm text-gray-400">Loading recurring expenses...</p>

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="flex flex-col h-[480px] gap-4">
      <h3 className="text-white font-semibold text-lg">Recurring Expenses</h3>

      {expenses.length === 0 ? (
        <p className="text-sm text-gray-400">No recurring expenses found.</p>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {expenses.map(exp => (
              <motion.div
                key={exp.id}
                whileHover={{ scale: 1.01 }}
                className="bg-white/10 border border-white/10 rounded-xl p-4 flex justify-between items-start"
              >
                {editingId === exp.id ? (
                  <div className="flex flex-col gap-2 w-full">
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      placeholder="Label"
                      className="px-2 py-1 bg-white/10 text-white border border-white/20 rounded-lg"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={editAmount}
                      onChange={e => setEditAmount(e.target.value)}
                      placeholder="Amount"
                      className="px-2 py-1 bg-white/10 text-white border border-white/20 rounded-lg"
                    />
                    <select
                      value={editFrequency}
                      onChange={(e) => setEditFrequency(e.target.value as any)}
                      className="px-2 py-1 bg-white/10 text-white border border-white/20 rounded-lg"
                    >
                      <option value="once">Once</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>

                    {editFrequency === 'weekly' && (
                      <div className="flex gap-1 flex-wrap mt-1">
                        {DAYS.map(d => (
                          <button
                            key={d}
                            onClick={() => handleDayToggle(d)}
                            className={`px-2 py-1 rounded-md text-xs font-semibold transition ${
                              editSelectedDays.includes(d)
                                ? 'bg-lime-400/40 text-lime-100'
                                : 'bg-white/10 text-white/70 hover:text-white/90'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}

                    {editFrequency === 'monthly' && (
                      <div className="flex gap-2 mt-1 items-center">
                        <label className="text-white text-sm">Day of month:</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={editMonthlyDay}
                          onChange={e => setEditMonthlyDay(parseInt(e.target.value))}
                          className="w-16 px-2 py-1 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                        />
                      </div>
                    )}

                    {editFrequency === 'yearly' && (
                      <div className="flex gap-2 mt-1 flex-wrap items-center">
                        <label className="text-white text-sm">Month:</label>
                        <select
                          value={editYearlyMonth}
                          onChange={e => setEditYearlyMonth(parseInt(e.target.value))}
                          className="px-2 py-1 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                        >
                          {Array.from({ length: 12 }, (_, i) => i).map(i => (
                            <option key={i} value={i}>{i + 1}</option>
                          ))}
                        </select>
                        <label className="text-white text-sm">Day:</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={editYearlyDay}
                          onChange={e => setEditYearlyDay(parseInt(e.target.value))}
                          className="w-16 px-2 py-1 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                        />
                      </div>
                    )}

                    <input
                      type="date"
                      value={editStartDate}
                      onChange={e => setEditStartDate(e.target.value)}
                      className="px-2 py-1 bg-white/10 text-white border border-white/20 rounded-lg"
                    />
                    <input
                      type="date"
                      value={editEndDate || ''}
                      onChange={e => setEditEndDate(e.target.value || null)}
                      className="px-2 py-1 bg-white/10 text-white border border-white/20 rounded-lg"
                    />

                    <div className="flex gap-2 justify-end mt-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-sm rounded-md bg-gray-600/50 hover:bg-gray-600 text-white"
                      >Cancel</button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-3 py-1 text-sm rounded-md bg-green-600/60 hover:bg-green-600 text-white"
                      >Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-white font-medium">{exp.label}</p>
                      <p className="text-sm text-gray-400">
                        ${exp.amount.toFixed(2)} — {exp.frequency}
                        {exp.frequency === 'weekly' && exp.weekly_days?.length
                          ? ` (${exp.weekly_days.join(', ')})`
                          : ''}
                      </p>
                      <p className="text-xs text-gray-500">
                        {exp.start_date} {exp.end_date ? `→ ${exp.end_date}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(exp)}
                        className="text-sm px-3 py-1 rounded-md bg-amber-500/30 hover:bg-amber-500/50 text-white"
                      >Edit</button>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="text-sm px-3 py-1 rounded-md bg-red-600/40 hover:bg-red-600/60 text-white"
                      >Delete</button>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex gap-2 justify-center mt-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-md bg-gray-600/50 hover:bg-gray-600 text-white disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-white">{page} / {totalPages}</span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-md bg-gray-600/50 hover:bg-gray-600 text-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
