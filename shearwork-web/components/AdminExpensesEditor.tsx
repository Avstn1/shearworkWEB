'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface AdminExpensesEditorProps {
  barberId: string
  month: string
  year: number
  onUpdate?: () => void
}

export default function AdminExpensesEditor({ barberId, month, year, onUpdate }: AdminExpensesEditorProps) {
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('')
  const [action, setAction] = useState<'add' | 'replace'>('add')
  const [loading, setLoading] = useState(false)
  const [currentTotal, setCurrentTotal] = useState<number>(0)

  const [uploadingFile, setUploadingFile] = useState<File | null>(null)
  const [receiptLabel, setReceiptLabel] = useState<string>('')

  // Fetch current total
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

  // Live total
  const newTotal = expenseAmount === '' ? currentTotal :
    action === 'add' ? currentTotal + Number(expenseAmount) :
    Number(expenseAmount)

  // Save expense
  const handleSaveExpense = async () => {
    if (expenseAmount === '') return toast.error('Enter an expense amount')
    setLoading(true)
    try {
      const { error } = await supabase.from('monthly_data').upsert(
        {
          user_id: barberId,
          month,
          year,
          expenses: newTotal,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,month,year' }
      )
      if (error) throw error
      toast.success(`Expenses ${action === 'add' ? 'updated' : 'saved'}!`)
      setCurrentTotal(newTotal)
      setExpenseAmount('')
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error(err)
      toast.error('Failed to save expenses')
    }
    setLoading(false)
  }

  // Handle initial file selection
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const file = e.target.files[0]
    setUploadingFile(file)
    setReceiptLabel('') // reset label
  }

  // Confirm upload
  const handleUploadConfirm = async () => {
    if (!uploadingFile) return
    const fileName = `${barberId}/${year}-${month}-${Date.now()}-${uploadingFile.name}`
    const label = receiptLabel.trim() || new Date().toLocaleDateString()

    try {
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, uploadingFile)
      if (uploadError) throw uploadError

      // Insert DB record with label
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
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('[UPLOAD] Failed to upload receipt:', err)
      toast.error('Failed to upload receipt')
    }
  }

  // Cancel upload
  const handleUploadCancel = () => {
    setUploadingFile(null)
    setReceiptLabel('')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Input + Actions */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="number"
          value={expenseAmount}
          onChange={e => setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Enter expense amount"
          className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all flex-1"
        />
        <button
          onClick={() => setAction('replace')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            action === 'replace' ? 'bg-amber-400/30 text-amber-100 border border-amber-300/30' : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          Replace
        </button>
        <button
          onClick={() => setAction('add')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
            action === 'add' ? 'bg-lime-400/30 text-lime-100 border border-lime-300/30' : 'bg-white/10 text-white/70 hover:bg-white/20'
          }`}
        >
          Add
        </button>
        <button
          onClick={handleSaveExpense}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-lime-400/40 to-amber-400/40 text-white font-semibold hover:shadow-md transition-all"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Live Preview */}
      <p className="text-white text-sm">
        Current Total: <span className="text-lime-300 font-bold">${currentTotal.toFixed(2)}</span><br />
        {expenseAmount !== '' && <>New Total: <span className="text-amber-300 font-bold">${newTotal.toFixed(2)}</span></>}
      </p>

      {/* Upload Receipt */}
      <label className="w-full flex justify-center items-center px-4 py-2 bg-white/10 text-white rounded-lg cursor-pointer hover:bg-white/20 transition">
        Upload Receipt
        <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      </label>

      {/* Label Modal */}
      {uploadingFile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-lg p-6 w-[90%] max-w-md text-white flex flex-col gap-4">
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
