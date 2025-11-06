'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function TipsDropdown({ barberId }: { barberId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [month, setMonth] = useState<string>(MONTHS[new Date().getMonth()])
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [tipAmount, setTipAmount] = useState<number | ''>('')
  const [currentTips, setCurrentTips] = useState<number>(0)
  const [action, setAction] = useState<'replace' | 'add'>('add') // 🟢 default to ADD
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i)

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

  // 🔹 Fetch existing tips
  useEffect(() => {
    if (!barberId || !month || !year) return
    const fetchTips = async () => {
      const { data, error } = await supabase
        .from('monthly_data')
        .select('tips')
        .eq('user_id', barberId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()

      if (error) {
        console.error(error)
        toast.error('Failed to load tips data.')
      } else {
        setCurrentTips(data?.tips || 0)
      }
    }
    fetchTips()
  }, [barberId, month, year])

  async function handleSaveTips() {
    if (!month || !year || tipAmount === '') {
      toast.error('Please select month, year, and enter a tip amount.')
      return
    }

    try {
      setLoading(true)
      const newTotal =
        action === 'add'
          ? currentTips + Number(tipAmount)
          : Number(tipAmount)

      const { error } = await supabase
        .from('monthly_data')
        .upsert(
          {
            user_id: barberId,
            month,
            year,
            tips: newTotal,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,month,year' }
        )

      if (error) throw error

      setCurrentTips(newTotal)
      toast.success(`Tips for ${month} ${year} ${action === 'add' ? 'updated' : 'saved'}!`)
      setIsOpen(false)
      setTipAmount('')
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
        className="px-4 py-2 bg-gradient-to-r from-amber-400/30 to-lime-500/30 border border-white/10 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all backdrop-blur-md"
      >
        💰 Manage Tips
      </motion.button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute right-0 mt-3 w-72 bg-[#1a1e18]/90 border border-white/10 rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-xl"
        >
          <div className="flex flex-col space-y-3 text-[var(--text-bright)]">
            <h3 className="text-amber-200 font-semibold text-sm mb-1">
              Tips for {month} {year}
            </h3>

            {/* 🔹 Highlight current total */}
            <div className="text-center py-2 rounded-lg bg-gradient-to-r from-lime-500/20 to-amber-400/20 border border-lime-300/20">
              <p className="text-xs text-gray-400">Current Total</p>
              <p className="text-2xl font-bold text-lime-300 drop-shadow-md">
                ${currentTips.toFixed(2)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">Month</label>
                <select
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  className="bg-white/10 border border-white/10 text-white rounded-lg px-2 py-1 text-sm w-full"
                >
                  {MONTHS.map(m => (
                    <option className="bg-white/40 border border-white/10 text-black rounded-lg px-2 py-1 w-full text-sm" key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Year</label>
                <select
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  className="bg-white/10 border border-white/10 text-white rounded-lg px-2 py-1 text-sm w-full"
                >
                  {years.map(y => (
                    <option className="bg-white/40 border border-white/10 text-black rounded-lg px-2 py-1 w-full text-sm" key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
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

            {/* 🔹 Default = Add to Total */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setAction('replace')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  action === 'replace'
                    ? 'bg-amber-400/30 text-amber-100 border border-amber-300/30'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Replace Total
              </button>
              <button
                onClick={() => setAction('add')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  action === 'add'
                    ? 'bg-lime-400/40 text-lime-100 border border-lime-300/40 shadow-inner'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                Add to Total
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
