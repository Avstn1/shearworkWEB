'use client'

import React, { useEffect, useState } from 'react'
import ReportModal from './ReportModal'
import { supabase } from '@/utils/supabaseClient'

type WeeklyReport = {
  id: string
  month: string
  week_number: number
  title: string
  content: string
  year?: number
}

interface WeeklyReportsProps {
  userId: string
  refresh?: number
  filterMonth?: string
}

export default function WeeklyReports({ userId, refresh, filterMonth }: WeeklyReportsProps) {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null)

  const fetchWeeklyReports = async () => {
    if (!userId) return

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'weekly')
      .order('week_number', { ascending: true })

    if (error) {
      console.error('Error fetching weekly reports:', error)
      return
    }

    const weekly = data.map((r: any) => ({
      id: r.id,
      month: r.month,
      week_number: r.week_number,
      title: r.title,
      content: r.content,
      year: r.year,
    }))

    setReports(weekly)
  }

  useEffect(() => {
    fetchWeeklyReports()
  }, [userId, refresh])

  // Filter by selected month if provided
  const filteredReports = filterMonth ? reports.filter((r) => r.month === filterMonth) : reports

  return (
    <>
      <div className="flex flex-col gap-4"> {/* increased gap for spacing */}
        {filteredReports.length > 0 ? (
          filteredReports.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedReport(r)}
              className="bg-[#708B64] text-[#1f1f1a] p-4 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer"
            >
              <p className="font-semibold">{`Week ${r.week_number}`}</p>
              <p className="text-sm text-[var(--text-subtle)]">Click to view full report</p>
            </div>
          ))
        ) : (
          <div className="text-[#bdbdbd] text-sm mt-2">
            No weekly reports for this month.
          </div>
        )}
      </div>

      {selectedReport && (
        <ReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
      )}
    </>
  )
}
