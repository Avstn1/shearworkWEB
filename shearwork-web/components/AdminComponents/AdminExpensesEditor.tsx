'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

interface AdminExpensesEditorProps {
  barberId: string
  month: string
  year: number
  onUpdate?: () => void
}

export default function AdminExpensesEditor({ barberId, month, year, onUpdate }: AdminExpensesEditorProps) {
  const [expenseAmount, setExpenseAmount] = useState<string>('')
  const [expenseLabel, setExpenseLabel] = useState<string>('') // new label for one-time expense
  const [action, setAction] = useState<'add' | 'replace'>('add')
  const [loading, setLoading] = useState(false)
  const [currentTotal, setCurrentTotal] = useState<number>(0)
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [receiptLabel, setReceiptLabel] = useState<string>('')

  // Fetch current total for display purposes only
  useEffect(() => {
    const fetchCurrentTotal = async () => {
      if (!barberId) return
      const { data, error } = await supabase
        .from('monthly_data')
        .select('expenses')
        .eq('user_id', barberId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()
      if (!error) setCurrentTotal(data?.expenses || 0)
    }
    fetchCurrentTotal()
  }, [barberId, month, year])

  // Compute what the new total would be locally (for display)
  const newTotal =
    expenseAmount === ''
      ? currentTotal
      : action === 'add'
      ? currentTotal + parseFloat(expenseAmount)
      : parseFloat(expenseAmount)

  // Save one-time expense
  const handleSaveExpense = async () => {
    if (!expenseAmount.trim()) return toast.error('Enter an expense amount')
    if (!expenseLabel.trim()) return toast.error('Enter a label for this expense')

    setLoading(true)
    try {
      // Only insert into one_time_expenses
      const { error: insertError } = await supabase.from('one_time_expenses').insert({
        user_id: barberId, // must exist in profiles table
        month,
        year,
        label: expenseLabel.trim(),
        amount: parseFloat(expenseAmount),
        created_at: new Date().toISOString()
      })
      if (insertError) throw insertError

      toast.success('Expense added!')
      setExpenseAmount('')
      setExpenseLabel('')
      onUpdate?.()
    } catch (err) {
      console.error(err)
      toast.error('Failed to save expense')
    }
    setLoading(false)
  }

  // File upload handlers
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    setUploadingFile(e.target.files[0])
    setReceiptLabel('')
  }

  const handleUploadConfirm = async () => {
    if (!uploadingFile) return
    const fileName = `${barberId}/${year}-${month}-${Date.now()}-${uploadingFile.name}`
    const label = receiptLabel.trim() || new Date().toLocaleDateString()
    try {
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, uploadingFile)
      if (uploadError) throw uploadError
      const { error: dbError } = await supabase.from('monthly_receipts').insert({
        user_id: barberId,
        month,
        year,
        image_url: fileName,
        label,
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
    <div className="flex flex-col gap-5">
      {/* Expense Input + Label + Toggle */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          inputMode="decimal"
          value={expenseAmount}
          onChange={e => {
            const value = e.target.value
            if (/^\d*\.?\d{0,2}$/.test(value)) setExpenseAmount(value)
          }}
          placeholder="Enter expense amount"
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 text-white border border-white/10 
                     focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all min-w-[120px]"
        />
        <input
          type="text"
          value={expenseLabel}
          onChange={e => setExpenseLabel(e.target.value)}
          placeholder="Label for expense"
          className="flex-1 px-3 py-2 rounded-lg bg-white/10 text-white border border-white/10 
                     focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all min-w-[120px]"
        />

        {/* Toggle Add / Replace */}
        <div className="relative flex bg-white/10 rounded-lg p-1 text-xs font-semibold overflow-hidden border border-white/10 w-32">
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

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSaveExpense}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-lime-400/40 to-amber-400/40 
                     text-white font-semibold hover:shadow-md transition-all"
        >
          {loading ? 'Saving...' : 'Save'}
        </motion.button>
      </div>

      {/* Live Totals */}
      <div className="text-white text-sm">
        {expenseAmount !== '' && (
          <p>
            New Total:{' '}
            <span className="text-amber-300 font-bold">
              ${newTotal.toFixed(2)}
            </span>
          </p>
        )}
      </div>

      {/* Upload Receipt */}
      <label className="w-full flex justify-center items-center px-4 py-2 bg-white/10 text-white rounded-lg cursor-pointer hover:bg-white/20 transition">
        Upload Receipt
        <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      </label>

      {/* Upload Modal */}
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
              className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 
                         focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all w-full"
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
