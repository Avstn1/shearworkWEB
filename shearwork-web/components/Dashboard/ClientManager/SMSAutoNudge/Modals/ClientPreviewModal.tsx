'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Users, X } from 'lucide-react';
import { useState } from 'react'

interface PreviewClient {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  phone_normalized: string;
  visiting_type: string | null;
  avg_weekly_visits: number | null;
  last_appt: string | null;
  total_appointments: number;
  days_since_last_visit: number;
  days_overdue: number;
  expected_visit_interval_days: number;
  score: number;
  date_last_sms_sent: string | null;
}

interface PreviewStats {
  total_selected: number;
  breakdown: Record<string, number>;
  avg_score: string;
  avg_days_overdue: string;
  avg_days_since_last_visit: string;
}

interface ClientPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewClients: PreviewClient[];
  previewStats: PreviewStats | null;
}

export default function ClientPreviewModal({
  isOpen,
  onClose,
  previewClients,
  previewStats,
}: ClientPreviewModalProps) {

  const [isScrolled, setIsScrolled] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop !z-50 flex items-center justify-center p-2 sm:p-4 min-h-screen"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="modal-surface w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden mb-16 sm:mb-0"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Users className="w-[18px] h-[18px] text-sage flex-shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-ivory truncate">
                    <span className="hidden sm:inline">Clients selected for next campaign</span>
                    <span className="sm:hidden">Selected clients</span>
                  </h3>
                  {previewStats && (
                    <p className="text-xs text-muted mt-0.5">
                      {previewStats.total_selected} clients will receive your next SMS
                    </p>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-sm !h-8 !px-2 flex-shrink-0" aria-label="Close">
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Clients List - Scrollable (includes stats) */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Stats - Part of scroll content */}
              {previewStats && (
                <div className="px-4 sm:px-5 py-4 border-b border-white/[0.07] bg-white/[0.02]">
                  {/* Main Stats - Single Row */}
                  <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-3 sm:mb-4">
                    <div>
                      <p className="stat-label mb-1">Total</p>
                      <p className="text-lg sm:text-2xl font-semibold text-ivory tabular-nums">{previewStats.total_selected}</p>
                    </div>
                    <div>
                      <p className="stat-label mb-1">Score</p>
                      <p className="text-lg sm:text-2xl font-semibold text-sage-bright tabular-nums">{previewStats.avg_score}</p>
                    </div>
                    <div>
                      <p className="stat-label mb-1 truncate">Since</p>
                      <p className="text-lg sm:text-2xl font-semibold text-[#9CCBFF] tabular-nums">{previewStats.avg_days_since_last_visit}</p>
                    </div>
                    <div>
                      <p className="stat-label mb-1 truncate">Overdue</p>
                      <p className="text-lg sm:text-2xl font-semibold text-[#FFC97A] tabular-nums">{previewStats.avg_days_overdue}</p>
                    </div>
                  </div>

                  {/* Legend and Types - Two Columns */}
                  <div className="pt-3 border-t border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                    {/* Left Column - Explanations */}
                    <div className="space-y-1 text-[11px] sm:text-xs text-muted">
                      <div className="truncate">
                        <span className="text-sage-bright font-medium">Score:</span>{" "}
                        <span className="hidden sm:inline">Higher = more urgent</span>
                        <span className="sm:hidden">Urgency</span>
                      </div>
                      <div className="truncate">
                        <span className="text-[#9CCBFF] font-medium">Since:</span>{" "}
                        <span className="hidden sm:inline">Days since last appointment</span>
                        <span className="sm:hidden">Since visit</span>
                      </div>
                      <div className="truncate">
                        <span className="text-[#FFC97A] font-medium">Overdue:</span>{" "}
                        <span className="hidden sm:inline">How late vs typical pattern</span>
                        <span className="sm:hidden">How late</span>
                      </div>
                    </div>

                    {/* Right Column - Client Types */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 content-start">
                      {previewStats.breakdown.consistent > 0 && (
                        <span className="badge badge-sage">
                          <span className="hidden sm:inline">Consistent:</span>
                          <span className="sm:hidden">Cons:</span>
                          <span className="hidden sm:inline font-normal">Weekly</span>
                          <span className="tabular-nums text-ivory/90">
                            {previewStats.breakdown.consistent}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown["semi-consistent"] > 0 && (
                        <span className="badge badge-info">
                          <span className="hidden sm:inline">Semi:</span>
                          <span className="sm:hidden">Semi:</span>
                          <span className="hidden sm:inline font-normal">2-3w</span>
                          <span className="tabular-nums text-ivory/90">
                            {previewStats.breakdown["semi-consistent"]}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown["easy-going"] > 0 && (
                        <span className="badge badge-warn">
                          <span className="hidden sm:inline">Easy:</span>
                          <span className="sm:hidden">Easy:</span>
                          <span className="hidden sm:inline font-normal">1-2mo</span>
                          <span className="tabular-nums text-ivory/90">
                            {previewStats.breakdown["easy-going"]}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown.rare > 0 && (
                        <span className="badge badge-danger">
                          <span className="hidden sm:inline">Rare:</span>
                          <span className="sm:hidden">Rare:</span>
                          <span className="hidden sm:inline font-normal">2+mo</span>
                          <span className="tabular-nums text-ivory/90">
                            {previewStats.breakdown.rare}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown.new > 0 && (
                        <span className="badge ">
                          <span className="hidden sm:inline">New:</span>
                          <span className="sm:hidden">New:</span>
                          <span className="hidden sm:inline font-normal">First</span>
                          <span className="tabular-nums text-ivory/90">
                            {previewStats.breakdown.new}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Client Cards */}
              <div className="p-3 sm:p-5 space-y-2">
                {previewClients.map((client) => (
                  <div
                    key={client.client_id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:px-4 bg-white/[0.02] border border-white/[0.07] rounded-lg hover:bg-white/[0.04] transition-colors gap-2 sm:gap-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <h4 className="font-semibold text-ivory text-sm truncate">
                          {client.first_name} {client.last_name}
                        </h4>
                        <span className={`badge flex-shrink-0 ${
                          client.visiting_type === 'consistent' ? 'badge-sage' :
                          client.visiting_type === 'semi-consistent' ? 'badge-info' :
                          client.visiting_type === 'easy-going' ? 'badge-warn' :
                          client.visiting_type === 'rare' ? 'badge-danger' :
                          ''
                        }`}>
                          {client.visiting_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 mt-1.5 text-[11px] sm:text-xs text-muted flex-wrap tabular-nums">
                        <span className="truncate">{client.phone_normalized}</span>
                        <span className="hidden sm:inline text-gray-600">·</span>
                        <span>{client.days_since_last_visit} days since visit</span>
                        <span className="hidden sm:inline text-gray-600">·</span>
                        <span className="text-[#FFC97A]">{client.days_overdue} days overdue</span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right flex sm:flex-col gap-3 sm:gap-0 tabular-nums">
                      <p className="text-xs sm:text-[13px] font-semibold text-sage-bright">Score: {client.score}</p>
                      <p className="text-[11px] sm:text-xs text-muted">{client.avg_weekly_visits?.toFixed(2)}/week</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

