'use client'

import { useState } from 'react'
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

      toast.success(`Feature update ${!currentStatus ? 'published' : 'unpublished'} successfully!`)
      
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
    <div
      className="fixed inset-x-0 bottom-0 flex flex-col bg-canvas text-ivory"
      style={{ top: 'var(--navbar-height, 72px)' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-5 pb-4 md:px-7 xl:px-10">
        <div className="page-header !mb-0">
          <div className="min-w-0">
            <h1 className="page-title">Feature Updates Manager</h1>
            <p className="page-subtitle">Write, version and publish the release notes shown in the What&apos;s New modal.</p>
          </div>
          <div className="page-actions w-full sm:w-auto">
            <PlatformSwitcher
              currentPlatform={currentPlatform}
              onPlatformChange={setCurrentPlatform}
            />
          </div>
        </div>
      </div>

      {/* Main Content - Platform-specific */}
      <div className="flex flex-1 min-h-0 flex-col px-4 pb-4 md:px-7 xl:px-10">
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