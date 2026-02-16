'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
          s.status === 'processing' || 
          s.status === 'retrying'
        )
        const allComplete = syncStatusData.every(s => s.status === 'completed')
        
        if (allComplete) {
          // All priority syncs complete, allow proceeding
          setSyncComplete(true)
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

      // Check for Acuity token
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
      <div className="space-y-6 animate-fadeInUp">
        <style jsx>{`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-fadeInUp {
            animation: fadeInUp 0.4s ease-out forwards;
          }
        `}</style>

        <div className="space-y-6 rounded-2xl border border-white/10 bg-black/20 p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.4s ease-out forwards;
        }
      `}</style>

      <div className="space-y-6 rounded-2xl border border-white/10 bg-black/20 p-6">
        <h3 className="text-sm font-semibold text-white uppercase tracking-[0.2em]">Booking Sync</h3>
        
        {/* Back Warning Modal */}
        {showBackWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a1f1b] border border-white/10 rounded-2xl p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold text-white mb-2">Sync in Progress</h3>
              <p className="text-sm text-gray-300 mb-4">
                Please wait for the priority sync to complete before navigating away. Your older data will continue syncing in the background.
              </p>
              <button
                onClick={() => setShowBackWarning(false)}
                className="w-full px-4 py-2 bg-gradient-to-r from-emerald-400 to-[#3af1f7] text-black font-semibold rounded-xl hover:shadow-lg transition-all"
              >
                Got it
              </button>
            </div>
          </div>
        )}
        
        {!hasAcuity && !hasSquare ? (
          <div className="py-8 text-center">
            <p className="text-gray-400 mb-4">
              No booking integration detected. Please connect a calendar in the previous step.
            </p>
          </div>
        ) : hasAcuity ? (
          <Acuity 
            userId={userId} 
            onSyncComplete={handleSyncComplete}
            onSyncStateChange={setIsSyncing}
            existingSync={existingSync}
          />
        ) : hasSquare ? (
          <div className="py-8 text-center">
            <p className="text-gray-400">Square sync coming soon...</p>
          </div>
        ) : null}

        {/* Back and Next Buttons */}
        <div className="flex justify-between items-center gap-4 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              if (isSyncing) {
                setShowBackWarning(true)
              } else {
                onBack()
              }
            }}
            className="px-6 py-3 font-semibold rounded-xl bg-white/10 border border-white/20 hover:bg-white/15 transition-all"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={profileLoading || !syncComplete}
            className={`px-8 py-3 font-semibold rounded-xl transition-all ${
              profileLoading || !syncComplete
                ? 'bg-white/5 border border-white/10 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#7affc9] to-[#3af1f7] text-black hover:shadow-lg'
            }`}
          >
            {!syncComplete && isSyncing ? 'Syncing...' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}