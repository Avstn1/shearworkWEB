'use client'

import { useState, ChangeEvent } from 'react'
import { Upload, X } from 'lucide-react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import { Segmented } from '@/components/ui/AppKit'

interface AdminRecurringExpensesProps {
  barberId: string
  month: string
  year: number
  onUpdate?: () => void
}

type Frequency = 'once' | 'weekly' | 'monthly' | 'yearly'

const FREQUENCIES: Array<{ value: Frequency; label: string }> = [
  { value: 'once', label: 'Once' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

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
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="panel-title">Add Recurring Expense</h3>
        <p className="panel-subtitle">One-off or repeating costs counted in your monthly totals.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="recurring-label" className="field-label">Label</label>
          <input
            id="recurring-label"
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Chair rent"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="recurring-amount" className="field-label">Amount</label>
          <input
            id="recurring-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => {
              const v = e.target.value
              if (/^\d*\.?\d{0,2}$/.test(v)) setAmount(v)
            }}
            placeholder="0.00"
            className="field tabular-nums"
          />
        </div>
      </div>

      {/* Frequency */}
      <div>
        <span className="field-label">Frequency</span>
        <Segmented<Frequency>
          className="w-full sm:w-auto"
          options={FREQUENCIES}
          value={frequency}
          onChange={setFrequency}
        />
      </div>

      {/* Recurrence Options */}
      {frequency === 'weekly' && (
        <div>
          <span className="field-label">Days</span>
          <div className="flex flex-wrap gap-1">
            {DAYS.map(d => (
              <button
                key={d}
                type="button"
                aria-pressed={selectedDays.includes(d)}
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
        </div>
      )}

      {frequency === 'monthly' && (
        <div>
          <label htmlFor="recurring-monthly-day" className="field-label">Day of month</label>
          <input
            id="recurring-monthly-day"
            type="number"
            min={1}
            max={31}
            value={monthlyDay}
            onChange={e => setMonthlyDay(parseInt(e.target.value))}
            className="field !w-24 tabular-nums"
          />
        </div>
      )}

      {frequency === 'yearly' && (
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor="recurring-yearly-month" className="field-label">Month</label>
            <select
              id="recurring-yearly-month"
              value={yearlyMonth}
              onChange={e => setYearlyMonth(parseInt(e.target.value))}
              className="field !w-24"
            >
              {Array.from({ length: 12 }, (_, i) => i).map(i => (
                <option key={i} value={i}>{i + 1}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="recurring-yearly-day" className="field-label">Day</label>
            <input
              id="recurring-yearly-day"
              type="number"
              min={1}
              max={31}
              value={yearlyDay}
              onChange={e => setYearlyDay(parseInt(e.target.value))}
              className="field !w-24 tabular-nums"
            />
          </div>
        </div>
      )}

      {/* Start / End Dates */}
      <div className="grid gap-3 sm:grid-cols-2">
        {frequency === 'once' ? (
          <div>
            <label htmlFor="recurring-date" className="field-label">Date</label>
            <input
              id="recurring-date"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="field"
            />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="recurring-start" className="field-label">Start date</label>
              <input
                id="recurring-start"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="field"
              />
            </div>
            <div>
              <label htmlFor="recurring-end" className="field-label">End date (optional)</label>
              <input
                id="recurring-end"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="field"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-1 sm:flex-row">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="btn btn-primary btn-sm flex-1"
        >
          {loading ? 'Saving...' : 'Add Recurring Expense'}
        </button>

        <label className="btn btn-glass btn-sm flex-1 cursor-pointer">
          <Upload size={16} strokeWidth={1.75} />
          Upload Receipt
          <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
        </label>
      </div>

      {/* Upload Modal */}
      {uploadingFile && (
        <div className="modal-backdrop flex items-center justify-center p-4" onClick={handleUploadCancel}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-label-title"
            className="modal-surface w-full max-w-md text-ivory"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
              <h2 id="receipt-label-title" className="text-[15px] font-semibold">Label your receipt</h2>
              <button type="button" onClick={handleUploadCancel} className="btn btn-ghost btn-sm !h-8 !px-2" aria-label="Close">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="px-5 py-4">
              <label htmlFor="receipt-label" className="field-label">Receipt label</label>
              <input
                id="receipt-label"
                type="text"
                value={receiptLabel}
                onChange={e => setReceiptLabel(e.target.value)}
                placeholder="e.g. Clipper blades"
                className="field"
                autoFocus
              />
              <p className="mt-2 text-xs text-muted">Leave blank to use today&apos;s date.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-3">
              <button type="button" onClick={handleUploadCancel} className="btn btn-ghost btn-sm">
                Cancel
              </button>
              <button type="button" onClick={handleUploadConfirm} className="btn btn-primary btn-sm">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
