'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'

interface SyncProgressBarProps {
  userId: string
  totalMonths: number
  onComplete: () => void
}

export default function SyncProgressBar({
  userId,
  totalMonths,
  onComplete,
}: SyncProgressBarProps) {
  const [completedMonths, setCompletedMonths] = useState(0)
  const [displayProgress, setDisplayProgress] = useState(0)
  const [failed, setFailed] = useState(false)
  const [lastCompletedCount, setLastCompletedCount] = useState(0)

  useEffect(() => {
    // Poll for sync status updates every 2 seconds
    const pollInterval = setInterval(() => {
      fetchSyncStatus()
    }, 2000)

    // Initial fetch
    fetchSyncStatus()

    return () => {
      clearInterval(pollInterval)
    }
  }, [userId])

  // Fetch current sync status
  const fetchSyncStatus = async () => {
    const { data, error } = await supabase
      .from('sync_status')
      .select('status')
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching sync status:', error)
      return
    }

    const completed = data?.filter(s => s.status === 'completed').length || 0
    const hasFailed = data?.some(s => s.status === 'failed') || false
    
    console.log(`Sync status: ${completed}/${totalMonths} completed`)
    
    setCompletedMonths(completed)
    setFailed(hasFailed)
  }

  // Handle progress updates when completedMonths changes
  useEffect(() => {
    console.log(`Progress update: completed=${completedMonths}, last=${lastCompletedCount}, display=${displayProgress}`)
    
    // Check if all months are complete
    if (completedMonths === totalMonths && totalMonths > 0) {
      console.log('All months complete! Jumping to 100%')
      setDisplayProgress(100)
      onComplete()
      return
    }

    // If a new month completed, increment the progress bar
    if (completedMonths > lastCompletedCount && totalMonths > 0) {
      const currentProgress = displayProgress
      const percentageToAdd = (100 - currentProgress) / totalMonths
      const newProgress = Math.min(currentProgress + percentageToAdd, 99)
      
      console.log(`Adding ${percentageToAdd.toFixed(2)}% to progress: ${currentProgress.toFixed(2)}% -> ${newProgress.toFixed(2)}%`)
      
      setDisplayProgress(newProgress)
      setLastCompletedCount(completedMonths)
    }
  }, [completedMonths, totalMonths, onComplete])

  // Random increments while waiting (independent of completion)
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayProgress(prev => {
        // Never go to 100% with random increments
        if (prev >= 99) {
          return prev
        }
        
        // Random increment between 0.5% and 2%
        const increment = Math.random() * 1.5 + 0.5
        const newProgress = Math.min(prev + increment, 99)
        
        return newProgress
      })
    }, 1500) // Update every 1.5 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white font-medium">
          {failed ? 'Sync encountered errors' : 'Syncing your data...'}
        </span>
        <span className="text-emerald-300 font-bold">
          {Math.round(displayProgress)}%
        </span>
      </div>
      
      <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            failed 
              ? 'bg-gradient-to-r from-rose-400 to-red-500' 
              : 'bg-gradient-to-r from-emerald-400 to-[#3af1f7]'
          }`}
          style={{ width: `${displayProgress}%` }}
        />
      </div>

      {failed && (
        <p className="text-xs text-rose-300">
          Some months failed to sync. Please retry.
        </p>
      )}
    </div>
  )
}