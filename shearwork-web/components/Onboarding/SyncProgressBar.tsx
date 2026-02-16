'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
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
  const [isComplete, setIsComplete] = useState(false)
  
  // Use refs to track values without causing re-renders
  const lastCompletedCountRef = useRef(0)
  const hasCalledCompleteRef = useRef(false)
  const randomIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch current sync status
  const fetchSyncStatus = useCallback(async () => {
    if (isComplete) return // Stop polling when complete
    
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
  }, [userId, totalMonths, isComplete])

  // Poll for sync status updates
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchSyncStatus()
    }, 2000)

    // Initial fetch
    fetchSyncStatus()

    return () => {
      clearInterval(pollInterval)
    }
  }, [fetchSyncStatus])

  // Handle completion - check if all months are done
  useEffect(() => {
    // Check if all months are complete (use >= for safety)
    if (completedMonths >= totalMonths && totalMonths > 0 && !hasCalledCompleteRef.current) {
      console.log('All months complete! Jumping to 100%')
      hasCalledCompleteRef.current = true
      setIsComplete(true)
      setDisplayProgress(100)
      
      // Stop the random increment timer
      if (randomIntervalRef.current) {
        clearInterval(randomIntervalRef.current)
        randomIntervalRef.current = null
      }
      
      onComplete()
    }
  }, [completedMonths, totalMonths, onComplete])

  // Handle progress updates when completedMonths changes (but not complete yet)
  useEffect(() => {
    if (isComplete) {
      setDisplayProgress(100)
      return
    }
    
    // If a new month completed, increment the progress bar
    if (completedMonths > lastCompletedCountRef.current && totalMonths > 0) {
      const progressPerMonth = 95 / totalMonths // Leave room to jump to 100%
      const newProgress = Math.min(completedMonths * progressPerMonth, 95)
      
      console.log(`Progress update: ${completedMonths}/${totalMonths} months = ${newProgress.toFixed(1)}%`)
      
      setDisplayProgress(newProgress)
      lastCompletedCountRef.current = completedMonths
    }
  }, [completedMonths, totalMonths, isComplete])

  // Random increments while waiting (only when not complete)
  useEffect(() => {
    if (isComplete) {
      setDisplayProgress(100)
      return
    }
    
    randomIntervalRef.current = setInterval(() => {
      setDisplayProgress(prev => {
        // Stop at 95% to leave room for real completion
        if (prev >= 95) {
          return prev
        }
        
        // Smaller random increment between 0.3% and 1%
        const increment = Math.random() * 0.7 + 0.3
        const newProgress = Math.min(prev + increment, 95)
        
        return newProgress
      })
    }, 5000) // Every 5 seconds

    return () => {
      if (randomIntervalRef.current) {
        clearInterval(randomIntervalRef.current)
      }
    }
  }, [isComplete])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white font-medium">
          {isComplete 
            ? 'Sync complete!' 
            : failed 
              ? 'Sync encountered errors' 
              : 'Syncing your data...'}
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

      {failed && !isComplete && (
        <p className="text-xs text-rose-300">
          Some months failed to sync. Please retry.
        </p>
      )}
    </div>
  )
}
