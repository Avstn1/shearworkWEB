'use client'

import { motion } from 'framer-motion'
import { Sparkles, Eye, Edit, Monitor } from 'lucide-react'

export interface FeatureUpdate {
  id: string
  title: string
  description: string
  category: 'feature' | 'improvement' | 'bugfix' | 'announcement'
  image_url: string | null
  video_url: string | null
  version: string | null
  platform: 'web' | 'mobile' | 'both'
  priority: number
  is_published: boolean
  released_at: string
  created_at: string
  admin_view_excluded: boolean
}

export interface MajorUpdate {
  version: string
  count: number
  latestDate: string
}

interface FeaturesListProps {
  platform: 'web' | 'mobile' | 'both'
  viewMode: 'major' | 'minor'
  majorUpdates: MajorUpdate[]
  displayedFeatures: FeatureUpdate[]
  selectedMajorVersion: string | null
  editingId: string | null
  hasUnsavedChanges: boolean
  onMajorClick: (version: string) => void
  onBackToMajor: () => void
  onCreateFeature: () => void
  onShowPreview: () => void
  onEditFeature: (feature: FeatureUpdate) => void
  onTogglePublish: (featureId: string, currentStatus: boolean) => void
  onDeleteFeature: (featureId: string) => void
  onShowUnsavedWarning: () => void
}

export default function FeaturesList({
  platform,
  viewMode,
  majorUpdates,
  displayedFeatures,
  selectedMajorVersion,
  editingId,
  hasUnsavedChanges,
  onMajorClick,
  onBackToMajor,
  onCreateFeature,
  onShowPreview,
  onEditFeature,
  onTogglePublish,
  onDeleteFeature,
  onShowUnsavedWarning,
}: FeaturesListProps) {
  
  const getCategoryBadge = (category: string) => {
    const styles = {
      feature: 'bg-lime-300/20 text-lime-300 border-lime-400/30',
      improvement: 'bg-blue-300/20 text-blue-300 border-blue-400/30',
      bugfix: 'bg-red-300/20 text-red-300 border-red-400/30',
      announcement: 'bg-purple-300/20 text-purple-300 border-purple-400/30',
    }
    return styles[category as keyof typeof styles] || styles.feature
  }

  const handleCreateClick = () => {
    if (hasUnsavedChanges) {
      onShowUnsavedWarning()
    } else {
      onCreateFeature()
    }
  }

  // For 'both' platform, we don't show version-based views
  const showMajorMinorToggle = platform !== 'both'

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="lg:w-1/3 flex flex-col gap-3 min-h-0"
    >
      {/* Toggle Buttons */}
      <div className="flex gap-2 bg-[#1f2420]/95 backdrop-blur-md p-2 rounded-2xl border border-[#55694b]/50 flex-shrink-0">
        {showMajorMinorToggle ? (
          viewMode === 'major' ? (
            <>
              <div className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-[#55694b]/40 text-[#d4e7c5] flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Major Updates
              </div>
              <button
                onClick={handleCreateClick}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#4a7c59]/40 hover:bg-[#4a7c59]/60 text-[#a8d5ba] transition-all duration-300 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Create Feature
              </button>
              <button
                onClick={onShowPreview}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#2a2a2a] text-white/70 hover:text-white/90 hover:bg-[#3a3a3a] transition-all duration-300 flex items-center gap-2"
              >
                <Monitor className="w-4 h-4" />
                Preview Modal
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onBackToMajor}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-[#2a2a2a] text-white/60 hover:text-white/80 transition-all duration-300"
              >
                ← Back to Major
              </button>
              <div className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-[#4d7c0f]/40 text-[#d4e7c5] flex items-center justify-center gap-2">
                <Eye className="w-4 h-4" />
                Minor Updates
              </div>
              <button
                onClick={handleCreateClick}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#4a7c59]/40 hover:bg-[#4a7c59]/60 text-[#a8d5ba] transition-all duration-300 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Create Feature
              </button>
              <button
                onClick={onShowPreview}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#2a2a2a] text-white/70 hover:text-white/90 hover:bg-[#3a3a3a] transition-all duration-300 flex items-center gap-2"
              >
                <Monitor className="w-4 h-4" />
                Preview Modal
              </button>
            </>
          )
        ) : (
          // For 'both' platform - no major/minor, just list view
          <>
            <div className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-[#55694b]/40 text-[#d4e7c5] flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              All Updates
            </div>
            <button
              onClick={handleCreateClick}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#4a7c59]/40 hover:bg-[#4a7c59]/60 text-[#a8d5ba] transition-all duration-300 flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Create Feature
            </button>
            <button
              onClick={onShowPreview}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#2a2a2a] text-white/70 hover:text-white/90 hover:bg-[#3a3a3a] transition-all duration-300 flex items-center gap-2"
            >
              <Monitor className="w-4 h-4" />
              Preview Modal
            </button>
          </>
        )}
      </div>

      {/* Features List - Scrollable */}
      <div className="flex-1 bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-4 overflow-y-auto min-h-0">
        <h2 className="text-lg font-semibold mb-4 text-[#F1F5E9]">
          {platform === 'both' 
            ? 'Web & Mobile Updates'
            : viewMode === 'major' 
              ? 'Major Versions' 
              : `Version ${selectedMajorVersion} Updates`
          }
        </h2>
        
        {showMajorMinorToggle && viewMode === 'major' ? (
          // Major Updates View
          majorUpdates.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No updates found</p>
          ) : (
            <div className="space-y-3">
              {majorUpdates.map((major) => (
                <motion.div
                  key={major.version}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onMajorClick(major.version)}
                  className="bg-[#1f2420]/80 border border-[#55694b]/30 rounded-xl p-4 hover:border-[#55694b]/80 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#9ca87f]" />
                      <span className="text-2xl font-bold text-[#F1F5E9]">
                        Version {major.version}
                      </span>
                    </div>
                    <span className="px-3 py-1 bg-[#55694b]/30 text-[#d4e7c5] text-xs font-bold rounded-full border border-[#55694b]/50">
                      {major.count} {major.count === 1 ? 'update' : 'updates'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Latest: {new Date(major.latestDate).toLocaleDateString()}
                  </p>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          // Minor Updates View OR 'both' platform view
          displayedFeatures.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {platform === 'both' ? 'No updates found' : 'No minor updates found'}
            </p>
          ) : (
            <div className="space-y-3">
              {displayedFeatures.map((feature) => (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-[#1f2420]/80 border rounded-xl p-3 transition-all duration-300 ${
                    editingId === feature.id ? 'border-[#6b8e4e] ring-2 ring-[#6b8e4e]/50' : 'border-[#55694b]/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => onEditFeature(feature)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {feature.version && (
                          <span className="px-2 py-0.5 bg-[#55694b]/30 text-lime-300 text-xs font-mono rounded">
                            v{feature.version}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getCategoryBadge(feature.category)}`}>
                          {feature.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-[#F1F5E9] line-clamp-2">
                        {feature.title}
                      </h3>
                    </div>
                    <div className="flex items-start gap-2 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onTogglePublish(feature.id, feature.is_published)
                        }}
                        className={`px-2 py-1 rounded-lg transition-all duration-200 text-[10px] font-medium whitespace-nowrap ${
                          feature.is_published
                            ? 'bg-[#6b5b3a]/30 hover:bg-[#6b5b3a]/40 border border-[#6b5b3a]/50 text-[#d4a574]'
                            : 'bg-[#4a7c59]/30 hover:bg-[#4a7c59]/40 border border-[#4a7c59]/50 text-[#a8d5ba]'
                        }`}
                      >
                        {feature.is_published ? 'Click to deactivate' : 'Click to publish'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteFeature(feature.id)
                        }}
                        className="px-2 py-1 rounded-lg bg-[#7a4444]/30 hover:bg-[#7a4444]/40 border border-[#7a4444]/50 text-[#d49999] transition-all duration-200 text-[10px] font-medium whitespace-nowrap"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p 
                    className="text-xs text-gray-400 line-clamp-2 mb-2 cursor-pointer"
                    onClick={() => onEditFeature(feature)}
                  >
                    {feature.description}
                  </p>
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => onEditFeature(feature)}
                  >
                    <span className="text-xs text-gray-500">
                      Priority: {feature.priority}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}
      </div>
    </motion.div>
  )
}