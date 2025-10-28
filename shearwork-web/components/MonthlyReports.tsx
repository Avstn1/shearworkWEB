'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { MoreVertical, Edit, Trash2 } from 'lucide-react'
import ReportModal from './ReportModal'
import toast from 'react-hot-toast'

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
  isAdmin?: boolean
}

export default function MonthlyReports({
  userId,
  refresh,
  filterMonth,
  isAdmin = false,
}: MonthlyReportsProps) {
  const [reports, setReports] = useState<MonthlyReport[]>([])
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const fetchMonthlyReports = async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'monthly')
      .order('created_at', { ascending: false })

    if (error) return console.error('Error fetching monthly reports:', error)

    setReports(
      (data || []).map((r: any) => ({
        id: r.id,
        month: r.month,
        total_cuts: Number(r.total_cuts) || 0,
        total_revenue: Number(r.total_revenue) || 0,
        chair_rent_paid: r.chair_rent_paid,
        notes: r.notes || '',
        content: r.content || '',
        year: r.year,
      }))
    )
  }

  useEffect(() => { fetchMonthlyReports() }, [userId, refresh])

  const filteredReports = filterMonth
    ? reports.filter((r) => r.month === filterMonth)
    : reports

  const handleEdit = (report: MonthlyReport) => {
    setSelectedReport(report)
    setIsEditing(true)
    setMenuOpenId(null)
  }

  const handleSave = async (updatedContent: string) => {
    if (!selectedReport) return
    const { error } = await supabase
      .from('reports')
      .update({ content: updatedContent })
      .eq('id', selectedReport.id)

    if (error) {
      toast.error('Failed to save report.')
      return
    }

    setReports((prev) =>
      prev.map((r) =>
        r.id === selectedReport.id ? { ...r, content: updatedContent } : r
      )
    )
    toast.success('✅ Report updated!')
    setIsEditing(false)
    setSelectedReport(null)
  }

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return
    const { error } = await supabase.from('reports').delete().eq('id', reportId)
    if (error) {
      toast.error('Failed to delete report.')
      return
    }
    setReports((prev) => prev.filter((r) => r.id !== reportId))
    setMenuOpenId(null)
    toast.success('🗑 Report deleted')
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      <div className="flex flex-col gap-4">
        {filteredReports.length > 0 ? (
          filteredReports.map((r) => (
            <div
              key={r.id}
              className="relative bg-[#708B64] text-[#1f1f1a] p-4 rounded-lg shadow-sm hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div
                  onClick={() => {
                    setSelectedReport(r)
                    setIsEditing(false)
                  }}
                  className="cursor-pointer flex-1"
                >
                  <p className="font-semibold">{r.month} {r.year || ''}</p>

                  {/* Rich-text preview */}
                  <div className="text-sm text-[var(--text-subtle)] max-h-12 overflow-hidden relative">
                    <div
                      className="prose prose-sm"
                      dangerouslySetInnerHTML={{
                        __html: r.content
                          ? r.content.length > 100
                            ? r.content.slice(0, 100) + '...'
                            : r.content
                          : 'No content available.',
                      }}
                    />
                    <div className="absolute bottom-0 left-0 w-full h-4 bg-gradient-to-t from-[#708B64] to-transparent" />
                  </div>
                </div>

                {isAdmin && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === r.id ? null : r.id)}
                      className="p-1 hover:bg-[#5e7256] rounded-md"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {menuOpenId === r.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 mt-1 bg-[#5e7256] text-white rounded-md shadow-lg z-10 w-28"
                      >
                        <button
                          onClick={() => handleEdit(r)}
                          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[#4e614b] text-sm"
                        >
                          <Edit size={14} /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[#4e614b] text-sm text-red-200"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-[#bdbdbd] text-sm mt-2">
            No monthly reports for this month.
          </div>
        )}
      </div>

      {selectedReport && (
        <ReportModal
          report={selectedReport}
          onClose={() => {
            setSelectedReport(null)
            setIsEditing(false)
          }}
          isEditing={isEditing && isAdmin}
          isAdmin={isAdmin}
          onSave={handleSave}
        />
      )}
    </>
  )
}
