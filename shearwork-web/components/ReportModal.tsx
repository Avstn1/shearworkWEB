'use client'

import React from 'react'

type ReportModalProps = {
  report: any
  onClose: () => void
}

export default function ReportModal({ report, onClose }: ReportModalProps) {
  const isWeekly = report.week_number !== undefined
  const isMonthly = !isWeekly

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeUp">
      <div className="bg-[var(--background)] text-[var(--foreground)] rounded-2xl shadow-xl p-6 w-[90%] max-w-2xl max-h-[80vh] flex flex-col">
        
        {/* Header */}
        <h2 className="text-2xl font-bold mb-2 text-[var(--highlight)]">
          {isWeekly
            ? `Week ${report.week_number}`
            : `Monthly Report: ${report.month} ${report.year || ''}`}
        </h2>

        {/* Subheader */}
        <p className="text-sm text-[var(--text-subtle)] mb-4">
          {isWeekly
            ? `${report.month} ${report.year || ''}`
            : `Summary for ${report.month} ${report.year || ''}`}
        </p>

        {/* Scrollable content */}
        <div className="text-[var(--foreground)] whitespace-pre-wrap text-sm leading-relaxed mb-4 overflow-y-auto flex-1">
          {report.content ? report.content : 'No content available.'}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] rounded-lg px-4 py-2 transition mt-auto"
        >
          Close
        </button>
      </div>
    </div>
  )
}
