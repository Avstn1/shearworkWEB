'use client'

import { useState, useMemo } from 'react'
import { Megaphone, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import 'easymde/dist/easymde.min.css'

const SimpleMDE = dynamic(() => import('react-simplemde-editor'), { ssr: false })

export interface FormData {
  title: string
  description: string
  category: 'feature' | 'improvement' | 'bugfix' | 'announcement'
  image_url: string
  video_url: string
  version: string
  platform: 'web' | 'mobile' | 'both'
  priority: number
  is_published: boolean
  admin_view_excluded: boolean
}

interface FeatureFormProps {
  platform: 'web' | 'mobile' | 'both'
  editMode: boolean
  formData: FormData
  loading: boolean
  versionValidationError: string | null
  onFormDataChange: (formData: FormData) => void
  onVersionChange: (version: string) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export default function FeatureForm({
  platform,
  editMode,
  formData,
  loading,
  versionValidationError,
  onFormDataChange,
  onVersionChange,
  onSubmit,
  onCancel,
}: FeatureFormProps) {
  
  const mdeOptions = useMemo(() => ({
    spellChecker: false,
    toolbar: ['bold', 'italic', 'heading', '|', 'unordered-list', 'ordered-list', '|', 'link', 'preview'] as any,
    placeholder: 'Detailed explanation of the feature...',
    minHeight: '200px',
    status: false,
    previewRender: (text: string) => {
      const marked = require('marked')
      return marked.parse(text)
    },
  }), [])

  // For 'both' platform, version is not required
  const requiresVersion = platform !== 'both'

  return (
    <div className="panel flex-1 overflow-y-auto min-h-0 p-5">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 flex-1">
          <Megaphone size={18} strokeWidth={1.75} className="shrink-0 text-sage" />
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[15px] font-semibold text-ivory">
              {editMode ? 'Edit Feature Update' : 'Create New Feature Update'}
            </h2>
            {editMode && formData.version && (
              <span className="badge badge-sage">
                Editing v{formData.version}
              </span>
            )}
          </div>
        </div>
        {editMode && (
          <button
            onClick={onCancel}
            className="btn btn-ghost btn-sm"
          >
            <X size={16} strokeWidth={1.75} />
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Row 1: Version (if applicable), Priority, Category */}
        <div className={`grid ${requiresVersion ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
          {requiresVersion && (
            <div>
              <label className="field-label">
                Version *
              </label>
              <input
                type="text"
                required
                value={formData.version}
                onChange={(e) => onVersionChange(e.target.value)}
                className={`field ${versionValidationError ? '!border-[#FF8F7D]' : ''}`}
                placeholder="1.0.1"
              />
              {versionValidationError && (
                <p className="text-[11px] text-[#FF8F7D] mt-1 leading-tight">{versionValidationError}</p>
              )}
            </div>
          )}

          <div>
            <label className="field-label">
              Priority
            </label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => onFormDataChange({ ...formData, priority: parseInt(e.target.value) || 0 })}
              className="field"
              placeholder="0"
            />
          </div>

          <div>
            <label className="field-label">
              Category *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => onFormDataChange({ ...formData, category: e.target.value as any })}
              className="field"
            >
              <option value="feature">Feature</option>
              <option value="improvement">Improvement</option>
              <option value="bugfix">Bug Fix</option>
              <option value="announcement">Announcement</option>
            </select>
          </div>
        </div>

        {/* Title */}
        <div className="flex-shrink-0">
          <label className="field-label">
            Title *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
            className="field"
            placeholder="New SMS Campaign Feature"
          />
        </div>

        {/* Description */}
        <div className="flex-1 flex flex-col min-h-0 flex-shrink-0">
          <label className="field-label flex-shrink-0">
            Description *
          </label>
          <div className="flex-1 overflow-hidden">
            <SimpleMDE
              value={formData.description}
              onChange={(value) => onFormDataChange({ ...formData, description: value })}
              options={mdeOptions}
            />
          </div>
        </div>

        {/* Row 2: Image URL & Video URL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-shrink-0">
          <div>
            <label className="field-label">
              Image URL <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => onFormDataChange({ ...formData, image_url: e.target.value })}
              className="field"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="field-label">
              Video URL <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={formData.video_url}
              onChange={(e) => onFormDataChange({ ...formData, video_url: e.target.value })}
              className="field"
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Admin View Exclusion Toggle - Only for drafts */}
        {!formData.is_published && (
          <div className="flex items-center gap-3 p-3 bg-canvas rounded-lg border border-white/[0.07] flex-shrink-0">
            <input
              type="checkbox"
              id="admin_view_excluded"
              checked={formData.admin_view_excluded}
              onChange={(e) => onFormDataChange({ ...formData, admin_view_excluded: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="admin_view_excluded" className="text-[13px] font-medium text-ivory cursor-pointer">
              Exclude from Admin view <span className="text-gray-500 font-normal">(drafts only)</span>
            </label>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !!versionValidationError}
          className="btn btn-primary btn-sm w-full flex-shrink-0"
        >
          {loading ? (editMode ? 'Updating...' : 'Creating...') : (editMode ? 'Update Feature' : 'Create Feature Update')}
        </button>
      </form>
    </div>
  )
}