import { motion, AnimatePresence } from 'framer-motion'
import { X, Megaphone, ChevronDown, ChevronUp, Eye, Shield, Globe, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Select from '@/components/UI/Select'

interface FeatureUpdate {
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

interface MinorVersionGroup {
  minorVersion: string
  features: FeatureUpdate[]
  isLatest: boolean
}

interface MajorVersionGroup {
  majorVersion: string
  minorGroups: MinorVersionGroup[]
  latestDate: string
}

interface NewFeaturesModalProps {
  isOpen: boolean
  onClose: () => void
  initialViewMode?: 'barberView' | 'adminView'
  userId?: string
}

export default function NewFeaturesModal({ isOpen, onClose, initialViewMode = 'barberView', userId }: NewFeaturesModalProps) {
  const [majorVersions, setMajorVersions] = useState<MajorVersionGroup[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'barberView' | 'adminView'>(initialViewMode)
  const [expandedMinorVersion, setExpandedMinorVersion] = useState<string | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const className = 'tutorial-hide-features'
    if (isOpen) {
      document.body.classList.add(className)
    } else {
      document.body.classList.remove(className)
    }

    return () => {
      document.body.classList.remove(className)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      fetchFeatures()
      
      // Update user's last read timestamp if userId is provided
      if (userId) {
        updateLastReadTimestamp()
      }
    }
  }, [isOpen, viewMode, userId])

  const updateLastReadTimestamp = async () => {
    if (!userId) return
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ last_read_feature_updates: new Date().toISOString() })
        .eq('user_id', userId)

      if (error) {
        console.error('Error updating last read timestamp:', error)
      }
    } catch (error) {
      console.error('Error updating last read timestamp:', error)
    }
  }

  const fetchFeatures = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('feature_updates')
        .select('*')
        .order('released_at', { ascending: false })

      // Filter based on view mode
      if (viewMode === 'barberView') {
        query = query.eq('is_published', true)
      } else {
        // adminView: exclude only if admin_view_excluded is true
        query = query.eq('admin_view_excluded', false)
      }

      const { data, error } = await query

      if (error) throw error

      // Group by major version, then by minor version
      const grouped = groupByVersions(data || [])
      setMajorVersions(grouped)
      
      // Auto-expand only the globally latest minor version
      let latestMinorVersion: string | null = null
      grouped.forEach(major => {
        major.minorGroups.forEach(minorGroup => {
          if (minorGroup.isLatest) {
            latestMinorVersion = `${major.majorVersion}.${minorGroup.minorVersion}`
          }
        })
      })
      setExpandedMinorVersion(latestMinorVersion)
      setCurrentPage(0)
    } catch (error) {
      console.error('Error fetching features:', error)
    } finally {
      setLoading(false)
    }
  }

  const groupByVersions = (features: FeatureUpdate[]): MajorVersionGroup[] => {
    const majorGroups = new Map<string, Map<string, FeatureUpdate[]>>()
    let globalLatestVersion: string | null = null
    let globalLatestDate: string | null = null

    features.forEach(feature => {
      if (!feature.version) return
      const parts = feature.version.split('.')
      const majorVersion = parts[0]
      const minorVersion = parts[1]
      
      // Track global latest
      if (!globalLatestDate || feature.released_at > globalLatestDate) {
        globalLatestDate = feature.released_at
        globalLatestVersion = `${majorVersion}.${minorVersion}`
      }
      
      if (!majorGroups.has(majorVersion)) {
        majorGroups.set(majorVersion, new Map())
      }
      
      const minorMap = majorGroups.get(majorVersion)!
      if (!minorMap.has(minorVersion)) {
        minorMap.set(minorVersion, [])
      }
      minorMap.get(minorVersion)!.push(feature)
    })

    // Convert to array structure
    const result: MajorVersionGroup[] = []
    majorGroups.forEach((minorMap, majorVersion) => {
      const minorGroups: MinorVersionGroup[] = []
      
      // Sort minor versions descending
      const sortedMinorVersions = Array.from(minorMap.keys()).sort((a, b) => parseInt(b) - parseInt(a))
      
      sortedMinorVersions.forEach((minorVersion) => {
        const features = minorMap.get(minorVersion)!
        const versionKey = `${majorVersion}.${minorVersion}`
        
        // Sort features within minor group by patch version (descending)
        features.sort((a, b) => {
          const patchA = parseInt(a.version!.split('.')[2])
          const patchB = parseInt(b.version!.split('.')[2])
          return patchB - patchA
        })

        minorGroups.push({
          minorVersion,
          features,
          isLatest: versionKey === globalLatestVersion
        })
      })

      result.push({
        majorVersion,
        minorGroups,
        latestDate: minorGroups[0]?.features[0]?.released_at || ''
      })
    })

    // Sort major versions descending
    result.sort((a, b) => parseInt(b.majorVersion) - parseInt(a.majorVersion))

    return result
  }

  const toggleMinorVersion = (majorVersion: string, minorVersion: string) => {
    const key = `${majorVersion}.${minorVersion}`
    
    // If clicking the already open one, close it; otherwise open the new one
    if (expandedMinorVersion === key) {
      setExpandedMinorVersion(null)
    } else {
      setExpandedMinorVersion(key)
    }
  }

  const getCategoryBadge = (category: string) => {
    const badges = {
      feature: 'badge-sage',
      improvement: 'badge-info',
      bugfix: 'badge-danger',
      announcement: '',
    }
    return badges[category as keyof typeof badges] ?? badges.feature
  }

  const handleMajorChange = (value: string) => {
    const newPage = majorVersions.findIndex(group => group.majorVersion === value)
    if (newPage === -1) return
    setCurrentPage(newPage)

    const newGroup = majorVersions[newPage]
    if (newGroup) {
      const latestMinor = newGroup.minorGroups.find(g => g.isLatest)
      if (latestMinor) {
        setExpandedMinorVersion(`${newGroup.majorVersion}.${latestMinor.minorVersion}`)
      } else {
        setExpandedMinorVersion(null)
      }
    }
  }

  if (!isOpen) return null

  const currentGroup = majorVersions[currentPage]
  const majorOptions = majorVersions.map((group) => ({
    value: group.majorVersion,
    label: `Version ${group.majorVersion}`,
  }))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`modal-backdrop flex items-center justify-center p-4 ${!userId ? 'pt-24' : ''}`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-features-title"
        onClick={(e) => e.stopPropagation()}
        className={`modal-surface w-full flex flex-col overflow-hidden mb-16 sm:mb-0 ${
          !userId ? 'max-w-4xl h-[75vh]' : 'max-w-5xl h-[85vh]'
        }`}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-raised">
              <Megaphone className="h-[18px] w-[18px] text-sage" strokeWidth={1.75} />
            </div>
            <div>
              <h2 id="new-features-title" className="text-[15px] font-semibold tracking-tight text-ivory">
                What's New
              </h2>
              <p className="text-xs text-gray-500">Latest updates to Corva</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle - Only show for admins */}
            {initialViewMode === 'adminView' && (
              <div className="segmented">
                <button
                  type="button"
                  onClick={() => setViewMode('barberView')}
                  data-active={viewMode === 'barberView'}
                  className="segmented-item flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                  User View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('adminView')}
                  data-active={viewMode === 'adminView'}
                  className="segmented-item flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Admin View
                </button>
              </div>
            )}

            {majorOptions.length > 1 && currentGroup && (
              <div className="w-44">
                <Select
                  options={majorOptions}
                  value={currentGroup.majorVersion}
                  onChange={handleMajorChange}
                />
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="btn btn-ghost btn-sm h-9 w-9 !px-0"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Content - Fixed Height */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-7 h-7 border-2 border-white/[0.08] border-t-sage rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Loading features...</p>
              </div>
            </div>
          ) : majorVersions.length === 0 ? (
            <div className="empty-state h-full">
              <Megaphone strokeWidth={1.75} />
              <strong>No updates yet</strong>
              <span>Check back soon for new features!</span>
            </div>
          ) : currentGroup ? (
            <div className="space-y-3">
              {/* Minor Version Groups */}
              {currentGroup.minorGroups.map((minorGroup) => {
                const key = `${currentGroup.majorVersion}.${minorGroup.minorVersion}`
                const isExpanded = expandedMinorVersion === key

                return (
                  <div key={key} className="panel overflow-hidden">
                    {/* Minor Version Header */}
                    <button
                      type="button"
                      onClick={() => toggleMinorVersion(currentGroup.majorVersion, minorGroup.minorVersion)}
                      aria-expanded={isExpanded}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-ivory tabular-nums">
                          Version {currentGroup.majorVersion}.{minorGroup.minorVersion}
                        </span>
                        <span className="badge tabular-nums">
                          {minorGroup.features.length} {minorGroup.features.length === 1 ? 'update' : 'updates'}
                        </span>
                        {minorGroup.isLatest && (
                          <span className="badge badge-sage">Latest</span>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 shrink-0 text-gray-500" strokeWidth={1.75} />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0 text-gray-500" strokeWidth={1.75} />
                      )}
                    </button>

                    {/* Features List - Collapsible */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="divide-y divide-white/[0.06] border-t border-white/[0.07]">
                            {minorGroup.features.map((feature) => (
                              <div key={feature.id} className="px-4 py-4">
                                {/* Feature Header - Single Row */}
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                      <span className="badge font-mono tabular-nums">
                                        v{feature.version}
                                      </span>
                                      <span className={`badge ${getCategoryBadge(feature.category)}`}>
                                        {feature.category.charAt(0).toUpperCase() + feature.category.slice(1)}
                                      </span>
                                      {viewMode === 'adminView' && !feature.is_published && (
                                        <span className="badge badge-warn">Draft</span>
                                      )}
                                    </div>
                                    <h4 className="text-sm font-semibold text-ivory leading-snug">
                                      {feature.title}
                                    </h4>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
                                    <span className="text-xs text-gray-500 tabular-nums">
                                      {new Date(feature.released_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </span>
                                    {viewMode === 'adminView' && (
                                      <span
                                        className="flex items-center gap-1 text-gray-500"
                                        title={feature.platform === 'both' ? 'Web + mobile' : feature.platform === 'web' ? 'Web' : 'Mobile'}
                                      >
                                        {feature.platform !== 'mobile' && <Globe className="w-3.5 h-3.5" strokeWidth={1.75} />}
                                        {feature.platform !== 'web' && <Smartphone className="w-3.5 h-3.5" strokeWidth={1.75} />}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Description */}
                                <div className="text-[13px] leading-relaxed">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      h1: ({node, ...props}) => <h1 className="text-base font-semibold text-ivory mt-4 mb-2 first:mt-0" {...props} />,
                                      h2: ({node, ...props}) => <h2 className="text-[15px] font-semibold text-ivory mt-3 mb-2 first:mt-0" {...props} />,
                                      h3: ({node, ...props}) => <h3 className="text-sm font-semibold text-ivory mt-3 mb-1.5 first:mt-0" {...props} />,
                                      ul: ({node, ...props}) => <ul className="list-disc pl-4 my-2 space-y-1 marker:text-gray-600" {...props} />,
                                      ol: ({node, ...props}) => <ol className="list-decimal pl-4 my-2 space-y-1 marker:text-gray-600" {...props} />,
                                      li: ({node, ...props}) => <li className="text-gray-300 leading-relaxed" {...props} />,
                                      p: ({node, ...props}) => <p className="my-2 text-gray-300 leading-relaxed" {...props} />,
                                      strong: ({node, ...props}) => <strong className="font-semibold text-ivory" {...props} />,
                                      em: ({node, ...props}) => <em className="italic text-gray-200" {...props} />,
                                      a: ({node, ...props}) => <a className="text-sage-bright underline-offset-2 hover:underline" {...props} />,
                                      code: ({node, ...props}) => {
                                        const isInline = !props.className
                                        return isInline
                                          ? <code className="text-gray-200 bg-raised border border-white/[0.07] px-1.5 py-0.5 rounded text-[11px] font-mono" {...props} />
                                          : <code className="block text-gray-200 bg-canvas border border-white/[0.07] p-3 rounded-lg text-[11px] font-mono my-2 overflow-x-auto" {...props} />
                                      },
                                    }}
                                  >
                                    {feature.description}
                                  </ReactMarkdown>
                                </div>

                                {/* Media */}
                                {(feature.image_url || feature.video_url) && (
                                  <div className="space-y-3 mt-3">
                                    {feature.image_url && (
                                      <div className="rounded-lg overflow-hidden border border-white/[0.07]">
                                        <img
                                          src={feature.image_url}
                                          alt={feature.title}
                                          className="w-full h-auto"
                                        />
                                      </div>
                                    )}
                                    {feature.video_url && (
                                      <div className="rounded-lg overflow-hidden border border-white/[0.07]">
                                        <video
                                          src={feature.video_url}
                                          controls
                                          className="w-full h-auto"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}
