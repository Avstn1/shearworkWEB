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
    <div className="bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-6 flex-1 overflow-y-auto min-h-0">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 flex-1">
          <Megaphone className="w-6 h-6 text-[#6b8e4e]" />
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-[#F1F5E9]">
              {editMode ? 'Edit Feature Update' : 'Create New Feature Update'}
            </h2>
            {editMode && formData.version && (
              <span className="text-xs text-[#9ca87f] bg-[#55694b]/20 px-3 py-1 rounded-full border border-[#55694b]/40">
                Editing v{formData.version}
              </span>
            )}
          </div>
        </div>
        {editMode && (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 transition-all duration-300 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Row 1: Version (if applicable), Priority, Category */}
        <div className={`grid ${requiresVersion ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
          {requiresVersion && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-[#F1F5E9]">
                Version *
              </label>
              <input
                type="text"
                required
                value={formData.version}
                onChange={(e) => onVersionChange(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg bg-[#2f3a2d] border text-[#F1F5E9] text-sm focus:outline-none focus:ring-1 focus:ring-[#6b8e4e]/50 focus:border-[#6b8e4e] ${
                  versionValidationError ? 'border-red-400' : 'border-[#55694b]'
                }`}
                placeholder="1.0.1"
              />
              {versionValidationError && (
                <p className="text-[10px] text-red-400 mt-0.5 leading-tight">{versionValidationError}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-[#F1F5E9]">
              Priority
            </label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => onFormDataChange({ ...formData, priority: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] text-sm focus:outline-none focus:ring-1 focus:ring-[#6b8e4e]/50 focus:border-[#6b8e4e]"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-[#F1F5E9]">
              Category *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => onFormDataChange({ ...formData, category: e.target.value as any })}
              className="w-full px-3 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] text-sm focus:outline-none focus:ring-1 focus:ring-[#6b8e4e]/50 focus:border-[#6b8e4e]"
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
          <label className="block text-xs font-semibold mb-1.5 text-[#F1F5E9]">
            Title *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] text-sm focus:outline-none focus:ring-1 focus:ring-[#6b8e4e]/50 focus:border-[#6b8e4e]"
            placeholder="New SMS Campaign Feature"
          />
        </div>

        {/* Description */}
        <div className="flex-1 flex flex-col min-h-0 flex-shrink-0">
          <label className="block text-xs font-semibold mb-1.5 text-[#F1F5E9] flex-shrink-0">
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
            <label className="block text-xs font-semibold mb-1.5 text-[#F1F5E9]">
              Image URL <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={formData.image_url}
              onChange={(e) => onFormDataChange({ ...formData, image_url: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] text-sm focus:outline-none focus:ring-1 focus:ring-[#6b8e4e]/50 focus:border-[#6b8e4e]"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-[#F1F5E9]">
              Video URL <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={formData.video_url}
              onChange={(e) => onFormDataChange({ ...formData, video_url: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] text-sm focus:outline-none focus:ring-1 focus:ring-[#6b8e4e]/50 focus:border-[#6b8e4e]"
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Admin View Exclusion Toggle - Only for drafts */}
        {!formData.is_published && (
          <div className="flex items-center gap-3 p-3 bg-[#1f2420]/50 rounded-xl border border-[#55694b]/30 flex-shrink-0">
            <input
              type="checkbox"
              id="admin_view_excluded"
              checked={formData.admin_view_excluded}
              onChange={(e) => onFormDataChange({ ...formData, admin_view_excluded: e.target.checked })}
              className="w-4 h-4 rounded border-[#55694b] bg-[#2f3a2d] text-amber-500 focus:ring-1 focus:ring-amber-500/50"
            />
            <label htmlFor="admin_view_excluded" className="text-xs font-semibold text-[#F1F5E9] cursor-pointer">
              Exclude from Admin view <span className="text-gray-500 font-normal">(drafts only)</span>
            </label>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !!versionValidationError}
          className="w-full py-2.5 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-[#55694b] hover:bg-[#6b8e4e] text-[#F1F5E9] shadow-md text-sm flex-shrink-0"
        >
          {loading ? (editMode ? 'Updating...' : 'Creating...') : (editMode ? 'Update Feature' : 'Create Feature Update')}
        </button>
      </form>
    </div>
  )
}