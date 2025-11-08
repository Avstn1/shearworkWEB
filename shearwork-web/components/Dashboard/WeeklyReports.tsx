'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { MoreVertical, FileText } from 'lucide-react'
import ReportModal from './ReportModal'
import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'

type WeeklyReport = {
  id: string
  month: string
  week_number: number
  title?: string
  content: string
  year: number
}

interface WeeklyReportsProps {
  userId: string
  refresh?: number
  filterMonth?: string
  filterYear?: number | null
  isAdmin?: boolean
}

export default function WeeklyReports({
  userId,
  refresh,
  filterMonth,
  filterYear,
  isAdmin = false,
}: WeeklyReportsProps) {
  const [reports, setReports] = useState<WeeklyReport[]>([])
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'weekly')
      .order('week_number', { ascending: true })

    if (error) return console.error(error)
    setReports(
      (data || []).map((r: any) => ({
        ...r,
        year: r.year || new Date().getFullYear(),
      }))
    )
  }

  useEffect(() => {
    fetchReports()
  }, [userId, refresh])

  const filteredReports = reports.filter((r) => {
    return (!filterMonth || r.month === filterMonth) &&
           (!filterYear || r.year === filterYear)
  })

  const handleEdit = (report: WeeklyReport) => {
    setSelectedReport(report)
    setIsEditing(true)
    setOpenMenu(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return
    const { error } = await supabase.from('reports').delete().eq('id', id)
    if (error) toast.error('Failed to delete')
    else {
      toast.success('🗑 Report deleted')
      setReports((r) => r.filter((rep) => rep.id !== id))
    }
    setOpenMenu(null)
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      <div className="grid grid-cols-1 gap-3">
        {filteredReports.length > 0 ? (
          filteredReports.map((r) => (
            <div
              key={r.id}
              className="relative rounded-xl p-3 border transition-all duration-300 transform cursor-pointer
                hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl"
              style={{
                background: 'var(--card-weekly-bg)',
                borderColor: 'var(--card-weekly-border)',
                boxShadow: `0 3px 10px var(--card-weekly-shadow)`,
                color: 'var(--foreground)',
              }}
              onClick={() => {
                setSelectedReport(r)
                setIsEditing(false)
              }}
            >
              {isAdmin && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenu(openMenu === r.id ? null : r.id)
                    }}
                    className="absolute top-2 right-2 p-1 rounded-md hover:bg-[var(--card-weekly-border)]/20 transition"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {openMenu === r.id && (
                    <div
                      ref={menuRef}
                      className="absolute top-8 right-2 rounded-md shadow-md w-28 z-50"
                      style={{
                        background: 'var(--card-weekly-border)',
                        color: 'var(--text-bright)',
                      }}
                    >
                      <button
                        onClick={() => handleEdit(r)}
                        className="block w-full text-left px-3 py-1 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="block w-full text-left px-3 py-1 text-sm text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--highlight)]">
                <FileText size={16} /> Week {r.week_number} - {r.month} {r.year}
              </div>
            </div>
          ))
        ) : (
          <div className="text-[#bdbdbd] text-sm mt-2 col-span-full text-center">
            No weekly reports available for this month/year.
          </div>
        )}
      </div>

      {selectedReport &&
        createPortal(
          <ReportModal
            report={selectedReport}
            onClose={() => {
              setSelectedReport(null)
              setIsEditing(false)
            }}
            isEditing={isEditing && isAdmin}
            isAdmin={isAdmin}
            onSave={async (updatedContent: string) => {
              if (!selectedReport) return
              const { error } = await supabase
                .from('reports')
                .update({ content: updatedContent })
                .eq('id', selectedReport.id)
              if (error) toast.error('Failed to save report.')
              else {
                toast.success('✅ Report updated!')
                const updatedReport = { ...selectedReport, content: updatedContent }
                setReports((prev) =>
                  prev.map((r) => (r.id === selectedReport.id ? updatedReport : r))
                )
                setSelectedReport(null)
                setIsEditing(false)
              }
            }}
          />,
          document.body
        )}
    </>
  )
}
