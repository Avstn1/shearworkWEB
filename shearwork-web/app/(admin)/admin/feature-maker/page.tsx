'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import PlatformSwitcher from '@/components/AdminComponents/AdminFeatureMaker/Shared/PlatformSwitcher'
import WebFeatures from '@/components/AdminComponents/AdminFeatureMaker/Web/WebFeatures'
import MobileFeatures from '@/components/AdminComponents/AdminFeatureMaker/Mobile/MobileFeatures'
import WebAndMobileFeatures from '@/components/AdminComponents/AdminFeatureMaker/WebAndMobile/WebAndMobileFeatures'
import NewFeaturesModal from '@/components/Dashboard/NewFeaturesModal'
import VersionConflictModal from '@/components/AdminComponents/AdminFeatureMaker/Modals/VersionConflictModal'
import PublishConfirmationModal from '@/components/AdminComponents/AdminFeatureMaker/Modals/PublishConfirmationModal'
import VersionIncrementWarningModal from '@/components/AdminComponents/AdminFeatureMaker/Modals/VersionIncrementWarningModal'
import UnsavedChangesModal from '@/components/AdminComponents/AdminFeatureMaker/Modals/UnsavedChangesModal'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

export default function FeatureMakerPage() {
  const [currentPlatform, setCurrentPlatform] = useState<'web' | 'mobile' | 'both'>('web')
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  
  const [versionChangeWarning, setVersionChangeWarning] = useState<{
    show: boolean
    newVersionExists: boolean
    existingId: string | null
  }>({ show: false, newVersionExists: false, existingId: null })
  
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

  const handleConfirmVersionSwitch = () => {
    // This would need to be handled by the specific platform component
    setVersionChangeWarning({ show: false, newVersionExists: false, existingId: null })
  }

  const handleCancelVersionSwitch = () => {
    setVersionChangeWarning({ show: false, newVersionExists: false, existingId: null })
  }

  const handleConfirmVersionIncrement = () => {
    setVersionIncrementWarning(null)
  }

  const handleCancelVersionIncrement = () => {
    setVersionIncrementWarning(null)
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
      
      // Trigger a refresh in the active platform component
      window.location.reload()
    } catch (error) {
      console.error('Error toggling publish status:', error)
      toast.error('Failed to update publish status')
    } finally {
      setPublishConfirmation(null)
    }
  }

  const handleConfirmUnsavedChanges = () => {
    setShowUnsavedWarning(false)
    // The actual cancel/clear would be handled by the platform component
  }

  return (
    <div className="fixed inset-0 flex flex-col text-[var(--foreground)] bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] pt-20">
      
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 px-4 sm:px-6 py-4"
      >
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-200 to-lime-300 bg-clip-text text-transparent mb-4">
          Feature Updates Manager
        </h1>
        
        <PlatformSwitcher 
          currentPlatform={currentPlatform}
          onPlatformChange={setCurrentPlatform}
        />
      </motion.div>

      {/* Main Content - Platform-specific */}
      <div className="flex-1 min-h-0 px-4 sm:px-6 pb-4">
        {currentPlatform === 'web' && (
          <WebFeatures
            onShowPreview={() => setShowPreviewModal(true)}
            onShowVersionConflict={setVersionChangeWarning}
            onShowVersionIncrement={setVersionIncrementWarning}
            onShowPublishConfirmation={setPublishConfirmation}
            onShowUnsavedWarning={() => setShowUnsavedWarning(true)}
          />
        )}
        
        {currentPlatform === 'mobile' && (
          <MobileFeatures
            onShowPreview={() => setShowPreviewModal(true)}
            onShowVersionConflict={setVersionChangeWarning}
            onShowVersionIncrement={setVersionIncrementWarning}
            onShowPublishConfirmation={setPublishConfirmation}
            onShowUnsavedWarning={() => setShowUnsavedWarning(true)}
          />
        )}
        
        {currentPlatform === 'both' && (
          <WebAndMobileFeatures
            onShowPreview={() => setShowPreviewModal(true)}
            onShowPublishConfirmation={setPublishConfirmation}
            onShowUnsavedWarning={() => setShowUnsavedWarning(true)}
          />
        )}
      </div>

      {/* Modals */}
      {showPreviewModal && (
        <NewFeaturesModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          initialViewMode="adminView"
        />
      )}

      <VersionConflictModal
        isOpen={versionChangeWarning.show}
        onClose={handleCancelVersionSwitch}
        onConfirm={handleConfirmVersionSwitch}
        version=""
        isEditingToNew={!versionChangeWarning.newVersionExists}
      />

      {versionIncrementWarning && (
        <VersionIncrementWarningModal
          isOpen={true}
          onClose={handleCancelVersionIncrement}
          onConfirm={handleConfirmVersionIncrement}
          version={versionIncrementWarning.version}
          type={versionIncrementWarning.type}
        />
      )}

      {publishConfirmation && (
        <PublishConfirmationModal
          isOpen={true}
          onClose={() => setPublishConfirmation(null)}
          onConfirm={handleConfirmPublishToggle}
          currentStatus={publishConfirmation.currentStatus}
        />
      )}

      <UnsavedChangesModal
        isOpen={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        onConfirm={handleConfirmUnsavedChanges}
      />
    </div>
  )
}