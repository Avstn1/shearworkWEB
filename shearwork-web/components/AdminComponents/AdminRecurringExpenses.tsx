'use client'

import { useState, ChangeEvent } from 'react'
import { Upload, X } from 'lucide-react'
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
    if (frequency === 'monthly' && (monthlyDay < 1 || monthlyDay > 31)) return toast.error('Monthly day must be 1-31')
    if (frequency === 'yearly' && (yearlyDay < 1 || yearlyDay > 31)) return toast.error('Yearly day must be 1-31')
    if (frequency === 'weekly' && selectedDays.length === 0) return toast.error('Select at least one day')

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

      const { error: insertError } = await supabase
      .from('system_logs')
      .insert({
          source: barberId,
          action: 'expense_added',
          status: 'success',
          details: `Recurring expense added`,
      })

      if (insertError) throw insertError

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
    <section className="panel">
      <header className="panel-header">
        <h3 className="panel-title">Add recurring expense</h3>
      </header>
      <div className="panel-body flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label">Label</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="Expense label"
              className="field"
            />
          </div>
          <div>
            <label className="field-label">Amount</label>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => {
                const v = e.target.value
                if (/^\d*\.?\d{0,2}$/.test(v)) setAmount(v)
              }}
              placeholder="Amount"
              className="field tabular-nums"
            />
          </div>
        </div>

        {/* Frequency */}
        <div>
          <span className="field-label">Frequency</span>
          <div className="segmented">
            {['once', 'weekly', 'monthly', 'yearly'].map(freq => (
              <button
                key={freq}
                type="button"
                data-active={frequency === freq}
                onClick={() => setFrequency(freq as Frequency)}
                className="segmented-item"
              >
                {freq.charAt(0).toUpperCase() + freq.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Recurrence Options */}
        {frequency === 'weekly' && (
          <div className="flex flex-wrap gap-1">
            {DAYS.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => handleDayToggle(d)}
                className={`h-8 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                  selectedDays.includes(d)
                    ? 'border-sage/40 bg-sage/15 text-sage-bright'
                    : 'border-white/[0.07] text-muted hover:text-ivory'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {frequency === 'monthly' && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted">Day of month</label>
            <input
              type="number"
              min={1}
              max={31}
              value={monthlyDay}
              onChange={e => setMonthlyDay(parseInt(e.target.value))}
              className="field !w-20 tabular-nums"
            />
          </div>
        )}

        {frequency === 'yearly' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-muted">Month</label>
            <select
              value={yearlyMonth}
              onChange={e => setYearlyMonth(parseInt(e.target.value))}
              className="field !w-20"
            >
              {Array.from({ length: 12 }, (_, i) => i).map(i => (
                <option key={i} value={i}>{i + 1}</option>
              ))}
            </select>
            <label className="text-sm text-muted">Day</label>
            <input
              type="number"
              min={1}
              max={31}
              value={yearlyDay}
              onChange={e => setYearlyDay(parseInt(e.target.value))}
              className="field !w-20 tabular-nums"
            />
          </div>
        )}

        {/* Start / End Dates */}
        <div className="flex flex-wrap items-end gap-3">
          {frequency === 'once' ? (
            <div>
              <label className="field-label">Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="field !w-auto"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="field-label">Start</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="field !w-auto"
                />
              </div>
              <div>
                <label className="field-label">End (optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="field !w-auto"
                />
              </div>
            </>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn btn-primary btn-sm"
        >
          {loading ? 'Saving...' : 'Add recurring expense'}
        </button>

        {/* Upload Receipt */}
        <label className="btn btn-glass btn-sm w-full cursor-pointer">
          <Upload size={16} strokeWidth={1.75} />
          Upload receipt
          <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
        </label>
      </div>

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
    </section>
  )
}
