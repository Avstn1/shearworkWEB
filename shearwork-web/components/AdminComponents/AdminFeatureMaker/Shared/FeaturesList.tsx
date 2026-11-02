'use client'

import { motion } from 'framer-motion'
import { EmptyState } from '@/components/ui/AppKit'
import { Sparkles, Eye, Edit, Monitor, ArrowLeft } from 'lucide-react'

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
      feature: 'badge-sage',
      improvement: 'badge-info',
      bugfix: 'badge-danger',
      announcement: 'badge-warn',
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
      {/* Toolbar */}
      <div className="panel flex flex-wrap items-center gap-2 p-2 flex-shrink-0">
        {showMajorMinorToggle && viewMode === 'minor' && (
          <button onClick={onBackToMajor} className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} strokeWidth={1.75} />
            Back to Major
          </button>
        )}
        <div className="flex flex-1 items-center gap-1.5 px-2 text-[13px] font-medium text-ivory whitespace-nowrap">
          {!showMajorMinorToggle ? (
            <>
              <Sparkles size={16} strokeWidth={1.75} className="text-sage" />
              All Updates
            </>
          ) : viewMode === 'major' ? (
            <>
              <Sparkles size={16} strokeWidth={1.75} className="text-sage" />
              Major Updates
            </>
          ) : (
            <>
              <Eye size={16} strokeWidth={1.75} className="text-sage" />
              Minor Updates
            </>
          )}
        </div>
        <button onClick={handleCreateClick} className="btn btn-primary btn-sm">
          <Edit size={16} strokeWidth={1.75} />
          Create Feature
        </button>
        <button onClick={onShowPreview} className="btn btn-glass btn-sm">
          <Monitor size={16} strokeWidth={1.75} />
          Preview Modal
        </button>
      </div>

      {/* Features List - Scrollable */}
      <div className="panel flex-1 p-4 overflow-y-auto min-h-0">
        <h2 className="panel-title mb-3">
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
            <EmptyState icon={Sparkles} title="No updates found" />
          ) : (
            <div className="space-y-2">
              {majorUpdates.map((major) => (
                <motion.div
                  key={major.version}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => onMajorClick(major.version)}
                  className="bg-raised border border-white/[0.07] rounded-lg p-3.5 hover:border-white/[0.12] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} strokeWidth={1.75} className="text-sage" />
                      <span className="text-[15px] font-semibold text-ivory tabular-nums">
                        Version {major.version}
                      </span>
                    </div>
                    <span className="badge tabular-nums">
                      {major.count} {major.count === 1 ? 'update' : 'updates'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Latest: {new Date(major.latestDate).toLocaleDateString()}
                  </p>
                </motion.div>
              ))}
            </div>
          )
        ) : (
          // Minor Updates View OR 'both' platform view
          displayedFeatures.length === 0 ? (
            <EmptyState icon={Sparkles} title={platform === 'both' ? 'No updates found' : 'No minor updates found'} />
          ) : (
            <div className="space-y-2">
              {displayedFeatures.map((feature) => (
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-raised border rounded-lg p-3 transition-colors ${
                    editingId === feature.id ? 'border-sage/60' : 'border-white/[0.07] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => onEditFeature(feature)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {feature.version && (
                          <span className="badge font-mono">
                            v{feature.version}
                          </span>
                        )}
                        <span className={`badge capitalize ${getCategoryBadge(feature.category)}`}>
                          {feature.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-ivory line-clamp-2">
                        {feature.title}
                      </h3>
                    </div>
                    <div className="flex items-start gap-2 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onTogglePublish(feature.id, feature.is_published)
                        }}
                        className={`btn btn-sm !h-7 !px-2 !text-[11px] whitespace-nowrap ${
                          feature.is_published ? 'btn-glass' : 'btn-bright'
                        }`}
                      >
                        {feature.is_published ? 'Click to deactivate' : 'Click to publish'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteFeature(feature.id)
                        }}
                        className="btn btn-ghost btn-sm !h-7 !px-2 !text-[11px] !text-[#D99A8B] whitespace-nowrap"
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
                    <span className="text-xs text-gray-500 tabular-nums">
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