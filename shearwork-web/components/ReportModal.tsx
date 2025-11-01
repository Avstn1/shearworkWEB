'use client'

import React, { useState, useEffect, Suspense } from 'react'
import type { Editor as TinyMCEEditorType } from 'tinymce'

const TinyMCEEditor = React.lazy(async () => {
  const mod = await import('@tinymce/tinymce-react')
  return { default: mod.Editor as unknown as React.ComponentType<any> }
})

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

  const readonly = !(isEditing && isAdmin)

  useEffect(() => {
    setEditedContent(report.content || '')
  }, [report])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fadeUp">
      <div
        className="bg-white text-black rounded-2xl shadow-2xl p-4 sm:p-6 
                   w-[95%] max-w-5xl h-[95vh] flex flex-col border border-gray-200"
      >
        {/* Header */}
        <div className="shrink-0 mb-3">
          <h2 className="text-2xl sm:text-3xl font-bold mb-1 text-gray-900 truncate">
            {isWeekly
              ? `Week ${report.week_number}`
              : `Monthly Report: ${report.month} ${report.year || ''}`}
          </h2>
          <p className="text-sm text-gray-500 truncate">
            {isWeekly
              ? `${report.month} ${report.year || ''}`
              : `Summary for ${report.month} ${report.year || ''}`}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto rounded-md border border-gray-200">
          <Suspense fallback={<p>Loading editor...</p>}>
            <TinyMCEEditor
              apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY}
              tinymceScriptSrc="/tinymce/tinymce.min.js"
              value={editedContent}
              onEditorChange={
                !readonly ? (newValue: string) => setEditedContent(newValue) : undefined
              }
              init={{
                license_key: 'gpl',
                height: '100%',
                resize: false,
                menubar: !readonly,
                toolbar: !readonly
                  ? 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help'
                  : false,
                readonly: readonly ? 1 : 0,
                plugins:
                  'advlist autolink lists link image charmap preview anchor code fullscreen insertdatetime media table help wordcount',
                setup: (editor: TinyMCEEditorType) => {
                  if (readonly) {
                    editor.on('init', () => {
                      const body = editor.getBody()
                      body.setAttribute('contenteditable', 'false')
                      body.style.userSelect = 'none'
                      body.style.pointerEvents = 'none'
                    })
                  }
                },
                content_style: `
                  html, body {
                    width: 100%;
                    box-sizing: border-box;
                    overflow-x: hidden;
                  }
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 16px;
                    line-height: 1.6;
                    color: #111;
                    padding: 1rem;
                    margin: 0;
                  }
                  p { margin-bottom: 0.75rem; }
                  img { max-width: 100%; height: auto; border-radius: 8px; }

                  /* Tables default font size */
                  table {
                    border-collapse: collapse;
                    width: 100%;
                    table-layout: auto;
                    font-size: 0.85rem; /* smaller default font */
                  }
                  td, th {
                    border: 1px solid #ddd;
                    padding: 6px;
                    word-break: break-word;
                    white-space: normal;
                    font-size: 0.85rem; /* match table font */
                  }
                  th { font-weight: 600; background: #f9f9f9; }

                  a { color: #007bff; text-decoration: underline; }

                  /* Mobile adjustments */
                  @media (max-width: 768px) {
                    body { font-size: 14px; }
                    td, th {
                      font-size: 0.75rem; /* smaller font on mobile */
                      padding: 4px;
                    }
                  }
                `,
              }}
            />
          </Suspense>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4 shrink-0">
          {!readonly ? (
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
