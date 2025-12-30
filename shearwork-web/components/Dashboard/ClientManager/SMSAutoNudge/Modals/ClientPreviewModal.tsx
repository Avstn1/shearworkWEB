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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 min-h-screen" 
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#1a1a1a] border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden mb-16 sm:mb-0"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3 sm:p-6 border-b border-white/10 flex-shrink-0 bg-[#1a1a1a]">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-sky-300 flex-shrink-0" />
                  <span className="truncate hidden sm:inline">Clients Selected for Next Campaign</span>
                  <span className="truncate sm:hidden">Selected Clients</span>
                </h3>
                {previewStats && (
                  <p className="text-xs sm:text-sm text-[#bdbdbd] mt-1">
                    {previewStats.total_selected} clients will receive your next SMS
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-[#bdbdbd]" />
              </button>
            </div>

            {/* Clients List - Scrollable (includes stats) */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Stats - Part of scroll content */}
              {previewStats && (
                <div className="p-3 sm:p-6 border-b border-white/10 bg-white/5">
                  {/* Main Stats - Single Row */}
                  <div className="grid grid-cols-4 gap-2 sm:gap-4 mb-3 sm:mb-4">
                    <div>
                      <p className="text-[10px] sm:text-xs text-[#bdbdbd] mb-1">Total</p>
                      <p className="text-lg sm:text-2xl font-bold text-white">{previewStats.total_selected}</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-[#bdbdbd] mb-1">Score</p>
                      <p className="text-lg sm:text-2xl font-bold text-sky-300">{previewStats.avg_score}</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-[#bdbdbd] mb-1 truncate">Since</p>
                      <p className="text-lg sm:text-2xl font-bold text-purple-400">{previewStats.avg_days_since_last_visit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-[#bdbdbd] mb-1 truncate">Overdue</p>
                      <p className="text-lg sm:text-2xl font-bold text-orange-400">{previewStats.avg_days_overdue}</p>
                    </div>
                  </div>

                  {/* Legend and Types - Two Columns */}
                  <div className="pt-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                    {/* Left Column - Explanations */}
                    <div className="space-y-1 text-[10px] sm:text-xs text-[#bdbdbd]">
                      <div className="truncate">
                        <span className="text-sky-300 font-medium">Score:</span>{" "}
                        <span className="hidden sm:inline">Higher = more urgent</span>
                        <span className="sm:hidden">Urgency</span>
                      </div>
                      <div className="truncate">
                        <span className="text-purple-400 font-medium">Since:</span>{" "}
                        <span className="hidden sm:inline">Days since last appointment</span>
                        <span className="sm:hidden">Since visit</span>
                      </div>
                      <div className="truncate">
                        <span className="text-orange-400 font-medium">Overdue:</span>{" "}
                        <span className="hidden sm:inline">How late vs typical pattern</span>
                        <span className="sm:hidden">How late</span>
                      </div>
                    </div>

                    {/* Right Column - Client Types */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 content-start">
                      {previewStats.breakdown.consistent > 0 && (
                        <span className="bg-green-500/10 text-green-400 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[11px] flex items-center gap-1">
                          <span className="font-medium hidden sm:inline">Consistent:</span>
                          <span className="font-medium sm:hidden">Cons:</span>
                          <span className="hidden sm:inline">Weekly</span>
                          <span className="px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-green-500/20">
                            {previewStats.breakdown.consistent}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown["semi-consistent"] > 0 && (
                        <span className="bg-blue-500/10 text-blue-400 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[11px] flex items-center gap-1">
                          <span className="font-medium hidden sm:inline">Semi:</span>
                          <span className="font-medium sm:hidden">Semi:</span>
                          <span className="hidden sm:inline">2-3w</span>
                          <span className="px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-blue-500/20">
                            {previewStats.breakdown["semi-consistent"]}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown["easy-going"] > 0 && (
                        <span className="bg-yellow-500/10 text-yellow-400 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[11px] flex items-center gap-1">
                          <span className="font-medium hidden sm:inline">Easy:</span>
                          <span className="font-medium sm:hidden">Easy:</span>
                          <span className="hidden sm:inline">1-2mo</span>
                          <span className="px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-yellow-500/20">
                            {previewStats.breakdown["easy-going"]}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown.rare > 0 && (
                        <span className="bg-red-500/10 text-red-400 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[11px] flex items-center gap-1">
                          <span className="font-medium">Rare:</span>
                          <span className="hidden sm:inline">2+mo</span>
                          <span className="px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-red-500/20">
                            {previewStats.breakdown.rare}
                          </span>
                        </span>
                      )}
                      {previewStats.breakdown.new > 0 && (
                        <span className="bg-gray-500/10 text-gray-400 px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[11px] flex items-center gap-1">
                          <span className="font-medium">New:</span>
                          <span className="hidden sm:inline">First</span>
                          <span className="px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-gray-500/20">
                            {previewStats.breakdown.new}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Client Cards */}
              <div className="p-3 sm:p-6 space-y-2">
                {previewClients.map((client) => (
                  <div
                    key={client.client_id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors gap-2 sm:gap-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <h4 className="font-semibold text-white text-sm sm:text-base truncate">
                          {client.first_name} {client.last_name}
                        </h4>
                        <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex-shrink-0 ${
                          client.visiting_type === 'consistent' ? 'bg-green-500/20 text-green-400' :
                          client.visiting_type === 'semi-consistent' ? 'bg-blue-500/20 text-blue-400' :
                          client.visiting_type === 'easy-going' ? 'bg-yellow-500/20 text-yellow-400' :
                          client.visiting_type === 'rare' ? 'bg-red-500/20 text-red-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {client.visiting_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-[#bdbdbd] flex-wrap">
                        <span className="truncate">{client.phone_normalized}</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{client.days_since_last_visit} days since visit</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="text-orange-400">{client.days_overdue} days overdue</span>
                      </div>
                    </div>
                    <div className="text-left sm:text-right flex sm:flex-col gap-3 sm:gap-0">
                      <p className="text-xs sm:text-sm font-semibold text-sky-300">Score: {client.score}</p>
                      <p className="text-[10px] sm:text-xs text-[#bdbdbd]">{client.avg_weekly_visits?.toFixed(2)}/week</p>
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

