/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { MoreVertical, Edit, Trash2, FileText } from 'lucide-react';
import ReportModal from './ReportModal';
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
    toast.success('✅ Report updated!');
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

  return (
    <>
      {/* single-column grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredReports.length > 0 ? (
          filteredReports.map((r) => (
            <div
              key={r.id}
              className="relative rounded-xl p-4 border transition-all duration-300 transform cursor-pointer
                hover:-translate-y-1 hover:scale-[1.03] hover:shadow-2xl hover:bg-[rgba(255,255,255,0.05)]"
              style={{
                background: 'var(--card-weekly-bg)',
                borderColor: 'var(--card-weekly-border)',
                boxShadow: `0 3px 10px var(--card-weekly-shadow)`,
                color: 'var(--foreground)',
              }}
            >
              <div className="flex justify-between items-start gap-2">
                <div
                  onClick={() => {
                    setSelectedReport(r);
                    logWeeklyComparisonReportOpen(userId, r, role);
                    setIsEditing(false);
                  }}
                  className="flex-1 flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1 text-sm font-semibold text-[var(--highlight)]">
                    <FileText size={16} /> Weekly Comparison - {r.month} {r.year}
                  </div>
                  <div className="text-xs text-[var(--text-subtle)] max-h-20 overflow-hidden relative">
                    <div
                      className="prose prose-sm"
                      dangerouslySetInnerHTML={{
                        __html: r.content
                          ? r.content.length > 150
                            ? r.content.slice(0, 150) + '...'
                            : r.content
                          : '<em>No content available.</em>',
                      }}
                    />
                    <div className="absolute bottom-0 left-0 w-full h-6 bg-gradient-to-t from-[var(--card-weekly-bg)] to-transparent" />
                  </div>
                </div>

                {isAdmin && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === r.id ? null : r.id);
                      }}
                      className="p-1 rounded-md hover:bg-[var(--card-weekly-border)]/20 transition"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {menuOpenId === r.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-0 mt-1 rounded-md shadow-lg z-50 w-28"
                        style={{
                          background: 'var(--card-weekly-border)',
                          color: 'var(--text-bright)',
                        }}
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
          <div className="text-[#bdbdbd] text-sm mt-2 col-span-1 text-center">
            No weekly comparison reports for this month/year.
          </div>
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
    </>
  );
}
