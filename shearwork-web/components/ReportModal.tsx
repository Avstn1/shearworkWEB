'use client'

import React, { useState, useEffect, Suspense } from 'react'
import type { Editor as TinyMCEEditorType } from 'tinymce'

// ✅ Lazy-load TinyMCE safely
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

  // readonly if not editing
  const readonly = !(isEditing && isAdmin)

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
                   w-[90%] max-w-4xl max-h-[90vh] flex flex-col border border-gray-200"
      >
        {/* Header */}
        <h2 className="text-3xl font-bold mb-1 text-gray-900">
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
        <div className="flex-1 overflow-y-auto mb-4 min-h-[400px]">
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
                height: 700,         // initial height
                resize: true,        // allow manual resize
                menubar: !readonly,
                toolbar: !readonly
                  ? 'undo redo | blocks | bold italic forecolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | help'
                  : false,
                readonly: readonly ? 1 : 0,
                setup: (editor: TinyMCEEditorType) => {
                  if (readonly) {
                    editor.on('init', () => {
                      const body = editor.getBody()
                      body.setAttribute('contenteditable', 'false') // disable editing
                      body.style.userSelect = 'none'               // prevent text selection
                      body.style.pointerEvents = 'none'            // prevent clicking/focus
                    })
                  }
                },
                plugins:
                  'advlist autolink lists link image charmap preview anchor ' +
                  'code fullscreen insertdatetime media table help wordcount',
                content_style: `
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    font-size: 16px;
                    line-height: 1.6;
                    color: #111;
                    padding: 1rem;
                  }
                  p { margin-bottom: 0.75rem; }
                  img { max-width: 100%; border-radius: 8px; }
                  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
                  td, th { border: 1px solid #ddd; padding: 8px; }
                  th { font-weight: 600; background: #f9f9f9; }
                  a { color: #007bff; text-decoration: underline; }
                `,
                base_url: '/tinymce',
                suffix: '.min',
              }}
            />
          </Suspense>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-2 mt-auto">
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
