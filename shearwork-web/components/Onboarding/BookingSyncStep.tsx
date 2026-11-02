'use client'

import { useEffect, useState } from 'react'
import { CalendarX2, Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/utils/supabaseClient'
import Acuity from '@/components/Onboarding/BookingApp/Acuity'

interface BookingSyncStepProps {
  onBack: () => void
  onNext: () => void
  profileLoading: boolean
}

export default function BookingSyncStep({
  onBack,
  onNext,
  profileLoading,
}: BookingSyncStepProps) {
  const [loading, setLoading] = useState(true)
  const [hasAcuity, setHasAcuity] = useState(false)
  const [hasSquare, setHasSquare] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [syncComplete, setSyncComplete] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showBackWarning, setShowBackWarning] = useState(false)
  const [existingSync, setExistingSync] = useState<{
    hasPending: boolean
    totalMonths: number
  } | null>(null)

  useEffect(() => {
    checkIntegrations()
  }, [])

  const checkIntegrations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not logged in')

      setUserId(user.id)

      // Check for Acuity token FIRST
      const { data: acuityToken } = await supabase
        .from('acuity_tokens')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      setHasAcuity(!!acuityToken)

      // Check for Square token (future)
      const { data: squareToken } = await supabase
        .from('square_tokens')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      setHasSquare(!!squareToken)

      // Call edge function to update availability data
      supabase.functions.invoke('update_barber_availability', {
        body: { user_id: user.id }
      }).catch(err => {
        console.error('Background availability update failed:', err)
      })

      // Check for existing sync_status rows (priority phase only)
      const { data: syncStatusData, error: syncError } = await supabase
        .from('sync_status')
        .select('status, sync_phase')
        .eq('user_id', user.id)
        .eq('sync_phase', 'priority') // Only check priority phase

      if (!syncError && syncStatusData && syncStatusData.length > 0) {
        const hasPending = syncStatusData.some(s => 
          s.status === 'pending' || 
          s.status === 'queued' || 
          s.status === 'processing' || 
          s.status === 'retrying'
        )
        const allComplete = syncStatusData.every(s => s.status === 'completed')
        
        if (allComplete) {
          // All priority syncs complete, allow proceeding
          console.log('All priority syncs already completed, skipping sync step')
          setSyncComplete(true)
          setLoading(false)
          return
        } else if (hasPending) {
          // Has pending priority syncs, resume them
          console.log('Found incomplete priority syncs, resuming...')
          
          setExistingSync({
            hasPending: true,
            totalMonths: syncStatusData.length
          })
          
          // Auto-resume incomplete syncs
          fetch('/api/onboarding/resume-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
          }).then(async (res) => {
            const data = await res.json()
            if (res.ok) {
              console.log('Auto-resumed syncs:', data)
              toast.success('Resuming your sync...')
            } else {
              console.error('Failed to auto-resume:', data.error)
            }
          }).catch(err => {
            console.error('Error auto-resuming syncs:', err)
          })
        }
      }
    } catch (error) {
      console.error('Error checking integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSyncComplete = () => {
    setSyncComplete(true)
  }

  if (loading) {
    return (
      <section className="panel">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-sage" />
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div className="min-w-0">
          <h2 className="panel-title">Booking sync</h2>
          <p className="panel-subtitle">Import your appointment history</p>
        </div>
      </header>

      {/* Back Warning Modal */}
      {showBackWarning && (
        <div className="modal-backdrop z-50 flex items-center justify-center px-4">
          <div className="modal-surface w-full max-w-md" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-3.5">
              <h3 className="panel-title">Sync in progress</h3>
              <button
                type="button"
                onClick={() => setShowBackWarning(false)}
                className="btn btn-ghost btn-sm !h-8 !w-8 !p-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <p className="px-5 py-4 text-sm text-gray-300">
              Please wait for the priority sync to complete before navigating away. Your older data will continue syncing in the background.
            </p>
            <div className="flex justify-end px-5 pb-5">
              <button
                type="button"
                onClick={() => setShowBackWarning(false)}
                className="btn btn-primary btn-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel-body">
        {!hasAcuity && !hasSquare ? (
          <div className="empty-state">
            <CalendarX2 strokeWidth={1.75} />
            <p>No booking integration detected. Please connect a calendar in the previous step.</p>
          </div>
        ) : hasAcuity ? (
          <Acuity
            userId={userId}
            onSyncComplete={handleSyncComplete}
            onSyncStateChange={setIsSyncing}
            existingSync={existingSync}
          />
        ) : hasSquare ? (
          <div className="empty-state">
            <p>Square sync coming soon...</p>
          </div>
        ) : null}
      </div>

      {/* Back and Continue */}
      <div className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4">
        <button
          type="button"
          onClick={() => {
            if (isSyncing) {
              setShowBackWarning(true)
            } else {
              onBack()
            }
          }}
          className="btn btn-ghost"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={profileLoading || !syncComplete}
          className="btn btn-primary min-w-[120px]"
        >
          {!syncComplete && isSyncing ? 'Syncing...' : 'Continue'}
        </button>
      </div>
    </section>
  )
}
