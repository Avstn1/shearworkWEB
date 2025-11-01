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
          .from('reports')
          .select('id, total_revenue')
          .eq('user_id', barberId)
          .eq('type', 'monthly')
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
    if (!monthlyReportExists) return toast.error('No monthly report exists for this month.')

    const num = revenue === '' ? 0 : Number(revenue)

    const { error } = await supabase
      .from('reports')
      .update({ total_revenue: num })
      .eq('user_id', barberId)
      .eq('type', 'monthly')
      .eq('month', month)
      .eq('year', year)

    if (error) return toast.error('Failed to update revenue.')
    toast.success('Revenue updated successfully!')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow empty string or digits only
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setRevenue(value)
    }
  }

  if (loading) return <p>Loading revenue...</p>

  return (
    <div className="bg-[#1f1f1a] text-white rounded-xl p-4 shadow-md">
      <h3 className="text-lg font-semibold mb-2">Edit Monthly Revenue</h3>
      <input
        type="text" // ← text instead of number
        inputMode="decimal" // shows numeric keyboard on mobile
        value={revenue}
        onChange={handleChange}
        placeholder="Enter revenue..."
        className="w-full bg-[#2f3a2d] text-[#F1F5E9] border border-[#55694b] rounded-md p-2 mb-3 appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        onClick={handleUpdate}
        className="bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] px-4 py-2 rounded-md text-sm font-semibold"
      >
        Update Revenue
      </button>
    </div>
  )
}
