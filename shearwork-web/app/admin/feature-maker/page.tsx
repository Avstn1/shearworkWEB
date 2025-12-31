'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabaseClient'
import { Megaphone, Sparkles, Eye, Edit, X, AlertTriangle, Monitor, Trash2, EyeOff, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import NewFeaturesModal from '@/components/Dashboard/NewFeaturesModal'
import VersionConflictModal from '@/components/AdminComponents/AdminFeatureMaker/Modals/VersionConflictModal'
import PublishConfirmationModal from '@/components/AdminComponents/AdminFeatureMaker/Modals/PublishConfirmationModal'
import VersionIncrementWarningModal from '@/components/AdminComponents/AdminFeatureMaker/Modals/VersionIncrementWarningModal'
import UnsavedChangesModal from '@/components/AdminComponents/AdminFeatureMaker/Modals/UnsavedChangesModal'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import 'easymde/dist/easymde.min.css'

const SimpleMDE = dynamic(() => import('react-simplemde-editor'), { ssr: false })

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

interface MajorUpdate {
  version: string
  count: number
  latestDate: string
}

export default function FeatureMakerPage() {
  const router = useRouter()
  
  const [loading, setLoading] = useState(false)
  const [allFeatures, setAllFeatures] = useState<FeatureUpdate[]>([])
  const [displayedFeatures, setDisplayedFeatures] = useState<FeatureUpdate[]>([])
  const [majorUpdates, setMajorUpdates] = useState<MajorUpdate[]>([])
  const [selectedMajorVersion, setSelectedMajorVersion] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'major' | 'minor'>('major')
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showVersionWarning, setShowVersionWarning] = useState(false)
  const [existingVersionId, setExistingVersionId] = useState<string | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [versionChangeWarning, setVersionChangeWarning] = useState<{
    show: boolean
    newVersionExists: boolean
    existingId: string | null
  }>({ show: false, newVersionExists: false, existingId: null })
  
  const [versionValidationError, setVersionValidationError] = useState<string | null>(null)
  const [versionIncrementWarning, setVersionIncrementWarning] = useState<{
    show: boolean
    version: string
    type: 'major' | 'minor'
  } | null>(null)
  
  const [publishConfirmation, setPublishConfirmation] = useState<{
    show: boolean
    featureId: string
    currentStatus: boolean
  } | null>(null)
  
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'feature' as 'feature' | 'improvement' | 'bugfix' | 'announcement',
    image_url: '',
    video_url: '',
    version: '',
    platform: 'both' as 'web' | 'mobile' | 'both',
    priority: 0,
    is_published: false,
    admin_view_excluded: false,
  })

  // SimpleMDE editor options
  const mdeOptions = useMemo(() => ({
    spellChecker: false,
    toolbar: ['bold', 'italic', 'heading', '|', 'unordered-list', 'ordered-list', '|', 'link', 'preview'] as any,
    placeholder: 'Detailed explanation of the feature...',
    minHeight: '200px',
    status: false,
    previewRender: (text: string) => {
      // This ensures markdown is properly parsed in preview
      const marked = require('marked');
      return marked.parse(text);
    },
  }), [])

  // Version validation helpers
  const parseVersion = (version: string): number[] | null => {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
    if (!match) return null
    return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
  }

  const compareVersions = (v1: number[], v2: number[]): number => {
    for (let i = 0; i < 3; i++) {
      if (v1[i] > v2[i]) return 1
      if (v1[i] < v2[i]) return -1
    }
    return 0
  }

  const getLatestVersion = (): number[] | null => {
    if (allFeatures.length === 0) return null
    
    let latest: number[] | null = null
    allFeatures.forEach(feature => {
      if (!feature.version) return
      const parsed = parseVersion(feature.version)
      if (!parsed) return
      
      if (!latest || compareVersions(parsed, latest) > 0) {
        latest = parsed
      }
    })
    return latest
  }

  const validateNewVersion = (versionStr: string): { valid: boolean; error?: string; needsConfirmation?: boolean } => {
    // Check format
    const parsed = parseVersion(versionStr)
    if (!parsed) {
      return { valid: false, error: 'Version must follow format x.x.x (e.g., 1.0.0, 2.5.3)' }
    }

    const [major, minor, patch] = parsed

    // Cannot start with 0.x.x
    if (major === 0) {
      return { valid: false, error: 'Major version cannot be 0' }
    }

    const latest = getLatestVersion()
    if (!latest) return { valid: true } // First version ever

    const [latestMajor, latestMinor, latestPatch] = latest

    // Cannot be less than latest
    if (compareVersions(parsed, latest) < 0) {
      return { valid: false, error: `Version ${versionStr} is less than the latest version ${latest.join('.')}` }
    }

    // Cannot be equal to latest (unless editing)
    if (compareVersions(parsed, latest) === 0 && !editingId) {
      return { valid: false, error: `Version ${versionStr} already exists` }
    }

    // Check for version skipping
    if (major === latestMajor && minor === latestMinor) {
      // Same major.minor, can only increment patch by 1
      if (patch !== latestPatch + 1) {
        return { valid: false, error: `Cannot skip versions. Latest is ${latest.join('.')}, next must be ${latestMajor}.${latestMinor}.${latestPatch + 1}` }
      }
    } else if (major === latestMajor && minor > latestMinor) {
      // Same major, incrementing minor
      if (minor !== latestMinor + 1) {
        return { valid: false, error: `Cannot skip minor versions. Latest is ${latest.join('.')}, next minor must be ${latestMajor}.${latestMinor + 1}.x` }
      }
      // Must start with x.0 or x.1
      if (patch === 0) {
        return { valid: true, needsConfirmation: true }
      } else if (patch === 1) {
        return { valid: true, needsConfirmation: true }
      } else {
        return { valid: false, error: `When incrementing minor version, patch must be 0 or 1 (e.g., ${major}.${minor}.0 or ${major}.${minor}.1)` }
      }
    } else if (major > latestMajor) {
      // Incrementing major version
      if (major !== latestMajor + 1) {
        return { valid: false, error: `Cannot skip major versions. Latest is ${latest.join('.')}, next major must be ${latestMajor + 1}.x.x` }
      }
      // Must be x.0.0 or x.0.1
      if (minor !== 0) {
        return { valid: false, error: `When incrementing major version, format must be ${major}.0.0 or ${major}.0.1` }
      }
      if (patch !== 0 && patch !== 1) {
        return { valid: false, error: `When incrementing major version, format must be ${major}.0.0 or ${major}.0.1` }
      }
      return { valid: true, needsConfirmation: true }
    }

    return { valid: true }
  }

  useEffect(() => {
    fetchFeatures()
  }, [])

  useEffect(() => {
    buildMajorUpdates()
  }, [allFeatures])

  useEffect(() => {
    if (viewMode === 'major') {
      setDisplayedFeatures([])
    } else if (selectedMajorVersion) {
      filterMinorUpdates(selectedMajorVersion)
    }
  }, [viewMode, selectedMajorVersion, allFeatures])

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_updates')
        .select('*')
        .order('released_at', { ascending: false })

      if (error) throw error
      setAllFeatures(data || [])
    } catch (error) {
      console.error('Error fetching features:', error)
      toast.error('Failed to load features')
    }
  }

  const buildMajorUpdates = () => {
    const majorVersionMap = new Map<string, { count: number; latestDate: string }>()
    
    allFeatures.forEach(feature => {
      if (!feature.version) return
      
      const majorVersion = feature.version.split('.')[0]
      const existing = majorVersionMap.get(majorVersion)
      
      if (!existing) {
        majorVersionMap.set(majorVersion, {
          count: 1,
          latestDate: feature.released_at
        })
      } else {
        majorVersionMap.set(majorVersion, {
          count: existing.count + 1,
          latestDate: feature.released_at > existing.latestDate ? feature.released_at : existing.latestDate
        })
      }
    })

    const majors: MajorUpdate[] = Array.from(majorVersionMap.entries())
      .map(([version, data]) => ({
        version,
        count: data.count,
        latestDate: data.latestDate
      }))
      .sort((a, b) => parseInt(b.version) - parseInt(a.version))

    setMajorUpdates(majors)
  }

  const filterMinorUpdates = (majorVersion: string) => {
    const filtered = allFeatures.filter(f => 
      f.version && f.version.startsWith(`${majorVersion}.`)
    )
    setDisplayedFeatures(filtered)
  }

  const handleMajorClick = (majorVersion: string) => {
    setSelectedMajorVersion(majorVersion)
    setViewMode('minor')
  }

  const handleBackToMajor = () => {
    setViewMode('major')
    setSelectedMajorVersion(null)
    setDisplayedFeatures([])
  }

  const handleEditFeature = (feature: FeatureUpdate) => {
    setEditMode(true)
    setEditingId(feature.id)
    setFormData({
      title: feature.title,
      description: feature.description,
      category: feature.category,
      image_url: feature.image_url || '',
      video_url: feature.video_url || '',
      version: feature.version || '',
      platform: feature.platform,
      priority: feature.priority,
      is_published: feature.is_published,
      admin_view_excluded: feature.admin_view_excluded || false,
    })
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    setEditingId(null)
    setShowVersionWarning(false)
    setExistingVersionId(null)
    setFormData({
      title: '',
      description: '',
      category: 'feature',
      image_url: '',
      video_url: '',
      version: '',
      platform: 'both',
      priority: 0,
      is_published: false,
      admin_view_excluded: false,
    })
  }

  const checkVersionExists = async (version: string) => {
    if (!version.trim()) return null
    
    let query = supabase
      .from('feature_updates')
      .select('id')
      .eq('version', version)
    
    // Only add the neq filter if we have a valid editingId
    if (editingId) {
      query = query.neq('id', editingId)
    }
    
    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error('Error checking version:', error)
      return null
    }

    return data?.id || null
  }

  const handleVersionChange = async (newVersion: string) => {
    setFormData({ ...formData, version: newVersion })
    setVersionValidationError(null)
    setVersionIncrementWarning(null)

    if (!newVersion.trim()) {
      setVersionChangeWarning({ show: false, newVersionExists: false, existingId: null })
      return
    }

    // Validate version format and rules
    const validation = validateNewVersion(newVersion)
    
    if (!validation.valid) {
      setVersionValidationError(validation.error || null)
      return
    }

    // Check if version needs confirmation for major/minor increment
    if (validation.needsConfirmation) {
      const parsed = parseVersion(newVersion)
      const latest = getLatestVersion()
      if (parsed && latest) {
        const [major, minor] = parsed
        const [latestMajor, latestMinor] = latest
        
        if (major > latestMajor) {
          setVersionIncrementWarning({ 
            show: true, 
            version: newVersion,
            type: 'major'
          })
          return
        } else if (minor > latestMinor) {
          setVersionIncrementWarning({ 
            show: true, 
            version: newVersion,
            type: 'minor'
          })
          return
        }
      }
    }

    // Check if version exists in database
    const existingId = await checkVersionExists(newVersion)

    if (editMode && !existingId) {
      // Was editing, now version doesn't exist - switch to create mode behavior
      setVersionChangeWarning({ 
        show: true, 
        newVersionExists: false, 
        existingId: null 
      })
    } else if (!editMode && existingId) {
      // Was creating, now version exists - prompt to edit
      setVersionChangeWarning({ 
        show: true, 
        newVersionExists: true, 
        existingId 
      })
    } else {
      setVersionChangeWarning({ show: false, newVersionExists: false, existingId: null })
    }
  }

  const handleConfirmVersionSwitch = () => {
    if (versionChangeWarning.newVersionExists && versionChangeWarning.existingId) {
      // Switch to edit mode for existing version
      const existingFeature = allFeatures.find(f => f.id === versionChangeWarning.existingId)
      if (existingFeature) {
        handleEditFeature(existingFeature)
      }
    } else if (!versionChangeWarning.newVersionExists) {
      // Switch to create mode
      setEditMode(false)
      setEditingId(null)
      toast.success('Switched to create mode')
    }
    setVersionChangeWarning({ show: false, newVersionExists: false, existingId: null })
  }

  const handleCancelVersionSwitch = () => {
    // Revert version to original
    if (editMode && editingId) {
      const originalFeature = allFeatures.find(f => f.id === editingId)
      if (originalFeature) {
        setFormData({ ...formData, version: originalFeature.version || '' })
      }
    } else {
      setFormData({ ...formData, version: '' })
    }
    setVersionChangeWarning({ show: false, newVersionExists: false, existingId: null })
  }

  const handleConfirmVersionIncrement = () => {
    setVersionIncrementWarning(null)
    // Validation already passed, just close the warning
  }

  const handleCancelVersionIncrement = () => {
    setFormData({ ...formData, version: '' })
    setVersionIncrementWarning(null)
  }

  const handleDeleteFeature = async (featureId: string) => {
    if (!confirm('Are you sure you want to delete this feature update? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('feature_updates')
        .delete()
        .eq('id', featureId)

      if (error) throw error

      toast.success('✅ Feature update deleted successfully!')
      
      // If we were editing this feature, clear the form
      if (editingId === featureId) {
        handleCancelEdit()
      }
      
      fetchFeatures()
    } catch (error) {
      console.error('Error deleting feature:', error)
      toast.error('Failed to delete feature update')
    }
  }

  const handleTogglePublish = async (featureId: string, currentStatus: boolean) => {
    setPublishConfirmation({ show: true, featureId, currentStatus })
  }

  const handleConfirmPublishToggle = async () => {
    if (!publishConfirmation) return

    const { featureId, currentStatus } = publishConfirmation

    try {
      const { error } = await supabase
        .from('feature_updates')
        .update({ is_published: !currentStatus })
        .eq('id', featureId)

      if (error) throw error

      toast.success(`✅ Feature update ${!currentStatus ? 'published' : 'unpublished'} successfully!`)
      
      // Update local state
      if (editingId === featureId) {
        setFormData({ ...formData, is_published: !currentStatus })
      }
      
      fetchFeatures()
    } catch (error) {
      console.error('Error toggling publish status:', error)
      toast.error('Failed to update publish status')
    } finally {
      setPublishConfirmation(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if version exists (only if not already in edit mode)
    if (!editMode && formData.version.trim()) {
      const existingId = await checkVersionExists(formData.version)
      if (existingId) {
        setExistingVersionId(existingId)
        setShowVersionWarning(true)
        return
      }
    }

    setLoading(true)

    try {
      if (editMode && editingId) {
        // Update existing feature
        const { error } = await supabase
          .from('feature_updates')
          .update({
            ...formData,
          })
          .eq('id', editingId)

        if (error) throw error
        toast.success('✅ Feature update updated successfully!')
        fetchFeatures()
      } else {
        // Create new feature
        const { error } = await supabase
          .from('feature_updates')
          .insert([{
            ...formData,
            released_at: new Date().toISOString(),
          }])

        if (error) throw error
        toast.success('✅ Feature update created successfully!')
        handleCancelEdit()
        fetchFeatures()
      }
    } catch (error) {
      console.error('Error saving feature update:', error)
      toast.error('Failed to save feature update')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmEdit = () => {
    if (existingVersionId) {
      // Load the existing feature for editing
      const existingFeature = allFeatures.find(f => f.id === existingVersionId)
      if (existingFeature) {
        handleEditFeature(existingFeature)
      }
    }
    setShowVersionWarning(false)
    setExistingVersionId(null)
  }

  const getCategoryBadge = (category: string) => {
    const styles = {
      feature: 'bg-lime-300/20 text-lime-300 border-lime-400/30',
      improvement: 'bg-blue-300/20 text-blue-300 border-blue-400/30',
      bugfix: 'bg-red-300/20 text-red-300 border-red-400/30',
      announcement: 'bg-purple-300/20 text-purple-300 border-purple-400/30',
    }
    return styles[category as keyof typeof styles] || styles.feature
  }

  const getPlatformBadge = (platform: string) => {
    const icons = {
      web: '🌐',
      mobile: '📱',
      both: '🌐📱',
    }
    return icons[platform as keyof typeof icons] || icons.both
  }

  return (
    <>
      <div className="fixed inset-0 flex flex-col text-[var(--foreground)] bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] pt-20">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0 px-4 sm:px-6 py-4"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-200 to-lime-300 bg-clip-text text-transparent">
            Feature Updates Manager
          </h1>
        </motion.div>

        {/* Main Content - Fixed Height */}
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 px-4 sm:px-6 pb-4">
          
          {/* Left Side - Features List (1/3) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-1/3 flex flex-col gap-3 min-h-0"
          >
            {/* Toggle Buttons */}
            <div className="flex gap-2 bg-[#1f2420]/95 backdrop-blur-md p-2 rounded-2xl border border-[#55694b]/50 flex-shrink-0">
              {viewMode === 'major' ? (
                <>
                  <div className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-[#55694b]/40 text-[#d4e7c5] flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Major Updates
                  </div>
                  <button
                    onClick={() => {
                      const hasUnsavedChanges = formData.title || formData.description || formData.version
                      if (hasUnsavedChanges) {
                        setShowUnsavedWarning(true)
                      } else {
                        handleCancelEdit()
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#4a7c59]/40 hover:bg-[#4a7c59]/60 text-[#a8d5ba] transition-all duration-300 flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Create Feature
                  </button>
                  <button
                    onClick={() => setShowPreviewModal(true)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#2a2a2a] text-white/70 hover:text-white/90 hover:bg-[#3a3a3a] transition-all duration-300 flex items-center gap-2"
                  >
                    <Monitor className="w-4 h-4" />
                    Preview Modal
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleBackToMajor}
                    className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-[#2a2a2a] text-white/60 hover:text-white/80 transition-all duration-300"
                  >
                    ← Back to Major
                  </button>
                  <div className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-[#4d7c0f]/40 text-[#d4e7c5] flex items-center justify-center gap-2">
                    <Eye className="w-4 h-4" />
                    Minor Updates
                  </div>
                  <button
                    onClick={() => {
                      const hasUnsavedChanges = formData.title || formData.description || formData.version
                      if (hasUnsavedChanges) {
                        setShowUnsavedWarning(true)
                      } else {
                        handleCancelEdit()
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#4a7c59]/40 hover:bg-[#4a7c59]/60 text-[#a8d5ba] transition-all duration-300 flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Create Feature
                  </button>
                  <button
                    onClick={() => setShowPreviewModal(true)}
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
                {viewMode === 'major' ? 'Major Versions' : `Version ${selectedMajorVersion} Updates`}
              </h2>
              
              {viewMode === 'major' ? (
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
                        onClick={() => handleMajorClick(major.version)}
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
                // Minor Updates View
                displayedFeatures.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No minor updates found</p>
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
                            onClick={() => handleEditFeature(feature)}
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
                                handleTogglePublish(feature.id, feature.is_published)
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
                                handleDeleteFeature(feature.id)
                              }}
                              className="px-2 py-1 rounded-lg bg-[#7a4444]/30 hover:bg-[#7a4444]/40 border border-[#7a4444]/50 text-[#d49999] transition-all duration-200 text-[10px] font-medium whitespace-nowrap"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p 
                          className="text-xs text-gray-400 line-clamp-2 mb-2 cursor-pointer"
                          onClick={() => handleEditFeature(feature)}
                        >
                          {feature.description}
                        </p>
                        <div 
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => handleEditFeature(feature)}
                        >
                          <span className="text-xs text-gray-500">
                            Priority: {feature.priority}
                          </span>
                          <span className="text-lg">{getPlatformBadge(feature.platform)}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )
              )}
            </div>
          </motion.div>

          {/* Right Side - Form (2/3) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-2/3 min-h-0 flex flex-col"
          >
            <div className="bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl p-6 flex-1 overflow-y-auto min-h-0">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 flex-1">
                  <Megaphone className="w-6 h-6 text-[#6b8e4e]" />
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold text-[#F1F5E9]">
                      {editMode ? 'Edit Feature Update' : 'Create New Feature Update'}
                    </h2>
                    {editMode && (
                      <span className="text-xs text-[#9ca87f] bg-[#55694b]/20 px-3 py-1 rounded-full border border-[#55694b]/40">
                        Editing v{formData.version}
                      </span>
                    )}
                  </div>
                </div>
                {editMode && (
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 transition-all duration-300 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Row 1: Version, Priority, Category, Platform */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-[#F1F5E9]">
                      Version *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.version}
                      onChange={(e) => handleVersionChange(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg bg-[#2f3a2d] border text-[#F1F5E9] text-sm focus:outline-none focus:ring-1 focus:ring-[#6b8e4e]/50 focus:border-[#6b8e4e] ${
                        versionValidationError ? 'border-red-400' : 'border-[#55694b]'
                      }`}
                      placeholder="1.0.1"
                    />
                    {versionValidationError && (
                      <p className="text-[10px] text-red-400 mt-0.5 leading-tight">{versionValidationError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-[#F1F5E9]">
                      Priority
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
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
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] text-sm focus:outline-none focus:ring-1 focus:ring-[#6b8e4e]/50 focus:border-[#6b8e4e]"
                    >
                      <option value="feature">Feature</option>
                      <option value="improvement">Improvement</option>
                      <option value="bugfix">Bug Fix</option>
                      <option value="announcement">Announcement</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 text-[#F1F5E9]">
                      Platform *
                    </label>
                    <select
                      required
                      value={formData.platform}
                      onChange={(e) => setFormData({ ...formData, platform: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg bg-[#2f3a2d] border border-[#55694b] text-[#F1F5E9] text-sm focus:outline-none focus:ring-1 focus:ring-[#6b8e4e]/50 focus:border-[#6b8e4e]"
                    >
                      <option value="both">Web & Mobile</option>
                      <option value="web">Web Only</option>
                      <option value="mobile">Mobile Only</option>
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
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                      onChange={(value) => setFormData({ ...formData, description: value })}
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
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
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
                      onChange={(e) => setFormData({ ...formData, admin_view_excluded: e.target.checked })}
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
          </motion.div>
        </div>

        {/* Preview Modal */}
        {showPreviewModal && (
          <NewFeaturesModal
            isOpen={showPreviewModal}
            onClose={() => setShowPreviewModal(false)}
            initialViewMode="adminView"
          />
        )}

        {/* Version Conflict Modal */}
        <VersionConflictModal
          isOpen={versionChangeWarning.show}
          onClose={handleCancelVersionSwitch}
          onConfirm={handleConfirmVersionSwitch}
          version={formData.version}
          isEditingToNew={!versionChangeWarning.newVersionExists}
        />

        {/* Version Increment Warning Modal */}
        {versionIncrementWarning && (
          <VersionIncrementWarningModal
            isOpen={true}
            onClose={handleCancelVersionIncrement}
            onConfirm={handleConfirmVersionIncrement}
            version={versionIncrementWarning.version}
            type={versionIncrementWarning.type}
          />
        )}

        {/* Publish Confirmation Modal */}
        {publishConfirmation && (
          <PublishConfirmationModal
            isOpen={true}
            onClose={() => setPublishConfirmation(null)}
            onConfirm={handleConfirmPublishToggle}
            currentStatus={publishConfirmation.currentStatus}
          />
        )}

        {/* Unsaved Changes Modal */}
        <UnsavedChangesModal
          isOpen={showUnsavedWarning}
          onClose={() => setShowUnsavedWarning(false)}
          onConfirm={handleCancelEdit}
        />

      </div>
    </>
  )
}