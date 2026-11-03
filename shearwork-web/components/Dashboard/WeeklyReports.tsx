/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { MoreVertical, FileText } from 'lucide-react'
import ReportModal from './ReportModal'
import { EmptyState } from '@/components/ui/AppKit'
import toast from 'react-hot-toast'
import { createPortal } from 'react-dom'
import { useApp } from '@/contexts/AppContext'
import { useAuth } from '@/contexts/AuthContext'

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

async function logWeeklyReportOpen(user_id: string, r: any, role: string | null) {
  if (!role || role === 'Admin') return

  const { error: insertError } = await supabase
    .from('system_logs')
    .insert({
      source: user_id,
      action: 'opened_weekly_report',
      status: 'success',
      details: `Opened Report: Week #${r.week_number}, ${r.month} ${r.year}`,
    })

  if (insertError) throw insertError
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
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  })
  const [isEditing, setIsEditing] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const { reportToOpen, setReportToOpen, refreshTrigger } = useApp()  // ADD refreshTrigger
  const { profile } = useAuth()
  const role = profile?.role ?? null

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
  }, [userId, refresh, refreshTrigger])  // ADD refreshTrigger here

  // Handle opening report from notification
  useEffect(() => {
    if (reportToOpen?.type === 'weekly' && reports.length > 0) {
      const report = reports.find(r => r.id === reportToOpen.id)
      if (report) {
        setSelectedReport(report)
        setIsEditing(false)
        logWeeklyReportOpen(userId, report, role)
        setReportToOpen(null)
      }
    }
  }, [reportToOpen, reports, role, setReportToOpen, userId])

  const filteredReports = reports.filter(
    (r) =>
      (!filterMonth || r.month === filterMonth) &&
      (!filterYear || r.year === filterYear)
  )

  const handleEdit = (e: React.MouseEvent, report: WeeklyReport) => {
    e.stopPropagation()
    setOpenMenu(null)
    setSelectedReport(report)
    setIsEditing(true)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
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
      <div className="relative flex flex-col gap-2">
        {filteredReports.length > 0 ? (
          filteredReports.map((r) => (
            <div
              key={r.id}
              className="group relative w-full cursor-pointer rounded-lg border border-white/[0.07] bg-white/[0.015] p-3 transition-colors hover:border-white/[0.12] hover:bg-white/[0.03]"
              onClick={() => {
                setSelectedReport(r)
                logWeeklyReportOpen(userId, r, role)
                setIsEditing(false)
              }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-gray-400 group-hover:text-sage-bright"><FileText size={15} strokeWidth={1.75} /></span>
                <p className="min-w-0 flex-1 text-sm font-medium text-ivory">
                  Week {r.week_number} <span className="text-gray-500">·</span>{' '}
                  <span className="font-normal text-gray-400">{r.month} {r.year}</span>
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    aria-label="Report actions"
                    onClick={(e) => {
                      e.stopPropagation()
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setMenuPosition({ top: rect.bottom + window.scrollY, left: rect.right - 120 })
                      setOpenMenu(openMenu === r.id ? null : r.id)
                    }}
                    className="btn btn-ghost btn-sm px-1.5"
                  >
                    <MoreVertical size={16} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={FileText} title="No weekly reports">
            No weekly reports available for this month/year.
          </EmptyState>
        )}
      </div>

      {openMenu &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[99999] w-32 overflow-hidden rounded-lg border border-white/[0.12] bg-raised py-1 text-ivory shadow-lg"
            style={{
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
          >
            <button
              onClick={(e) => {
                const report = reports.find((r) => r.id === openMenu)
                if (report) handleEdit(e, report)
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-white/[0.05]"
            >
              Edit
            </button>
            <button
              onClick={(e) => handleDelete(e, openMenu)}
              className="block w-full px-3 py-2 text-left text-sm text-[#FF8F7D] hover:bg-[#FF8F7D]/[0.08]"
            >
              Delete
            </button>
          </div>,
          document.body
        )}

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
                toast.success('Report updated!')
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