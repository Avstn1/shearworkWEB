'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css' // basic CSS
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

export default function DailyTipsDropdown({
  barberId,
  onRefresh,
}: {
  barberId: string
  onRefresh?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [tipAmount, setTipAmount] = useState<number | ''>('')
  const [currentTips, setCurrentTips] = useState<number>(0)
  const [action, setAction] = useState<'replace' | 'add'>('add')
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const dateStr = selectedDate.toISOString().split('T')[0]
  const month = selectedDate.toLocaleString('default', { month: 'long' })
  const year = selectedDate.getFullYear()

  // 🔹 Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 🔹 Fetch tips for the selected date
  useEffect(() => {
    if (!barberId) return
    const fetchTips = async () => {
      const { data, error } = await supabase
        .from('daily_data')
        .select('tips')
        .eq('user_id', barberId)
        .eq('date', dateStr)
        .maybeSingle()

      if (error) {
        console.error(error)
        toast.error('Failed to load tips for that date.')
      } else {
        setCurrentTips(data?.tips || 0)
      }
    }
    fetchTips()
  }, [barberId, dateStr])

  // 🔹 Save or update tips for the selected date
  async function handleSaveTips() {
    if (tipAmount === '') {
      toast.error('Please enter a tip amount.')
      return
    }

    try {
      setLoading(true)
      const newTotal =
        action === 'add' ? currentTips + Number(tipAmount) : Number(tipAmount)

      const { error } = await supabase.from('daily_data').upsert(
        {
          user_id: barberId,
          date: dateStr,
          tips: newTotal,
          updated_at: new Date().toISOString(),
          year,
          month,
          final_revenue: 0, // trigger will handle recalculation
        },
        { onConflict: 'user_id,date' }
      )

      if (error) throw error

      setCurrentTips(newTotal)
      toast.success(
        `Tips for ${month} ${selectedDate.getDate()} ${action === 'add' ? 'updated' : 'saved'}!`
      )
      setIsOpen(false)
      setTipAmount('')
      if (onRefresh) onRefresh()
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to save tips.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main trigger button */}
      <motion.button
        onClick={() => setIsOpen(prev => !prev)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="
          px-3 py-1.5 sm:px-4 sm:py-2
          bg-gradient-to-r from-amber-400/30 to-lime-500/30 
          border border-white/10 text-white font-semibold 
          rounded-xl shadow-md hover:shadow-lg 
          transition-all backdrop-blur-md
          text-xs sm:text-sm
          active:scale-95
        "
      >
        💰 Manage Tips
      </motion.button>

      {/* Dropdown */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 mt-3 w-80 bg-[#1a1e18]/90 border border-white/10 rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-xl"
        >
          <div className="flex flex-col space-y-3 text-[var(--text-bright)]">
            <h3 className="text-amber-200 font-semibold text-sm mb-1">
              Tips for {month} {selectedDate.getDate()}, {year}
            </h3>

            {/* 📅 Calendar Picker */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-2">
              <Calendar
                onChange={date => setSelectedDate(date as Date)}
                value={selectedDate}
                maxDate={new Date()} // optional: prevent future dates
                className="!bg-transparent !text-white !border-none [&_.react-calendar__tile]:!text-white [&_.react-calendar__tile--active]:!bg-lime-400/40 [&_.react-calendar__tile--now]:!bg-amber-400/30 [&_.react-calendar__tile--active]:!text-black"
              />
            </div>

            {/* 💵 Current Tips */}
            <div className="text-center py-2 rounded-lg bg-gradient-to-r from-lime-500/20 to-amber-400/20 border border-lime-300/20">
              <p className="text-xs text-gray-400">Current Total</p>
              <p className="text-2xl font-bold text-lime-300 drop-shadow-md">
                ${currentTips.toFixed(2)}
              </p>
            </div>

            {/* 💰 Input field */}
            <div>
              <label className="text-xs text-slate-400">Tip Amount ($)</label>
              <input
                type="number"
                value={tipAmount}
                onChange={e =>
                  setTipAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="Enter amount"
                className="bg-white/10 border border-white/10 text-white rounded-lg px-2 py-1 w-full text-sm"
              />
            </div>

            {/* ➕ Replace/Add Toggle */}
            <div className="relative flex bg-white/10 rounded-lg p-1 mt-3 text-xs font-semibold overflow-hidden border border-white/10">
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`absolute top-1 bottom-1 left-1 w-1/2 rounded-md ${
                  action === 'add'
                    ? 'translate-x-full bg-lime-400/30'
                    : 'translate-x-0 bg-amber-400/30'
                }`}
              />
              <button
                onClick={() => setAction('replace')}
                className={`flex-1 py-1 z-10 transition-colors ${
                  action === 'replace'
                    ? 'text-amber-100'
                    : 'text-white/70 hover:text-white/90'
                }`}
              >
                Replace
              </button>
              <button
                onClick={() => setAction('add')}
                className={`flex-1 py-1 z-10 transition-colors ${
                  action === 'add'
                    ? 'text-lime-100'
                    : 'text-white/70 hover:text-white/90'
                }`}
              >
                Add
              </button>
            </div>

            {/* 💾 Save Button */}
            <motion.button
              onClick={handleSaveTips}
              disabled={loading}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="mt-3 bg-gradient-to-r from-lime-400/40 to-amber-400/40 border border-white/10 text-white py-2 rounded-lg text-sm font-semibold hover:shadow-md transition-all disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save Tips'}
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
