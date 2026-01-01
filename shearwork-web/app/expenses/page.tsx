/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/utils/supabaseClient'
import Navbar from '@/components/Navbar'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import ExpensesViewer from '@/components/ExpensesViewer'
import AdminRecurringExpenses from '@/components/AdminComponents/AdminRecurringExpenses'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
}

export default function UserExpensesPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('default', { month: 'long' }))
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [receipts, setReceipts] = useState<{ id: string, url: string, path: string, label: string }[]>([])
  const [currentExpense, setCurrentExpense] = useState<number>(0)
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [selectedReceipt, setSelectedReceipt] = useState<{ url: string, label: string } | null>(null)

  // Fetch user & profile
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) return router.push('/login')
        setUser(user)

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
        if (profileError) throw profileError
        setProfile(profileData)
      } catch (err) {
        console.error('Error fetching user/profile:', err)
        toast.error('Failed to fetch user profile.')
      }
    }
    fetchUser()
  }, [router])


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

  if (!user || !profile) return <div className="flex justify-center items-center h-screen text-[#bdbdbd]">Loading your expenses dashboard...</div>

  return (
    <>
      <motion.div
        className="min-h-screen pt-[100px] px-4 sm:px-8 pb-8 bg-gradient-to-br from-[#0e100f] via-[#1a1e18] to-[#2b3a29] text-[var(--foreground)]"
        initial="hidden"
        animate="visible"
      >
        {/* HEADER */}
        <motion.div variants={fadeInUp} className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="font-bold bg-gradient-to-r from-amber-200 to-lime-400 bg-clip-text text-transparent text-2xl animate-gradient">Monthly Expenses</h1>
            <p className="text-xs text-[#bdbdbd]">Track your one-off and recurring expenses per month.</p>
          </div>
        </motion.div>

        {/* Month / Year Selectors */}
        <motion.div variants={fadeInUp} className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-[#d4e1c1]">Month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="ml-2 px-4 py-2 rounded-full bg-zinc-900/90 text-white text-sm font-semibold border border-zinc-700 shadow focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
            >{MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-[#d4e1c1]">Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="ml-2 px-4 py-2 rounded-full bg-zinc-900/90 text-white text-sm font-semibold border border-zinc-700 shadow focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
            >{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select>
          </div>
        </motion.div>

        {/* Current Expense */}
        <motion.div variants={fadeInUp} className="mb-6">
          <p className="text-white font-semibold text-lg">Total Expenses to Date: <span className="text-lime-300 font-bold">${currentExpense.toFixed(2)}</span></p>
          <p className="text-xs text-[#bdbdbd] mt-1">
            {(() => {
              const monthIndex = MONTHS.indexOf(selectedMonth)
              const today = new Date()
              const isCurrentMonth = today.getMonth() === monthIndex && today.getFullYear() === selectedYear
              const endDay = isCurrentMonth ? today.getDate() : new Date(selectedYear, monthIndex + 1, 0).getDate()
              return `Showing expenses from ${selectedMonth} 1 to ${selectedMonth} ${endDay}, ${selectedYear}`
            })()}
          </p>
        </motion.div>

        {/* Expenses + Recurring Editors */}
        <motion.div variants={fadeInUp} className="grid gap-6 md:grid-cols-2">
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6">
            <ExpensesViewer barberId={user.id} month={selectedMonth} year={selectedYear.toString()} onUpdate={fetchData} />
          </div>
          <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6">
            <AdminRecurringExpenses barberId={user.id} month={selectedMonth} year={selectedYear} onUpdate={fetchData} />
          </div>
        </motion.div>

        {/* Receipts Gallery */}
        <motion.div variants={fadeInUp} className="mt-8">
          <h2 className="font-semibold text-lg mb-4">Your Receipts</h2>
          {receipts.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2 sm:col-span-4 flex items-center justify-center h-40 border border-white/10 rounded-lg">
                <p className="text-sm text-[#bdbdbd]">No receipts uploaded yet.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {receipts.map(r => (
                <div
                  key={r.id}
                  className="relative group rounded-lg overflow-hidden border border-white/10 shadow-md cursor-pointer"
                  onClick={() => setSelectedReceipt({ url: r.url, label: r.label || '' })}
                >
                  <img
                    src={r.url}
                    alt={r.label || 'Receipt'}
                    className="w-full h-40 object-cover hover:scale-105 transition-transform"
                  />
                  <div className="absolute top-0 left-0 bg-gradient-to-r from-amber-400/70 to-lime-400/70 text-black font-semibold text-xs px-2 py-1 rounded-br-md">
                    {r.label || new Date().toLocaleDateString()}
                  </div>
                  <div className="absolute top-2 right-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === r.id ? null : r.id) }}
                      className="p-1 rounded-full bg-white/20 hover:bg-white/30 transition"
                      title="Options"
                    >⋮</button>
                    {openMenu === r.id && (
                      <div className="absolute right-0 mt-2 w-24 bg-zinc-900 border border-white/10 rounded-md shadow-lg z-10">
                        <button
                          onClick={() => handleDeleteReceipt(r.id, r.path)}
                          disabled={loadingDelete === r.id}
                          className="block w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-600/30 transition"
                        >{loadingDelete === r.id ? 'Deleting...' : 'Delete'}</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Receipt Modal */}
        {selectedReceipt && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setSelectedReceipt(null)}
          >
            <div
              className="relative bg-zinc-900 p-4 rounded-2xl shadow-xl max-w-3xl w-[90%] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={selectedReceipt.url} alt={selectedReceipt.label} className="w-full h-auto rounded-lg" />
              {selectedReceipt.label && (
                <p className="mt-2 text-white font-semibold text-center">{selectedReceipt.label}</p>
              )}
              <button
                className="absolute top-2 right-2 p-2 bg-red-600/70 rounded-full hover:bg-red-600 transition text-white"
                onClick={() => setSelectedReceipt(null)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

      </motion.div>
    </>
  )
}
