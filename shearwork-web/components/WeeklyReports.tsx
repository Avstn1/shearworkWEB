'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { MoreVertical } from 'lucide-react'
import ReportModal from './ReportModal'
import toast from 'react-hot-toast'

type WeeklyReport = {
  id: string
  month: string
  week_number: number
  title?: string
  content: string
  year?: number
}

interface WeeklyReportsProps {
  userId: string
  refresh?: number
  filterMonth?: string
  isAdmin?: boolean
}

export default function WeeklyReports({
  userId,
  refresh,
  filterMonth,
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
    setReports(data || [])
  }

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

  useEffect(() => { fetchReports() }, [userId, refresh])

  const filteredReports = filterMonth
    ? reports.filter((r) => r.month === filterMonth)
    : reports

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredReports.map((r) => (
          <div
            key={r.id}
            className="relative bg-[#708B64] text-[#1f1f1a] p-4 rounded-lg shadow-sm hover:shadow-md transition"
          >
            {isAdmin && (
              <>
                <button
                  onClick={() => setOpenMenu(openMenu === r.id ? null : r.id)}
                  className="absolute top-2 right-2 text-[#1f1f1a] hover:text-gray-700"
                >
                  <MoreVertical size={18} />
                </button>

                {openMenu === r.id && (
                  <div
                    ref={menuRef}
                    className="absolute top-8 right-2 bg-white text-black shadow-md rounded-lg w-28 z-10"
                  >
                    <button
                      onClick={() => handleEdit(r)}
                      className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-sm text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}

            <div
              onClick={() => {
                setSelectedReport(r)
                setIsEditing(false)
              }}
              className="cursor-pointer"
            >
              <p className="font-semibold">
                Week {r.week_number} - {r.month} {r.year || ''}
              </p>

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
          </div>
        ))}
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
        />
      )}
    </>
  )
}
