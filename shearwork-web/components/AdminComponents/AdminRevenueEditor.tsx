'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface AdminRevenueEditorProps {
  barberId: string
  month: string
  year: number
}

export default function AdminRevenueEditor({ barberId, month, year }: AdminRevenueEditorProps) {
  const [revenue, setRevenue] = useState<string>('') // ← store as string for empty support
  const [loading, setLoading] = useState(true)
  const [monthlyReportExists, setMonthlyReportExists] = useState<boolean>(false)

  useEffect(() => {
    async function loadRevenue() {
      try {
        const { data: reports, error } = await supabase
          .from('monthly_data')
          .select('id, total_revenue')
          .eq('user_id', barberId)
          .eq('month', month)
          .eq('year', year)
          .limit(1)

        if (error) throw error

        const exists = Array.isArray(reports) && reports.length > 0
        setMonthlyReportExists(exists)

        if (exists) setRevenue(reports![0].total_revenue?.toString() ?? '')
      } catch (err) {
        console.error(err)
        toast.error('Failed to load monthly revenue.')
      } finally {
        setLoading(false)
      }
    }

    if (barberId) loadRevenue()
  }, [barberId, month, year])

  const handleUpdate = async () => {
    const num = revenue === '' ? 0 : Number(revenue)

    const { error } = await supabase
      .from('monthly_data')
      .upsert(
        {
          user_id: barberId,
          month,
          year,
          total_revenue: num,
        },
        {
          onConflict: 'user_id,month,year', // important! match your unique constraint
        }
      )

    if (error) {
      console.error(error)
      return toast.error('Failed to save revenue.')
    }

    toast.success('Revenue saved successfully!')
    setMonthlyReportExists(true)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow empty string or digits only
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setRevenue(value)
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading revenue...</p>

  return (
    <section className="panel">
      <header className="panel-header">
        <div className="min-w-0">
          <h3 className="panel-title">Monthly revenue</h3>
          <p className="panel-subtitle">{month} {year}</p>
        </div>
      </header>
      <div className="panel-body flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:max-w-xs">
          <label className="field-label">Total revenue</label>
          <input
            type="text" // ← text instead of number
            inputMode="decimal" // shows numeric keyboard on mobile
            value={revenue}
            onChange={handleChange}
            placeholder="Enter revenue..."
            className="field tabular-nums appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        <button onClick={handleUpdate} className="btn btn-primary btn-sm">
          Update revenue
        </button>
      </div>
    </section>
  )
}
