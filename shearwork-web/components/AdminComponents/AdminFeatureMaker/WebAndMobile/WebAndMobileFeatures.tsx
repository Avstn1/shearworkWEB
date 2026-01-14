'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'
import FeaturesList, { FeatureUpdate } from '../Shared/FeaturesList'
import FeatureForm, { FormData } from '../Shared/FeatureForm'
import { motion } from 'framer-motion'

interface WebAndMobileFeaturesProps {
  onShowPreview: () => void
  onShowPublishConfirmation: (data: { show: boolean; featureId: string; currentStatus: boolean } | null) => void
  onShowUnsavedWarning: () => void
}

export default function WebAndMobileFeatures({
  onShowPreview,
  onShowPublishConfirmation,
  onShowUnsavedWarning,
}: WebAndMobileFeaturesProps) {
  const [loading, setLoading] = useState(false)
  const [allFeatures, setAllFeatures] = useState<FeatureUpdate[]>([])
  const [editMode, setEditMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    category: 'announcement',
    image_url: '',
    video_url: '',
    version: '',
    platform: 'both',
    priority: 0,
    is_published: false,
    admin_view_excluded: false,
  })

  useEffect(() => {
    fetchFeatures()
  }, [])

  const fetchFeatures = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_updates')
        .select('*')
        .eq('platform', 'both')
        .order('released_at', { ascending: false })

      if (error) throw error
      setAllFeatures(data || [])
    } catch (error) {
      console.error('Error fetching features:', error)
      toast.error('Failed to load features')
    }
  }

  const handleCreateFeature = () => {
    setEditMode(false)
    setEditingId(null)
    setFormData({
      title: '',
      description: '',
      category: 'announcement',
      image_url: '',
      video_url: '',
      version: '',
      platform: 'both',
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
      version: '',
      platform: 'both',
      priority: feature.priority,
      is_published: feature.is_published,
      admin_view_excluded: feature.admin_view_excluded || false,
    })
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    setEditingId(null)
    setFormData({
      title: '',
      description: '',
      category: 'announcement',
      image_url: '',
      video_url: '',
      version: '',
      platform: 'both',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (editMode && editingId) {
        const { error } = await supabase
          .from('feature_updates')
          .update({
            ...formData,
            version: null, // No versioning for 'both'
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
            version: null, // No versioning for 'both'
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

  const hasUnsavedChanges = !!(formData.title || formData.description)

  return (
    <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
      <FeaturesList
        platform="both"
        viewMode="minor"
        majorUpdates={[]}
        displayedFeatures={allFeatures}
        selectedMajorVersion={null}
        editingId={editingId}
        hasUnsavedChanges={hasUnsavedChanges}
        onMajorClick={() => {}}
        onBackToMajor={() => {}}
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
          platform="both"
          editMode={editMode}
          formData={formData}
          loading={loading}
          versionValidationError={null}
          onFormDataChange={setFormData}
          onVersionChange={() => {}}
          onSubmit={handleSubmit}
          onCancel={handleCancelEdit}
        />
      </motion.div>
    </div>
  )
}