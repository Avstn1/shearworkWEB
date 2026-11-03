/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { MoreVertical, ReceiptText, X, Receipt } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import ExpensesViewer from '@/components/ExpensesViewer'
import AdminRecurringExpenses from '@/components/AdminComponents/AdminRecurringExpenses'
import { useAuth } from '@/contexts/AuthContext'
import { AppPage, EmptyState, PageHeader, Panel, Stat } from '@/components/ui/AppKit'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

export default function UserExpensesPage() {
  const router = useRouter()

  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('default', { month: 'long' }))
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [receipts, setReceipts] = useState<{ id: string, url: string, path: string, label: string }[]>([])
  const [currentExpense, setCurrentExpense] = useState<number>(0)
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<{ url: string, label: string } | null>(null)

  const { user, profile, isLoading } = useAuth()
  console.log('💰 Expenses page - user:', !!user, 'isLoading:', isLoading)


  // Helper to parse date strings as local dates (not UTC)
  const parseLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  // Fetch data
  const fetchData = async () => {
    if (!user) return

    try {
      const monthIndex = MONTHS.indexOf(selectedMonth)
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Normalize to start of day for comparison
      const isCurrentMonth = today.getMonth() === monthIndex && today.getFullYear() === selectedYear
      const endDay = isCurrentMonth ? today.getDate() : new Date(selectedYear, monthIndex + 1, 0).getDate()

      let totalExpense = 0 // Start from 0, no monthly_data

      // Add recurring expenses that have occurred up to endDay
      const { data: recurringData } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('user_id', user.id)
      
      if (recurringData) {
        const monthStart = new Date(selectedYear, monthIndex, 1)
        const monthEnd = new Date(selectedYear, monthIndex + 1, 0)
        
        recurringData.forEach((rec: any) => {
          const start = parseLocalDate(rec.start_date)
          const end = rec.end_date ? parseLocalDate(rec.end_date) : null
                  
          // Apply same filtering as ExpensesViewer
          let shouldInclude = false
          if (rec.frequency === 'once') {
            // For 'once', only include if start_date is in the selected month
            shouldInclude = start.getMonth() === monthIndex && start.getFullYear() === selectedYear
          } else {
            // For recurring, check if active period overlaps with selected month
            shouldInclude = start <= monthEnd && (!end || end >= monthStart)
          }
          
          if (!shouldInclude) return // Skip this expense
          
          // Now calculate occurrences up to endDay (only count if date has passed)
          switch (rec.frequency) {
            case 'once':
              const expDate = parseLocalDate(rec.start_date)
              if (expDate.getDate() <= endDay && expDate <= today) {
                totalExpense += rec.amount
              }
              break
            case 'weekly':
              const daysOfWeek = rec.weekly_days || []
              if (daysOfWeek.length === 0) break
              
              for (let d = 1; d <= endDay; d++) {
                const date = new Date(selectedYear, monthIndex, d)
                if (date >= start && (!end || date <= end) && date <= today) {
                  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()]
                  if (daysOfWeek.includes(dayName)) totalExpense += rec.amount
                }
              }
              break
            case 'monthly':
              if (rec.monthly_day && rec.monthly_day <= endDay && rec.monthly_day <= monthEnd.getDate()) {
                const occurrenceDate = new Date(selectedYear, monthIndex, rec.monthly_day)
                if (occurrenceDate >= start && (!end || occurrenceDate <= end) && occurrenceDate <= today) {
                  totalExpense += rec.amount
                }
              }
              break
            case 'yearly':
              if (rec.yearly_month === monthIndex && rec.yearly_day <= endDay && rec.yearly_day <= monthEnd.getDate()) {
                const occurrenceDate = new Date(selectedYear, monthIndex, rec.yearly_day)
                if (occurrenceDate >= start && (!end || occurrenceDate <= end) && occurrenceDate <= today) {
                  totalExpense += rec.amount
                }
              }
              break
          }
        })
      }

      setCurrentExpense(totalExpense)

      // Receipts
      const { data: receiptData, error: receiptError } = await supabase
        .from('monthly_receipts')
        .select('id,image_url,label')
        .eq('user_id', user.id)
        .eq('month', selectedMonth)
        .eq('year', selectedYear)

      if (!receiptError && receiptData) {
        const urls = await Promise.all(
          receiptData.map(async r => {
            const { data: signedData } = await supabase.storage
              .from('receipts')
              .createSignedUrl(r.image_url, 60 * 60)
            return { id: r.id, path: r.image_url, url: signedData?.signedUrl || '', label: r.label || '' }
          })
        )
        setReceipts(urls.filter(r => r.url))
      }

    } catch (err) {
      console.error('Error fetching data:', err)
      toast.error('Failed to fetch expenses or receipts')
    }
  }

  useEffect(() => { if (user) fetchData() }, [user, selectedMonth, selectedYear])

  // Delete receipt
  const handleDeleteReceipt = async (receiptId: string, path: string) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return
    setLoadingDelete(receiptId)
    try {
      const { error: storageError } = await supabase.storage.from('receipts').remove([path])
      if (storageError) throw storageError
      const { error: dbError } = await supabase.from('monthly_receipts').delete().eq('id', receiptId)
      if (dbError) throw dbError
      toast.success('Receipt deleted!')
      fetchData()
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete receipt')
    }
    setLoadingDelete(null)
    setOpenMenu(null)
  }

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-canvas text-sm text-muted">Loading your expenses…</div>

  if (!user) {
    router.replace('/login')
    return null
  }

  const rangeLabel = (() => {
    const monthIndex = MONTHS.indexOf(selectedMonth)
    const today = new Date()
    const isCurrentMonth = today.getMonth() === monthIndex && today.getFullYear() === selectedYear
    const endDay = isCurrentMonth ? today.getDate() : new Date(selectedYear, monthIndex + 1, 0).getDate()
    return `Showing expenses from ${selectedMonth} 1 to ${selectedMonth} ${endDay}, ${selectedYear}`
  })()

  return (
    <AppPage>
      <PageHeader icon={Receipt} tone="coral"
        title="Expenses"
        subtitle="Track your one-off and recurring expenses per month."
        actions={
          <>
            <label className="sr-only" htmlFor="expenses-month">Month</label>
            <select
              id="expenses-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="field w-auto min-w-[9rem]"
            >{MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select>
            <label className="sr-only" htmlFor="expenses-year">Year</label>
            <select
              id="expenses-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="field w-auto min-w-[6rem]"
            >{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select>
          </>
        }
      />

      <div className="flex flex-col gap-4 md:gap-5">
        {/* Total to date */}
        <section className="panel panel-body">
          <Stat icon={Receipt} tone="coral"
            label="Total expenses to date"
            value={`$${currentExpense.toFixed(2)}`}
            hint={rangeLabel}
          />
        </section>

        {/* List | add form */}
        <div className="grid gap-4 md:gap-5 lg:grid-cols-2">
          <ExpensesViewer barberId={user.id} month={selectedMonth} year={selectedYear.toString()} onUpdate={fetchData} />
          {/* AdminRecurringExpenses ships its own card chrome; flatten it so it sits inside the panel. */}
          <section className="panel">
            <div className="panel-body">
              <AdminRecurringExpenses barberId={user.id} month={selectedMonth} year={selectedYear} onUpdate={fetchData} />
            </div>
          </section>
        </div>

        {/* Receipts */}
        <Panel title="Receipts" subtitle={`${selectedMonth} ${selectedYear}`}>
          {receipts.length === 0 ? (
            <EmptyState icon={ReceiptText} title="No receipts yet">
              Receipts you upload for this month will appear here.
            </EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {receipts.map(r => (
                <div
                  key={r.id}
                  className="group relative cursor-pointer overflow-hidden rounded-lg border border-white/[0.07] bg-raised transition-colors hover:border-white/[0.12]"
                  onClick={() => setSelectedReceipt({ url: r.url, label: r.label || '' })}
                >
                  <img
                    src={r.url}
                    alt={r.label || 'Receipt'}
                    className="h-40 w-full object-cover"
                  />
                  <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-3 py-2">
                    <span className="truncate text-xs text-gray-300">
                      {r.label || new Date().toLocaleDateString()}
                    </span>
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === r.id ? null : r.id) }}
                        className="btn btn-ghost btn-sm h-7 w-7 p-0"
                        title="Options"
                        aria-label="Receipt options"
                      >
                        <MoreVertical size={16} strokeWidth={1.75} />
                      </button>
                      {openMenu === r.id && (
                        <div className="modal-surface absolute bottom-full right-0 z-10 mb-1 w-28 overflow-hidden py-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteReceipt(r.id, r.path) }}
                            disabled={loadingDelete === r.id}
                            className="block w-full px-3 py-2 text-left text-sm text-[#FF8F7D] transition-colors hover:bg-white/[0.05] disabled:opacity-50"
                          >{loadingDelete === r.id ? 'Deleting...' : 'Delete'}</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <div
          className="modal-backdrop flex items-center justify-center p-4"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="modal-surface flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header">
              <h2 className="panel-title truncate">{selectedReceipt.label || 'Receipt'}</h2>
              <button
                className="btn btn-ghost btn-sm h-8 w-8 p-0"
                onClick={() => setSelectedReceipt(null)}
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="overflow-auto p-4">
              <img src={selectedReceipt.url} alt={selectedReceipt.label} className="h-auto w-full rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </AppPage>
  )
}
