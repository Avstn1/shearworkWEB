'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

export default function DailyTipsDropdown({ barberId, onRefresh }: { barberId: string, onRefresh?: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const today = new Date()
  const [tipAmount, setTipAmount] = useState<number | ''>('')
  const [currentTips, setCurrentTips] = useState<number>(0)
  const [action, setAction] = useState<'replace' | 'add'>('add') // default = add
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const dateStr = today.toISOString().split('T')[0] // "YYYY-MM-DD"
  const month = today.toLocaleString('default', { month: 'long' })
  const year = today.getFullYear()

  // 🔹 Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 🔹 Fetch today's tips
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
        toast.error('Failed to load today’s tips.')
      } else {
        setCurrentTips(data?.tips || 0)
      }
    }
    fetchTips()
  }, [barberId, dateStr])

  async function handleSaveTips() {
    if (tipAmount === '') {
      toast.error('Please enter a tip amount.')
      return
    }

    try {
      setLoading(true)
      const newTotal =
        action === 'add'
          ? currentTips + Number(tipAmount)
          : Number(tipAmount)

      const { error } = await supabase
        .from('daily_data')
        .upsert(
          {
            user_id: barberId,
            date: dateStr,
            tips: newTotal,
            updated_at: new Date().toISOString(),
            year,
            month,
            final_revenue: 0, // will be auto-calculated by trigger
          },
          { onConflict: 'user_id,date' }
        )

      if (error) throw error

      setCurrentTips(newTotal)
      toast.success(`Today's tips ${action === 'add' ? 'updated' : 'saved'}!`)
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
        💰 Manage Today's Tips
      </motion.button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 mt-3 w-72 bg-[#1a1e18]/90 border border-white/10 rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-xl"
        >
          <div className="flex flex-col space-y-3 text-[var(--text-bright)]">
            <h3 className="text-amber-200 font-semibold text-sm mb-1">
              Tips for {month} {today.getDate()}, {year}
            </h3>

            <div className="text-center py-2 rounded-lg bg-gradient-to-r from-lime-500/20 to-amber-400/20 border border-lime-300/20">
              <p className="text-xs text-gray-400">Current Total</p>
              <p className="text-2xl font-bold text-lime-300 drop-shadow-md">
                ${currentTips.toFixed(2)}
              </p>
            </div>

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

            <motion.button
              onClick={handleSaveTips}
              disabled={loading}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="mt-3 bg-gradient-to-r from-lime-400/40 to-amber-400/40 border border-white/10 text-white py-2 rounded-lg text-sm font-semibold hover:shadow-md transition-all"
            >
              {loading ? 'Saving...' : 'Save Tips'}
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
