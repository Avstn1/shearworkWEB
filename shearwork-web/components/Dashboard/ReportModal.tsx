'use client'

import React, { useState, useEffect, Suspense } from 'react'
import type { Editor as TinyMCEEditorType } from 'tinymce'
import { X } from 'lucide-react'

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
  const reportType = report.type

  const headerTitle =
  reportType === "weekly"
    ? "Weekly Report"
    : reportType === "weekly_comparison"
    ? "Weekly Comparison Report"
    : `Monthly Report: ${report.month} ${report.year}`;

  const [editedContent, setEditedContent] = useState(report.content || '')

  const readonly = !(isEditing && isAdmin)

  useEffect(() => {
    setEditedContent(report.content || '')
  }, [report])

  return (
    <div className="modal-backdrop flex items-center justify-center p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={headerTitle}
        className="modal-surface flex h-[95vh] w-full max-w-5xl flex-col text-ivory"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.07] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-ivory">{headerTitle}</h2>
            <p className="mt-0.5 truncate text-sm text-muted">
              {reportType
                ? `${report.month} ${report.year || ''}`
                : `Summary for ${report.month} ${report.year || ''}`}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm px-1.5">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-auto p-2 sm:p-4">
          <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading editor…</p>}>
            <TinyMCEEditor
              apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY}
              tinymceScriptSrc="/tinymce/tinymce.min.js"
              value={editedContent}
              onEditorChange={!readonly ? (newValue: string) => setEditedContent(newValue) : undefined}
              init={{
                license_key: 'gpl',
                skin: 'oxide-dark',
                content_css: 'dark',
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
                    font-size: clamp(9px, 2vw, 15px);
                    line-height: 1.6;
                    background: #151920;
                    color: #EEF1F5;
                  }
                  h1, h2, h3, h4 { font-weight: 600; color: #EEF1F5; }

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
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 0.5rem;
                    text-align: left;
                    word-break: break-word;
                    white-space: normal;
                  }
                  th {
                    font-weight: 600;
                    background: #1C212A;
                    color: #9AA3B2;
                    text-overflow: ellipsis;
                  }

                  a { color: #6BE39C; text-decoration: underline; word-break: break-all; }

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
        <div className="flex shrink-0 justify-end gap-2 border-t border-white/[0.07] px-4 py-3 sm:px-6">
          {!readonly ? (
            <>
              <button type="button" onClick={onClose} className="btn btn-glass">
                Cancel
              </button>
              <button type="button" onClick={() => onSave && onSave(editedContent)} className="btn btn-primary">
                Save
              </button>
            </>
          ) : (
            <button type="button" onClick={onClose} className="btn btn-primary">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
