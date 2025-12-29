import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Bell, ChevronDown, ChevronUp, Eye, Shield } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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

  const getCategoryColor = (category: string) => {
    const colors = {
      feature: 'bg-[#4a7c59]/20 text-[#a8d5ba] border-[#4a7c59]/40',
      improvement: 'bg-[#5a7c9a]/20 text-[#a8c5d5] border-[#5a7c9a]/40',
      bugfix: 'bg-[#7a4444]/20 text-[#d49999] border-[#7a4444]/40',
      announcement: 'bg-[#6b5a7c]/20 text-[#c5a8d5] border-[#6b5a7c]/40',
    }
    return colors[category as keyof typeof colors] || colors.feature
  }

  const handlePrevious = () => {
    const newPage = Math.max(0, currentPage - 1)
    setCurrentPage(newPage)
    
    // Only auto-expand if this page has the globally latest version
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

  const handleNext = () => {
    const newPage = Math.min(majorVersions.length - 1, currentPage + 1)
    setCurrentPage(newPage)
    
    // Only auto-expand if this page has the globally latest version
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 ${!userId ? 'pt-24' : ''}`}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className={`bg-gradient-to-br from-[#1a1f1b] to-[#2e3b2b] border border-[#55694b]/50 rounded-3xl shadow-2xl w-full flex flex-col overflow-hidden ${
          !userId ? 'max-w-4xl h-[75vh]' : 'max-w-5xl h-[85vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#55694b]/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-400/20 to-lime-400/20 rounded-xl">
              <Bell className="w-6 h-6 text-lime-300" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-lime-300 bg-clip-text text-transparent">
                What's New
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* View Mode Toggle - Only show for admins */}
            {initialViewMode === 'adminView' && (
              <div className="flex gap-1 bg-[#2a2a2a] p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('barberView')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 ${
                    viewMode === 'barberView'
                      ? 'bg-[#4a7c59]/40 text-[#a8d5ba]'
                      : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  User View
                </button>
                <button
                  onClick={() => setViewMode('adminView')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 flex items-center gap-1.5 ${
                    viewMode === 'adminView'
                      ? 'bg-[#6b5a7c]/40 text-[#c5a8d5]'
                      : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Admin View
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content - Fixed Height */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-[#55694b]/30 border-t-[#6b8e4e] rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Loading features...</p>
              </div>
            </div>
          ) : majorVersions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No updates yet</p>
                <p className="text-gray-500 text-sm mt-2">Check back soon for new features!</p>
              </div>
            </div>
          ) : currentGroup ? (
            <div className="space-y-4">
              {/* Minor Version Groups */}
              <div className="space-y-4">
                {currentGroup.minorGroups.map((minorGroup) => {
                  const key = `${currentGroup.majorVersion}.${minorGroup.minorVersion}`
                  const isExpanded = expandedMinorVersion === key
                  
                  return (
                    <div key={key} className="border border-[#55694b]/30 rounded-2xl overflow-hidden">
                      {/* Minor Version Header */}
                      <button
                        onClick={() => toggleMinorVersion(currentGroup.majorVersion, minorGroup.minorVersion)}
                        className="w-full flex items-center justify-between p-4 bg-[#55694b]/10 hover:bg-[#55694b]/20 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-[#F1F5E9]">
                            Version {currentGroup.majorVersion}.{minorGroup.minorVersion}
                          </span>
                          <span className="px-2 py-0.5 bg-[#55694b]/40 text-[#d4e7c5] text-xs font-semibold rounded-full">
                            {minorGroup.features.length} {minorGroup.features.length === 1 ? 'update' : 'updates'}
                          </span>
                          {minorGroup.isLatest && (
                            <span className="px-2 py-0.5 bg-lime-400/20 text-lime-300 text-xs font-semibold rounded-full border border-lime-400/40">
                              Latest
                            </span>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      {/* Features List - Collapsible */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 space-y-4 bg-white/5">
                              {minorGroup.features.map((feature, index) => (
                                <div
                                  key={feature.id}
                                  className="bg-white/5 backdrop-blur-sm border border-[#55694b]/30 rounded-xl p-4"
                                >
                                  {/* Feature Header - Single Row */}
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="px-2 py-0.5 bg-[#55694b]/40 text-lime-300 text-[10px] font-mono rounded">
                                          v{feature.version}
                                        </span>
                                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-lg border ${getCategoryColor(feature.category)}`}>
                                          {feature.category.charAt(0).toUpperCase() + feature.category.slice(1)}
                                        </span>
                                        {viewMode === 'adminView' && !feature.is_published && (
                                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-semibold rounded-lg border border-amber-500/40">
                                            Draft
                                          </span>
                                        )}
                                      </div>
                                      <h4 className="text-sm font-bold text-[#F1F5E9] leading-tight">
                                        {feature.title}
                                      </h4>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
                                      <span className="text-[10px] text-gray-500">
                                        {new Date(feature.released_at).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric'
                                        })}
                                      </span>
                                      {viewMode === 'adminView' && (
                                        <span className="text-[10px] text-gray-500">
                                          {feature.platform === 'both' ? '🌐📱' : feature.platform === 'web' ? '🌐' : '📱'}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Description */}
                                  <div className="text-xs text-gray-300 leading-relaxed prose prose-invert prose-sm max-w-none
                                    prose-p:my-2 prose-p:leading-relaxed
                                    prose-headings:text-[#F1F5E9] prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
                                    prose-h1:text-base prose-h2:text-sm prose-h3:text-xs
                                    prose-strong:text-[#F1F5E9] prose-strong:font-bold
                                    prose-em:text-gray-200 prose-em:italic
                                    prose-a:text-lime-400 prose-a:no-underline hover:prose-a:underline
                                    prose-ul:my-2 prose-ul:list-disc prose-ul:pl-5
                                    prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-5
                                    prose-li:my-1
                                    prose-code:text-lime-300 prose-code:bg-[#2a2a2a] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[10px]
                                    prose-pre:bg-[#2a2a2a] prose-pre:p-3 prose-pre:rounded-lg prose-pre:overflow-x-auto">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {feature.description}
                                    </ReactMarkdown>
                                  </div>

                                  {/* Media */}
                                  {(feature.image_url || feature.video_url) && (
                                    <div className="space-y-3 mt-3">
                                      {feature.image_url && (
                                        <div className="rounded-xl overflow-hidden border border-[#55694b]/30">
                                          <img 
                                            src={feature.image_url} 
                                            alt={feature.title}
                                            className="w-full h-auto"
                                          />
                                        </div>
                                      )}
                                      {feature.video_url && (
                                        <div className="rounded-xl overflow-hidden border border-[#55694b]/30">
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
            </div>
          ) : null}
        </div>

        {/* Footer Navigation */}
        {majorVersions.length > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-[#55694b]/30 bg-[#1a1f1b]/50 flex-shrink-0">
            <button
              onClick={handlePrevious}
              disabled={currentPage === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#55694b]/40 hover:bg-[#6b8e4e]/50 text-[#F1F5E9] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Next</span>
            </button>

            <div className="flex items-center gap-2">
              {majorVersions.map((group, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentPage(index)
                    // Only auto-expand if this page has the globally latest version
                    const latestMinor = group.minorGroups.find(g => g.isLatest)
                    if (latestMinor) {
                      setExpandedMinorVersion(`${group.majorVersion}.${latestMinor.minorVersion}`)
                    } else {
                      setExpandedMinorVersion(null)
                    }
                  }}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentPage 
                      ? 'w-8 bg-lime-400' 
                      : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={currentPage === majorVersions.length - 1}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#55694b]/40 hover:bg-[#6b8e4e]/50 text-[#F1F5E9] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
            >
              <span className="text-sm font-medium">Previous</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}