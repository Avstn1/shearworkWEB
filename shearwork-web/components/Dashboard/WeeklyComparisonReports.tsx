/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useFitCount } from '@/hooks/useFitCount'
import ShowAllModal, { ShowAllButton } from '@/components/ui/ShowAllModal'
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { MoreVertical, Edit, Trash2, FileText } from 'lucide-react';
import ReportModal from './ReportModal';
import { EmptyState } from '@/components/ui/AppKit';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';

type WeeklyComparisonReport = {
  id: string;
  week_number: number;
  month: string;
  year: number;
  content: string;
};

interface WeeklyComparisonReportsProps {
  userId: string;
  refresh?: number;
  filterMonth?: string;
  filterYear?: number | null;
  isAdmin?: boolean;
}

function getMondaysInMonth(month: number, year: number): number[] {
  const mondays: number[] = []
  const date = new Date(year, month, 1) 

  // Move to first Monday
  while (date.getDay() !== 1) {
    date.setDate(date.getDate() + 1)
  }

  // Collect all Mondays
  while (date.getMonth() === month) {
    mondays.push(date.getDate())
    date.setDate(date.getDate() + 7)
  }

  return mondays
}

async function logWeeklyComparisonReportOpen(user_id: string, r: any, role: string | null) {
  if (!role || role === 'Admin') return

  const monthIndex = new Date(`${r.month} 1, ${r.year}`).getMonth();
  const week_number = r.week_number ?? getMondaysInMonth(monthIndex, r.year).length

  const { error: insertError } = await supabase
    .from('system_logs')
    .insert({
      source: user_id,
      action: 'opened_wkComparison_report',
      status: 'success',
      details: `Opened Report: Week #${week_number}, ${r.month} ${r.year}`,
    });

  if (insertError) throw insertError;
}

export default function WeeklyComparisonReports({
  userId,
  refresh,
  filterMonth,
  filterYear,
  isAdmin = false,
}: WeeklyComparisonReportsProps) {
  const [showAll, setShowAll] = useState(false)
  const [reports, setReports] = useState<WeeklyComparisonReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<WeeklyComparisonReport | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { reportToOpen, setReportToOpen, refreshTrigger } = useApp();  // ADD refreshTrigger
  const { profile } = useAuth();
  const role = profile?.role ?? null

  const fetchReports = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'weekly_comparison')
      .order('week_number', { ascending: true });

    if (error) return console.error('Error fetching weekly comparison reports:', error);

    setReports(
      (data || []).map((r: any) => ({
        ...r,
        year: r.year || new Date().getFullYear(),
      }))
    );
  };

  useEffect(() => {
    fetchReports();
  }, [userId, refresh, refreshTrigger]);  // ADD refreshTrigger here

  // Handle opening report from notification
  useEffect(() => {
    if (reportToOpen?.type === 'weekly_comparison' && reports.length > 0) {
      const report = reports.find(r => r.id === reportToOpen.id)
      if (report) {
        setSelectedReport(report)
        setIsEditing(false)
        logWeeklyComparisonReportOpen(userId, report, role)
        setReportToOpen(null)
      }
    }
  }, [reportToOpen, reports, role, setReportToOpen, userId])

  const filteredReports = reports.filter((r) => {
    return (!filterMonth || r.month === filterMonth) &&
           (!filterYear || r.year === filterYear)
  });
  const { ref: fitRef, count: fitCount } = useFitCount<HTMLDivElement>({ fallbackRowHeight: 62, gap: 8, deps: [filteredReports.length] })

  const handleEdit = (report: WeeklyComparisonReport) => {
    setSelectedReport(report);
    setIsEditing(true);
    setMenuOpenId(null);
  };

  const handleSave = async (updatedContent: string) => {
    if (!selectedReport) return;
    const { error } = await supabase
      .from('reports')
      .update({ content: updatedContent })
      .eq('id', selectedReport.id);

    if (error) {
      toast.error('Failed to save report.');
      return;
    }

    setReports((prev) =>
      prev.map((r) => (r.id === selectedReport.id ? { ...r, content: updatedContent } : r))
    );
    toast.success('Report updated!');
    setIsEditing(false);
    setSelectedReport(null);
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    const { error } = await supabase.from('reports').delete().eq('id', reportId);
    if (error) {
      toast.error('Failed to delete report.');
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== reportId));
    setMenuOpenId(null);
    toast.success('🗑 Report deleted');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderReport = (r: (typeof filteredReports)[number]) => (
            <div
              key={r.id}
              className="group relative w-full cursor-pointer rounded-lg border border-white/[0.07] bg-white/[0.015] p-3 transition-colors hover:border-white/[0.12] hover:bg-white/[0.03]"
            >
              <div className="flex items-start gap-3">
                <div
                  onClick={() => {
                    setSelectedReport(r);
                    logWeeklyComparisonReportOpen(userId, r, role);
                    setIsEditing(false);
                  }}
                  className="flex min-w-0 flex-1 items-start gap-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.05] text-gray-400 group-hover:text-sage-bright"><FileText size={15} strokeWidth={1.75} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ivory">
                      Weekly Comparison <span className="text-gray-500">·</span>{' '}
                      <span className="font-normal text-gray-400">{r.month} {r.year}</span>
                    </p>
                    <div
                      className="prose prose-sm mt-1 max-h-10 overflow-hidden text-xs leading-5 text-gray-400"
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
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === r.id ? null : r.id);
                      }}
                      className="btn btn-ghost btn-sm px-1.5"
                    >
                      <MoreVertical size={16} strokeWidth={1.75} />
                    </button>

                    {menuOpenId === r.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 z-50 mt-1 w-32 overflow-hidden rounded-lg border border-white/[0.12] bg-raised py-1 text-ivory shadow-lg"
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
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[#FF8F7D] hover:bg-[#FF8F7D]/[0.08]"
                        >
                          <Trash2 size={14} strokeWidth={1.75} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )

  return (
    <>
      <div ref={fitRef} className="flex flex-col gap-2 min-h-0 flex-1 overflow-hidden">
        {filteredReports.length > 0 ? (
          filteredReports.slice(0, fitCount).map(renderReport)
        ) : (
          <EmptyState icon={FileText} title="No comparison reports">
            No weekly comparison reports for this month/year.
          </EmptyState>
        )}
      </div>

      {selectedReport &&
        createPortal(
          <ReportModal
            report={selectedReport}
            onClose={() => {
              setSelectedReport(null);
              setIsEditing(false);
            }}
            isEditing={isEditing && isAdmin}
            isAdmin={isAdmin}
            onSave={handleSave}
          />,
          document.body
        )}
      {filteredReports.length > fitCount && (
        <ShowAllButton total={filteredReports.length} onClick={() => setShowAll(true)} />
      )}
      <ShowAllModal open={showAll} onClose={() => setShowAll(false)} title={`Weekly comparison · ${filteredReports.length}`}>
        <div className="flex flex-col gap-2 py-2">{filteredReports.map(renderReport)}</div>
      </ShowAllModal>
    </>
  );
}