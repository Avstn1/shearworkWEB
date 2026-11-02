'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { Upload, X } from 'lucide-react'

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
    <div className="flex flex-col gap-4">
      {/* Expense Input + Label + Toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={expenseAmount}
          onChange={e => {
            const value = e.target.value
            if (/^\d*\.?\d{0,2}$/.test(value)) setExpenseAmount(value)
          }}
          placeholder="Enter expense amount"
          className="field !w-auto min-w-[120px] flex-1 tabular-nums"
        />
        <input
          type="text"
          value={expenseLabel}
          onChange={e => setExpenseLabel(e.target.value)}
          placeholder="Label for expense"
          className="field !w-auto min-w-[120px] flex-1"
        />

        {/* Toggle Add / Replace */}
        <div className="segmented w-36">
          <button
            type="button"
            data-active={action === 'replace'}
            onClick={() => setAction('replace')}
            className="segmented-item"
          >
            Replace
          </button>
          <button
            type="button"
            data-active={action === 'add'}
            onClick={() => setAction('add')}
            className="segmented-item"
          >
            Add
          </button>
        </div>

        <button
          onClick={handleSaveExpense}
          disabled={loading}
          className="btn btn-primary btn-sm"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Live Totals */}
      {expenseAmount !== '' && (
        <p className="text-sm text-muted">
          New total:{' '}
          <span className="font-semibold tabular-nums text-ivory">
            ${newTotal.toFixed(2)}
          </span>
        </p>
      )}

      {/* Upload Receipt */}
      <label className="btn btn-glass btn-sm w-full cursor-pointer">
        <Upload size={16} strokeWidth={1.75} />
        Upload receipt
        <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      </label>

      {/* Upload Modal */}
      {uploadingFile && (
        <div className="modal-backdrop flex items-center justify-center p-4">
          <div className="modal-surface w-full max-w-md text-ivory">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
              <h2 className="text-[15px] font-semibold">Label your receipt</h2>
              <button onClick={handleUploadCancel} className="btn btn-ghost btn-sm !h-8 !px-2" aria-label="Close">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex flex-col gap-3 px-5 py-4">
              <p className="text-sm text-muted">Leave blank to default to today&apos;s date.</p>
              <input
                type="text"
                value={receiptLabel}
                onChange={e => setReceiptLabel(e.target.value)}
                placeholder="Enter receipt label"
                className="field"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
              <button onClick={handleUploadCancel} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button onClick={handleUploadConfirm} className="btn btn-primary btn-sm">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
