/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { MoreVertical, Edit, Trash2, FileText } from 'lucide-react'
import ReportModal from './ReportModal'
import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'
import { useApp } from '@/contexts/AppContext'

type MonthlyReport = {
  id: string
  month: string
  notes: string
  content: string
  year: number
}

interface MonthlyReportsProps {
  userId: string
  refresh?: number
  filterMonth?: string
  filterYear?: number | null
  isAdmin?: boolean
}

async function logMonthlyReportOpen(user_id: string, r: any) {
  const { data: { session }, error: sessionError, } = await supabase.auth.getSession()

  if (sessionError) {
    console.error('Error fetching session:', sessionError.message)
    return
  }

  if (session?.user) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single()

    if (profileError) throw profileError
    
    if (profileData?.role != "Admin") {
      const { error: insertError } = await supabase
        .from('system_logs')
        .insert({
          source: user_id,
          action: 'opened_monthly_report',
          status: 'success',
          details: `Opened Report: ${r.month} ${r.year}`,
        });

      if (insertError) throw insertError;
    }
  }
}

export default function MonthlyReports({
  userId,
  refresh,
  filterMonth,
  filterYear,
  isAdmin = false,
}: MonthlyReportsProps) {
  const [reports, setReports] = useState<MonthlyReport[]>([])
  const [selectedReport, setSelectedReport] = useState<MonthlyReport | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { reportToOpen, setReportToOpen, refreshTrigger } = useApp()  // ADD refreshTrigger

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
        notes: r.notes || '',
        content: r.content || '',
        year: r.year || new Date().getFullYear(),
      }))
    )
  }

  useEffect(() => {
    fetchMonthlyReports()
  }, [userId, refresh, refreshTrigger])  // ADD refreshTrigger here

  // Handle opening report from notification
  useEffect(() => {
    if (reportToOpen?.type === 'monthly' && reports.length > 0) {
      const report = reports.find(r => r.id === reportToOpen.id)
      if (report) {
        setSelectedReport(report)
        setIsEditing(false)
        logMonthlyReportOpen(userId, report)
        setReportToOpen(null)
      }
    }
  }, [reportToOpen, reports, userId, setReportToOpen])

  const filteredReports = reports.filter((r) => {
    return (!filterMonth || r.month === filterMonth) &&
           (!filterYear || r.year === filterYear)
  })

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
      <div className="flex flex-col gap-4 w-full h-full">
        {filteredReports.length > 0 ? (
          filteredReports.map((r) => (
            <div
              key={r.id}
              className="relative w-full h-full flex-1 rounded-xl p-4 border transition-all duration-300 transform cursor-pointer
                hover:-translate-y-1 hover:scale-[1.03] hover:shadow-2xl hover:bg-[rgba(255,255,255,0.05)]"
              style={{
                background: 'var(--card-monthly-bg)',
                borderColor: 'var(--card-monthly-border)',
                boxShadow: `0 2px 6px var(--card-monthly-shadow)`,
                color: 'var(--foreground)',
              }}
              onClick={() => {
                setSelectedReport(r)
                logMonthlyReportOpen(userId, r);
                setIsEditing(false)
              }}
            >
              <div className="flex justify-between items-start h-full">
                <div className="flex-1 flex flex-col justify-center gap-2">
                  <div className="flex items-center justify-center gap-1 text-sm font-semibold text-[var(--highlight)]">
                    <FileText size={16} /> {r.month} {r.year}
                  </div>
                  <div className="text-xs text-[var(--text-subtle)] max-h-20 overflow-hidden relative prose prose-sm">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: r.content
                          ? r.content.length > 150
                            ? r.content.slice(0, 150) + '...'
                            : r.content
                          : '<em>No content available.</em>',
                      }}
                    />
                    <div className="absolute bottom-0 left-0 w-full h-6 bg-gradient-to-t from-[var(--card-monthly-bg)] to-transparent" />
                  </div>
                </div>

              {isAdmin && (
                <div className="relative ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(menuOpenId === r.id ? null : r.id)
                    }}
                    className="p-1 rounded-md hover:bg-[var(--card-monthly-border)]/20 transition"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {menuOpenId === r.id && (
                    <div
                      ref={(el) => {
                        if (el) menuRef.current = el
                      }}
                      className="absolute right-0 mt-1 rounded-md shadow-lg z-50 w-28"
                      style={{
                        background: 'var(--card-monthly-border)',
                        color: 'var(--text-bright)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleEdit(r)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm"
                      >
                        <Edit size={14} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-300"
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
          <div className="text-[#bdbdbd] text-sm mt-2 text-center w-full">
            No monthly reports for this month/year.
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
            onSave={handleSave}
          />,
          document.body
        )}
    </>
  )
}