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
  const [editedContent, setEditedContent] = useState(report.content || '')

  useEffect(() => {
    setEditedContent(report.content || '')
  }, [report])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/30 backdrop-blur-sm animate-fadeUp"
    >
      <div
        className="bg-white text-black rounded-2xl shadow-2xl p-6 
                   w-[90%] max-w-2xl max-h-[80vh] flex flex-col border border-gray-200"
      >
        {/* Header */}
        <h2 className="text-2xl font-bold mb-1 text-gray-900">
          {isWeekly
            ? `Week ${report.week_number}`
            : `Monthly Report: ${report.month} ${report.year || ''}`}
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          {isWeekly
            ? `${report.month} ${report.year || ''}`
            : `Summary for ${report.month} ${report.year || ''}`}
        </p>

        {/* Content */}
        <div className="flex-1 overflow-y-auto mb-4">
          {isEditing && isAdmin ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-64 p-3 border border-gray-300 rounded-lg 
                         bg-white text-black text-sm leading-relaxed resize-none 
                         focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {report.content || 'No content available.'}
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-2 mt-auto">
          {isEditing && isAdmin ? (
            <>
              <button
                onClick={() => onSave && onSave(editedContent)}
                className="bg-black hover:bg-gray-800 text-white rounded-lg px-4 py-2 transition"
              >
                Save
              </button>
              <button
                onClick={onClose}
                className="border border-gray-400 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="bg-black hover:bg-gray-800 text-white rounded-lg px-4 py-2 transition"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
