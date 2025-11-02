'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
import ReportModal from './ReportModal';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';

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
  isAdmin?: boolean;
}

export default function WeeklyComparisonReports({
  userId,
  refresh,
  filterMonth,
  isAdmin = false,
}: WeeklyComparisonReportsProps) {
  const [reports, setReports] = useState<WeeklyComparisonReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<WeeklyComparisonReport | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const fetchReports = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'weekly_comparison')
      .order('week_number', { ascending: true });

    if (error) return console.error('Error fetching weekly comparison reports:', error);
    setReports(data as WeeklyComparisonReport[]);
  };

  useEffect(() => {
    fetchReports();
  }, [userId, refresh]);

  const filteredReports = filterMonth
    ? reports.filter((r) => r.month === filterMonth)
    : reports;

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredReports.length > 0 ? (
          filteredReports.map((r) => (
            <div
              key={r.id}
              className="relative rounded-lg p-4 border transition-all duration-300 ease-out transform hover:-translate-y-1 hover:scale-[1.02] cursor-default"
              style={{
                background: 'var(--card-weekly-bg)',
                borderColor: 'var(--card-weekly-border)',
                boxShadow: `0 3px 10px var(--card-weekly-shadow)`,
                color: 'var(--foreground)',
              }}
            >
              <div className="flex justify-between items-start">
                <div
                  onClick={() => {
                    setSelectedReport(r);
                    setIsEditing(false);
                  }}
                  className="cursor-pointer flex-1"
                >
                  <p className="font-semibold">
                    Weekly Comparison - {r.month} {r.year}
                  </p>
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
                    <div className="absolute bottom-0 left-0 w-full h-4 bg-gradient-to-t from-[var(--card-weekly-bg)] to-transparent" />
                  </div>
                </div>

                {isAdmin && (
                  <div className="relative">
                    <button
                      onClick={() =>
                        setMenuOpenId(menuOpenId === r.id ? null : r.id)
                      }
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
          <div className="text-[#bdbdbd] text-sm mt-2 col-span-2">
            No weekly comparison reports for this month.
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
