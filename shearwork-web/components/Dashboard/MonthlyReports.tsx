/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { MoreVertical, Edit, Trash2, FileText } from 'lucide-react'
import ReportModal from './ReportModal'
import { EmptyState } from '@/components/ui/AppKit'
import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'

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

async function logMonthlyReportOpen(user_id: string, r: any, role: string | null) {
  if (!role || role === 'Admin') return

  const { error: insertError } = await supabase
    .from('system_logs')
    .insert({
      source: user_id,
      action: 'opened_monthly_report',
      status: 'success',
      details: `Opened Report: ${r.month} ${r.year}`,
    })

  if (insertError) throw insertError
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
  const { profile } = useAuth()
  const role = profile?.role ?? null

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
        logMonthlyReportOpen(userId, report, role)
        setReportToOpen(null)
      }
    }
  }, [reportToOpen, reports, role, setReportToOpen, userId])

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
    toast.success('Report updated!')
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
      <div className="flex w-full flex-col gap-2">
        {filteredReports.length > 0 ? (
          filteredReports.map((r) => (
            <div
              key={r.id}
              className="group relative w-full cursor-pointer rounded-lg border border-white/[0.07] bg-white/[0.015] p-3 transition-colors hover:border-white/[0.12] hover:bg-white/[0.03]"
              onClick={() => {
                setSelectedReport(r)
                logMonthlyReportOpen(userId, r, role)
                setIsEditing(false)
              }}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-gray-400 group-hover:text-sage-bright"><FileText size={15} strokeWidth={1.75} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ivory">
                    {r.month} {r.year}
                  </p>
                  <div className="prose prose-sm mt-1 max-h-10 overflow-hidden text-xs leading-5 text-gray-400">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: r.content
                          ? r.content.length > 150
                            ? r.content.slice(0, 150) + '...'
                            : r.content
                          : '<em>No content available.</em>',
                      }}
                    />
                  </div>
                </div>

              {isAdmin && (
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Report actions"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(menuOpenId === r.id ? null : r.id)
                    }}
                    className="btn btn-ghost btn-sm px-1.5"
                  >
                    <MoreVertical size={16} strokeWidth={1.75} />
                  </button>

                  {menuOpenId === r.id && (
                    <div
                      ref={(el) => {
                        if (el) menuRef.current = el
                      }}
                      className="absolute right-0 z-50 mt-1 w-32 overflow-hidden rounded-lg border border-white/[0.12] bg-raised py-1 text-ivory shadow-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleEdit(r)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-white/[0.05]"
                      >
                        <Edit size={14} strokeWidth={1.75} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#D99A8B] hover:bg-[#D99A8B]/[0.08]"
                      >
                        <Trash2 size={14} strokeWidth={1.75} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}

              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={FileText} title="No monthly reports">
            No monthly reports for this month/year.
          </EmptyState>
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