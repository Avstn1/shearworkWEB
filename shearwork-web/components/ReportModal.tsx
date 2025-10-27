'use client'

import React, { useState, useEffect } from 'react'

type ReportModalProps = {
  report: any
  onClose: () => void
  isEditing?: boolean
  isAdmin?: boolean
  onSave?: (updatedContent: string) => void
}

export default function ReportModal({
  report,
  onClose,
  isEditing = false,
  isAdmin = false,
  onSave,
}: ReportModalProps) {
  const isWeekly = report.week_number !== undefined
  const isMonthly = !isWeekly
  const [editedContent, setEditedContent] = useState(report.content || '')

  useEffect(() => {
    setEditedContent(report.content || '')
  }, [report])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeUp">
      <div className="bg-[var(--background)] text-[var(--foreground)] rounded-2xl shadow-xl p-6 w-[90%] max-w-2xl max-h-[80vh] flex flex-col">
        <h2 className="text-2xl font-bold mb-2 text-[var(--highlight)]">
          {isWeekly
            ? `Week ${report.week_number}`
            : `Monthly Report: ${report.month} ${report.year || ''}`}
        </h2>
        <p className="text-sm text-[var(--text-subtle)] mb-4">
          {isWeekly
            ? `${report.month} ${report.year || ''}`
            : `Summary for ${report.month} ${report.year || ''}`}
        </p>

        <div className="flex-1 overflow-y-auto mb-4">
          {isEditing && isAdmin ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-64 p-3 border border-[var(--accent-3)] rounded-lg bg-[var(--background)] text-[var(--foreground)] text-sm leading-relaxed resize-none"
            />
          ) : (
            <div className="text-[var(--foreground)] whitespace-pre-wrap text-sm leading-relaxed">
              {report.content || 'No content available.'}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-auto">
          {isEditing && isAdmin ? (
            <>
              <button
                onClick={() => onSave && onSave(editedContent)}
                className="bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] rounded-lg px-4 py-2 transition"
              >
                Save
              </button>
              <button
                onClick={onClose}
                className="border border-[var(--accent-3)] rounded-lg px-4 py-2 transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="bg-[var(--accent-3)] hover:bg-[var(--accent-4)] text-[var(--text-bright)] rounded-lg px-4 py-2 transition"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
