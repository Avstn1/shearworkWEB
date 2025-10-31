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
  const [revenue, setRevenue] = useState<number>(0)
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

        if (exists) setRevenue(reports![0].total_revenue ?? 0)
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

    const { error } = await supabase
      .from('reports')
      .update({ total_revenue: revenue })
      .eq('user_id', barberId)
      .eq('type', 'monthly')
      .eq('month', month)
      .eq('year', year)

    if (error) return toast.error('Failed to update revenue.')
    toast.success('Revenue updated successfully!')
  }

  if (loading) return <p>Loading revenue...</p>
  if (!monthlyReportExists) return null

  return (
    <div className="bg-[#1f1f1a] text-white rounded-xl p-4 shadow-md">
      <h3 className="text-lg font-semibold mb-2">Edit Monthly Revenue</h3>
      <input
        type="number"
        value={revenue}
        onChange={(e) => setRevenue(Number(e.target.value))}
        className="w-full bg-[#2f3a2d] text-[#F1F5E9] border border-[#55694b] rounded-md p-2 mb-3"
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
