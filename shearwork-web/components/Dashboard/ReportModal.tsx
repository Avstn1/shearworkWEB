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
        className="bg-white text-black rounded-2xl shadow-2xl 
                   w-[95%] max-w-5xl h-[95vh] flex flex-col border border-gray-200"
      >
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-2xl sm:text-3xl font-bold mb-1 text-gray-900 truncate">
            {isWeekly
              ? `Weekly Comparison Report`
              : `Monthly Report: ${report.month} ${report.year || ''}`}
          </h2>
          <p className="text-sm text-gray-500 truncate">
            {isWeekly
              ? `${report.month} ${report.year || ''}`
              : `Summary for ${report.month} ${report.year || ''}`}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto p-2 sm:p-4">
          <Suspense fallback={<p>Loading editor...</p>}>
            <TinyMCEEditor
              apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY}
              tinymceScriptSrc="/tinymce/tinymce.min.js"
              value={editedContent}
              onEditorChange={!readonly ? (newValue: string) => setEditedContent(newValue) : undefined}
              init={{
                license_key: 'gpl',
                height: '100%',
                min_height: 400,
                resize: 'vertical',
                menubar: !readonly,
                toolbar: !readonly
                  ? 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help'
                  : false,
                readonly: readonly ? 1 : 0,
                iframe_attrs: {
                  style: 'width: 100%; min-height: 100%; border: none;',
                },
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
                    margin: 0;
                    padding: 0.5rem;
                    box-sizing: border-box;
                    width: 100%;
                    overflow-x: auto;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: clamp(9px, 2vw, 16px);
                    line-height: 1.6;
                  }

                  p, li { margin-bottom: 0.75rem; }
                  img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 0 auto; }

                  /* ===== TABLES ===== */
                  table {
                    border-collapse: collapse;
                    width: max-content; /* allow horizontal scroll */
                    min-width: 100%;    /* at least full width of container */
                    margin-bottom: 1rem;
                  }

                  /* Wrap tables to allow horizontal scroll */
                  table {
                    display: table;
                  }
                  table.wrapper {
                    overflow-x: auto;
                  }

                  td, th {
                    border: 1px solid #ddd;
                    padding: 0.5rem;
                    text-align: left;
                    word-break: break-word;
                    white-space: normal;
                  }
                  th {
                    font-weight: 600;
                    background: #f9f9f9;
                    text-overflow: ellipsis;
                  }

                  a { color: #007bff; text-decoration: underline; word-break: break-all; }

                  @media (max-width: 768px) {
                    body { font-size: 13px; padding: 0.5rem; }
                    td, th { font-size: 0.75rem; padding: 4px; text-align: center; }
                  }
                `,
              }}
            />
          </Suspense>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 sm:p-6 flex justify-end gap-2 border-t border-gray-200">
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
