'use client'

import React, { useEffect, useState } from 'react'
import ReportModal from './ReportModal'
import { supabase } from '@/utils/supabaseClient'

type MonthlyReport = {
  id: string
  month: string
  total_cuts: number
  total_revenue: number
  chair_rent_paid: boolean
  notes: string
  content: string
  year?: number
}

interface MonthlyReportsProps {
  userId: string
  refresh?: number
  filterMonth?: string
}

export default function MonthlyReports({ userId, refresh, filterMonth }: MonthlyReportsProps) {
  const [reports, setReports] = useState<MonthlyReport[]>([])
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null)

  const fetchMonthlyReports = async () => {
    if (!userId) return

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'monthly')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching monthly reports:', error)
      return
    }

    const monthly = data.map((r: any) => ({
      id: r.id,
      month: r.month,
      total_cuts: Number(r.total_cuts) || 0,
      total_revenue: Number(r.total_revenue) || 0,
      chair_rent_paid: r.chair_rent_paid,
      notes: r.notes || '',
      content: r.content || '', // ensure content is included
      year: r.year,
    }))

    setReports(monthly)
  }

  useEffect(() => {
    fetchMonthlyReports()
  }, [userId, refresh])

  const filteredReports = filterMonth ? reports.filter((r) => r.month === filterMonth) : reports

  return (
    <>
      <div className="flex flex-col gap-4">
        {filteredReports.length > 0 ? (
          filteredReports.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedReport(r)}
              className="bg-[#708B64] text-[#1f1f1a] p-4 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <p className="font-semibold">{r.month} {r.year || ''}</p>
              <p className="text-sm text-[var(--text-subtle)]">Click to view full report</p>
            </div>
          ))
        ) : (
          <div className="text-[#bdbdbd] text-sm mt-2">
            No monthly reports for this month.
          </div>
        )}
      </div>

      {selectedReport && (
        <ReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </>
  )
}
