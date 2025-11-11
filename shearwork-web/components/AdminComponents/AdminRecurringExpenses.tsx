'use client'

import { useState, ChangeEvent } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface AdminRecurringExpensesProps {
  barberId: string
  month: string
  year: number
  onUpdate?: () => void
}

type Frequency = 'once' | 'weekly' | 'monthly' | 'yearly'

export default function AdminRecurringExpenses({ barberId, month, year, onUpdate }: AdminRecurringExpensesProps) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState<string>('')
  const [frequency, setFrequency] = useState<Frequency>('once')
  const [selectedDays, setSelectedDays] = useState<string[]>([]) // for weekly
  const [monthlyDay, setMonthlyDay] = useState<number>(1)
  const [yearlyMonth, setYearlyMonth] = useState<number>(0)
  const [yearlyDay, setYearlyDay] = useState<number>(1)
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // Receipt upload
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [receiptLabel, setReceiptLabel] = useState<string>('')

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const handleDayToggle = (day: string) => {
    setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const handleSave = async () => {
    // Validation
    if (!label.trim()) return toast.error('Enter a label')
    if (!amount || isNaN(parseFloat(amount))) return toast.error('Enter a valid amount')
    if (frequency === 'monthly' && (monthlyDay < 1 || monthlyDay > 31)) return toast.error('Monthly day must be 1–31')
    if (frequency === 'yearly' && (yearlyDay < 1 || yearlyDay > 31)) return toast.error('Yearly day must be 1–31')

    const payload = {
      user_id: barberId,
      label: label.trim(),
      amount: parseFloat(amount),
      frequency,
      start_date: startDate,
      end_date: endDate || null,
      weekly_days: frequency === 'weekly' ? selectedDays : null,
      monthly_day: frequency === 'monthly' ? monthlyDay : null,
      yearly_month: frequency === 'yearly' ? yearlyMonth : null,
      yearly_day: frequency === 'yearly' ? yearlyDay : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setLoading(true)
    try {
      const { error } = await supabase.from('recurring_expenses').insert(payload)
      if (error) throw error
      toast.success('Recurring expense added!')

      // Reset form
      setLabel('')
      setAmount('')
      setFrequency('once')
      setSelectedDays([])
      setMonthlyDay(1)
      setYearlyMonth(0)
      setYearlyDay(1)
      setStartDate(new Date().toISOString().slice(0, 10))
      setEndDate('')
      onUpdate?.()
    } catch (err) {
      console.error(err)
      toast.error('Failed to add recurring expense')
    }
    setLoading(false)
  }

  // Receipt upload handlers
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    setUploadingFile(e.target.files[0])
    setReceiptLabel('')
  }

  const handleUploadConfirm = async () => {
    if (!uploadingFile) return
    const fileName = `${barberId}/${year}-${month}-${Date.now()}-${uploadingFile.name}`
    const labelText = receiptLabel.trim() || new Date().toLocaleDateString()
    try {
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, uploadingFile)
      if (uploadError) throw uploadError
      const { error: dbError } = await supabase.from('monthly_receipts').insert({
        user_id: barberId,
        month,
        year,
        image_url: fileName,
        label: labelText,
      })
      if (dbError) throw dbError
      toast.success('Receipt uploaded!')
      setUploadingFile(null)
      setReceiptLabel('')
      onUpdate?.()
    } catch (err) {
      console.error('[UPLOAD] Failed to upload receipt:', err)
      toast.error('Failed to upload receipt')
    }
  }

  const handleUploadCancel = () => {
    setUploadingFile(null)
    setReceiptLabel('')
  }

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 flex flex-col gap-5">
      <h3 className="font-semibold text-lg text-white mb-2">Add Recurring Expense</h3>

      <input
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Expense label"
        className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/10 w-full focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
      />

      <input
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={e => {
          const v = e.target.value
          if (/^\d*\.?\d{0,2}$/.test(v)) setAmount(v)
        }}
        placeholder="Amount"
        className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/10 w-full focus:outline-none focus:ring-2 focus:ring-lime-400 transition"
      />

      {/* Frequency */}
      <div className="flex flex-wrap gap-2 items-center">
        {['once', 'weekly', 'monthly', 'yearly'].map(freq => (
          <button
            key={freq}
            onClick={() => setFrequency(freq as Frequency)}
            className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${
              frequency === freq
                ? 'bg-lime-400/30 text-lime-100'
                : 'bg-white/10 text-white/70 hover:text-white/90'
            }`}
          >
            {freq.charAt(0).toUpperCase() + freq.slice(1)}
          </button>
        ))}
      </div>

      {/* Recurrence Options */}
      {frequency === 'weekly' && (
        <div className="flex gap-1 flex-wrap mt-1">
          {DAYS.map(d => (
            <button
              key={d}
              onClick={() => handleDayToggle(d)}
              className={`px-2 py-1 rounded-md text-xs font-semibold transition ${
                selectedDays.includes(d)
                  ? 'bg-lime-400/40 text-lime-100'
                  : 'bg-white/10 text-white/70 hover:text-white/90'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {frequency === 'monthly' && (
        <div className="flex gap-2 mt-1 items-center">
          <label className="text-white text-sm">Day of month:</label>
          <input
            type="number"
            min={1}
            max={31}
            value={monthlyDay}
            onChange={e => setMonthlyDay(parseInt(e.target.value))}
            className="w-16 px-2 py-1 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
          />
        </div>
      )}

      {frequency === 'yearly' && (
        <div className="flex gap-2 mt-1 flex-wrap items-center">
          <label className="text-white text-sm">Month:</label>
          <select
            value={yearlyMonth}
            onChange={e => setYearlyMonth(parseInt(e.target.value))}
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
            value={yearlyDay}
            onChange={e => setYearlyDay(parseInt(e.target.value))}
            className="w-16 px-2 py-1 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
          />
        </div>
      )}

      {/* Start / End Dates */}
      <div className="flex gap-2 flex-wrap mt-1 items-center">
        <label className="text-white text-sm">Start:</label>
        <input
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          className="px-2 py-1 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-400 transition"
        />
        <label className="text-white text-sm">End (optional):</label>
        <input
          type="date"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          className="px-2 py-1 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-lime-400 transition"
        />
      </div>

      {/* Save Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSave}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-gradient-to-r from-lime-400/40 to-amber-400/40 text-white font-semibold hover:shadow-md transition-all mt-2"
      >
        {loading ? 'Saving...' : 'Add Recurring Expense'}
      </motion.button>

      {/* Upload Receipt */}
      <label className="w-full flex justify-center items-center px-4 py-2 bg-white/10 text-white rounded-lg cursor-pointer hover:bg-white/20 transition">
        Upload Receipt
        <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      </label>

      {uploadingFile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-6 w-[90%] max-w-md text-white flex flex-col gap-4 border border-white/10 shadow-xl">
            <h2 className="text-lg font-semibold">Label your receipt</h2>
            <p className="text-sm text-gray-400">Leave blank to default to today's date.</p>
            <input
              type="text"
              value={receiptLabel}
              onChange={e => setReceiptLabel(e.target.value)}
              placeholder="Enter receipt label"
              className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all w-full"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={handleUploadCancel}
                className="px-4 py-2 rounded-lg bg-red-600/70 hover:bg-red-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadConfirm}
                className="px-4 py-2 rounded-lg bg-green-600/70 hover:bg-green-600 transition"
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
