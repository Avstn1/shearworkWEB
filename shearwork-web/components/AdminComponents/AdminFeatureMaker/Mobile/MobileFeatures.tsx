'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import FeaturesList, { FeatureUpdate, MajorUpdate } from '../Shared/FeaturesList'
import FeatureForm, { FormData } from '../Shared/FeatureForm'
import { motion } from 'framer-motion'

interface MobileFeaturesProps {
  onShowPreview: () => void
  onShowVersionConflict: (data: { show: boolean; newVersionExists: boolean; existingId: string | null }) => void
  onShowVersionIncrement: (data: { show: boolean; version: string; type: 'major' | 'minor' } | null) => void
  onShowPublishConfirmation: (data: { show: boolean; featureId: string; currentStatus: boolean } | null) => void
  onShowUnsavedWarning: () => void
}

export default function MobileFeatures({
  onShowPreview,
  onShowVersionConflict,
  onShowVersionIncrement,
  onShowPublishConfirmation,
  onShowUnsavedWarning,
}: MobileFeaturesProps) {
  const [loading, setLoading] = useState(false)
  const [allFeatures, setAllFeatures] = useState<FeatureUpdate[]>([])
  const [displayedFeatures, setDisplayedFeatures] = useState<FeatureUpdate[]>([])
  const [majorUpdates, setMajorUpdates] = useState<MajorUpdate[]>([])
  const [selectedMajorVersion, setSelectedMajorVersion] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'major' | 'minor'>('major')
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [versionValidationError, setVersionValidationError] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    category: 'feature',
    image_url: '',
    video_url: '',
    version: '',
    platform: 'mobile',
    priority: 0,
    is_published: false,
    admin_view_excluded: false,
  })

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
        .eq('platform', 'mobile')
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
    const filtered = allFeatures.filter((f) => 
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

  const handleCreateFeature = () => {
    setEditMode(false)
    setEditingId(null)
    setFormData({
      title: '',
      description: '',
      category: 'feature',
      image_url: '',
      video_url: '',
      version: '',
      platform: 'mobile',
      priority: 0,
      is_published: false,
      admin_view_excluded: false,
    })
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
      platform: 'mobile',
      priority: feature.priority,
      is_published: feature.is_published,
      admin_view_excluded: feature.admin_view_excluded || false,
    })
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    setEditingId(null)
    setVersionValidationError(null)
    setFormData({
      title: '',
      description: '',
      category: 'feature',
      image_url: '',
      video_url: '',
      version: '',
      platform: 'mobile',
      priority: 0,
      is_published: false,
      admin_view_excluded: false,
    })
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
    onShowPublishConfirmation({ show: true, featureId, currentStatus })
  }

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
    const parsed = parseVersion(versionStr)
    if (!parsed) {
      return { valid: false, error: 'Version must follow format x.x.x (e.g., 1.0.0, 2.5.3)' }
    }

    const [major, minor, patch] = parsed

    if (major === 0) {
      return { valid: false, error: 'Major version cannot be 0' }
    }

    const latest = getLatestVersion()
    if (!latest) return { valid: true }

    const [latestMajor, latestMinor, latestPatch] = latest

    if (compareVersions(parsed, latest) < 0) {
      return { valid: false, error: `Version ${versionStr} is less than the latest version ${latest.join('.')}` }
    }

    if (compareVersions(parsed, latest) === 0 && !editingId) {
      return { valid: false, error: `Version ${versionStr} already exists` }
    }

    if (major === latestMajor && minor === latestMinor) {
      if (patch !== latestPatch + 1) {
        return { valid: false, error: `Cannot skip versions. Latest is ${latest.join('.')}, next must be ${latestMajor}.${latestMinor}.${latestPatch + 1}` }
      }
    } else if (major === latestMajor && minor > latestMinor) {
      if (minor !== latestMinor + 1) {
        return { valid: false, error: `Cannot skip minor versions. Latest is ${latest.join('.')}, next minor must be ${latestMajor}.${latestMinor + 1}.x` }
      }
      if (patch === 0 || patch === 1) {
        return { valid: true, needsConfirmation: true }
      } else {
        return { valid: false, error: `When incrementing minor version, patch must be 0 or 1 (e.g., ${major}.${minor}.0 or ${major}.${minor}.1)` }
      }
    } else if (major > latestMajor) {
      if (major !== latestMajor + 1) {
        return { valid: false, error: `Cannot skip major versions. Latest is ${latest.join('.')}, next major must be ${latestMajor + 1}.x.x` }
      }
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

  const checkVersionExists = async (version: string) => {
    if (!version.trim()) return null
    
    let query = supabase
      .from('feature_updates')
      .select('id')
      .eq('version', version)
      .eq('platform', 'mobile')
    
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

    if (!newVersion.trim()) {
      onShowVersionConflict({ show: false, newVersionExists: false, existingId: null })
      return
    }

    const validation = validateNewVersion(newVersion)
    
    if (!validation.valid) {
      setVersionValidationError(validation.error || null)
      return
    }

    if (validation.needsConfirmation) {
      const parsed = parseVersion(newVersion)
      const latest = getLatestVersion()
      if (parsed && latest) {
        const [major, minor] = parsed
        const [latestMajor, latestMinor] = latest
        
        if (major > latestMajor) {
          onShowVersionIncrement({ 
            show: true, 
            version: newVersion,
            type: 'major'
          })
          return
        } else if (minor > latestMinor) {
          onShowVersionIncrement({ 
            show: true, 
            version: newVersion,
            type: 'minor'
          })
          return
        }
      }
    }

    const existingId = await checkVersionExists(newVersion)

    if (editMode && !existingId) {
      onShowVersionConflict({ 
        show: true, 
        newVersionExists: false, 
        existingId: null 
      })
    } else if (!editMode && existingId) {
      onShowVersionConflict({ 
        show: true, 
        newVersionExists: true, 
        existingId 
      })
    } else {
      onShowVersionConflict({ show: false, newVersionExists: false, existingId: null })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editMode && formData.version.trim()) {
      const existingId = await checkVersionExists(formData.version)
      if (existingId) {
        toast.error('Version already exists')
        return
      }
    }

    setLoading(true)

    try {
      if (editMode && editingId) {
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

  const hasUnsavedChanges = !!(formData.title || formData.description || formData.version)

  return (
    <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
      <FeaturesList
        platform="mobile"
        viewMode={viewMode}
        majorUpdates={majorUpdates}
        displayedFeatures={displayedFeatures}
        selectedMajorVersion={selectedMajorVersion}
        editingId={editingId}
        hasUnsavedChanges={hasUnsavedChanges}
        onMajorClick={handleMajorClick}
        onBackToMajor={handleBackToMajor}
        onCreateFeature={handleCreateFeature}
        onShowPreview={onShowPreview}
        onEditFeature={handleEditFeature}
        onTogglePublish={handleTogglePublish}
        onDeleteFeature={handleDeleteFeature}
        onShowUnsavedWarning={onShowUnsavedWarning}
      />

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="lg:w-2/3 min-h-0 flex flex-col"
      >
        <FeatureForm
          platform="mobile"
          editMode={editMode}
          formData={formData}
          loading={loading}
          versionValidationError={versionValidationError}
          onFormDataChange={setFormData}
          onVersionChange={handleVersionChange}
          onSubmit={handleSubmit}
          onCancel={handleCancelEdit}
        />
      </motion.div>
    </div>
  )
}