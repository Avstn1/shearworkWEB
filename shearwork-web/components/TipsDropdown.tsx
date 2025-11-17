'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
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

  const currentDate = selectedDate ?? new Date()

  const dateStr = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1
  ).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`

  const month = currentDate.toLocaleString('default', { month: 'long' })
  const year = currentDate.getFullYear()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!barberId || !isOpen) return

    const fetchTips = async () => {
      try {
        const { data, error } = await supabase
          .from('daily_data')
          .select('tips')
          .eq('user_id', barberId)
          .eq('date', dateStr)
          .maybeSingle()

        if (error) throw error
        setCurrentTips(data?.tips ?? 0)
      } catch (err) {
        console.error(err)
        toast.error('Failed to load tips for that date.')
      }
    }

    fetchTips()
  }, [barberId, dateStr, isOpen])

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
          final_revenue: 0,
        },
        { onConflict: 'user_id,date' }
      )

      if (error) throw error

      setCurrentTips(newTotal)
      toast.success(
        `Tips for ${month} ${currentDate.getDate()} ${
          action === 'add' ? 'updated' : 'saved'
        }!`
      )


      const { error: insertError } = await supabase
        .from('system_logs')
        .insert({
            source: barberId,
            action: 'add_tips',
            status: 'success',
            details: `Tips added`,
        })

      if (insertError) throw insertError
      
      setIsOpen(false)
      setTipAmount('')
      onRefresh?.()
    } catch (err) {
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
        className="
          absolute left-0 mt-3 
          w-[20rem] sm:w-[22.5rem] md:w-[25rem] lg:w-[23rem] 
          bg-[#1a1e18]/90 border border-white/10 
          rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-xl
        "
      >
      <div className="flex flex-col space-y-2 text-[var(--text-bright)]">
        {/* Dropdown title */}
        <h3 className="text-amber-200 font-semibold text-xs mb-1">
          Tips for {month} {currentDate.getDate()}, {year}
        </h3>

        {/* Calendar Picker */}
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={date => setSelectedDate(date ?? new Date())}
          disabled={{ after: new Date(new Date().setHours(23, 59, 59, 999)) }}
          weekStartsOn={1}
          showOutsideDays
          modifiersClassNames={{
            today: 'rdp-day_today-custom'
          }}
          modifiersStyles={{
            selected: {
              color: '#bef264',
              fontWeight: 'bold',
              background: 'transparent'
            }
          }}
          className="
            bg-transparent text-xs
            [&_.rdp-day]:text-white [&_.rdp-day]:px-0.5 [&_.rdp-day]:py-0.25 [&_.rdp-day]:min-w-[1.5rem] [&_.rdp-day]:min-h-[1.5rem]
            [&_.rdp-day--outside]:text-gray-500 [&_.rdp-day--outside]:opacity-50
            [&_.rdp-day_today-custom]:!bg-lime-400/20 [&_.rdp-day_today-custom]:!text-lime-400 [&_.rdp-day_today-custom]:!font-bold [&_.rdp-day_today-custom]:!ring-2 [&_.rdp-day_today-custom]:!ring-lime-400 [&_.rdp-day_today-custom]:!rounded-full
            [&_.rdp-day--disabled]:!text-gray-800 [&_.rdp-day--disabled]:!bg-[#101210] [&_.rdp-day--disabled]:!cursor-not-allowed [&_.rdp-day--disabled]:!opacity-100
            [&_.rdp-day--weekend]:text-white
            [&_.rdp-caption]:text-white [&_.rdp-caption]:font-semibold
            [&_.rdp-nav-button]:bg-transparent [&_.rdp-nav-button]:hover:bg-white/10 [&_.rdp-nav-button]:text-white [&_.rdp-nav-button]:p-1 [&_.rdp-nav-button]:rounded-full
            [&_.rdp-nav-icon]:stroke-white
            [&_.rdp-day:hover]:bg-white/10
          "
          styles={{
            root: { '--rdp-accent-color': 'transparent' },
          }}
        />

            {/* Current Tips */}
            <div className="text-center py-2 rounded-lg bg-gradient-to-r from-lime-500/20 to-amber-400/20 border border-lime-300/20">
              <p className="text-xs text-gray-400">Current Total</p>
              <p className="text-2xl font-bold text-lime-300 drop-shadow-md">
                ${currentTips.toFixed(2)}
              </p>
            </div>

            {/* Input field */}
            <div>
              <label className="text-xs text-slate-400">Tip Amount ($)</label>
              <input
                type="number"
                value={tipAmount}
                onChange={e => setTipAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Enter amount"
                className="bg-white/10 border border-white/10 text-white rounded-lg px-2 py-1 w-full text-sm"
              />
            </div>

            {/* Replace/Add Toggle */}
            <div className="relative flex bg-white/10 rounded-lg p-1 mt-3 text-xs font-semibold overflow-hidden border border-white/10">
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`absolute top-1 bottom-1 left-1 w-1/2 rounded-md ${
                  action === 'add' ? 'translate-x-full bg-lime-400/30' : 'translate-x-0 bg-amber-400/30'
                }`}
              />
              <button
                onClick={() => setAction('replace')}
                className={`flex-1 py-1 z-10 transition-colors ${
                  action === 'replace' ? 'text-amber-100' : 'text-white/70 hover:text-white/90'
                }`}
              >
                Replace
              </button>
              <button
                onClick={() => setAction('add')}
                className={`flex-1 py-1 z-10 transition-colors ${
                  action === 'add' ? 'text-lime-100' : 'text-white/70 hover:text-white/90'
                }`}
              >
                Add
              </button>
            </div>

            {/* Save Button */}
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
