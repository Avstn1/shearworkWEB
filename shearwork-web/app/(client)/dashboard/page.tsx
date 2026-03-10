'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import AutoNudgeStatus from '@/components/AutoNudgeDashboard/AutoNudgeStatus'
import OpenBookings from '@/components/AutoNudgeDashboard/OpenBookings'
import BookingCapacity from '@/components/AutoNudgeDashboard/BookingCapacity'
import AutoNudgeImpact from '@/components/AutoNudgeDashboard/AutoNudgeImpact'
import ClientHealth from '@/components/AutoNudgeDashboard/ClientHealth'
import AutoNudgeHistory from '@/components/AutoNudgeDashboard/AutoNudgeHistory'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const [user_id, setUser_id] = useState<string | null>(null)
  const [sms_engaged_current_week, setSms_engaged_current_week] = useState<boolean>(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [availabilityReady, setAvailabilityReady] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)

  const router = useRouter()

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('sms_engaged_current_week, special_access')
        .eq('user_id', user.id)
        .single()

      if (!profile?.special_access) {
        router.push('/analytics')
        return
      }

      setSms_engaged_current_week(profile.sms_engaged_current_week ?? false)
      setUser_id(user.id)
      setProfileLoaded(true)

      // Call RPC after profile confirmed — top row waits for this
      try {
        await supabase.functions.invoke('update_barber_availability', {
          body: { user_id: user.id }
        })
      } catch (err) {
        console.error('Availability update failed:', err)
      } finally {
        setAvailabilityReady(true)
      }
    }
    getUser()
  }, [])

  if (!profileLoaded) return null

  return (
    <div
      className="flex flex-col bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] p-4 pt-6 gap-4 overflow-hidden"
      style={{
        height: 'calc(100dvh - var(--navbar-height, 72px))',
        marginTop: 'var(--navbar-height, 72px)',
      }}
    >

      {/* Top row — matches bottom row column widths */}
      <div className="grid grid-cols-3 gap-4 flex-shrink-0 h-[28%]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <AutoNudgeStatus user_id={user_id!} />
        </div>
        <div className="col-span-2 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {availabilityReady && <OpenBookings user_id={user_id!} />}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {availabilityReady && <BookingCapacity user_id={user_id!} />}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {availabilityReady && <AutoNudgeImpact user_id={user_id!} />}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          <ClientHealth
            user_id={user_id!}
            sms_engaged_current_week={sms_engaged_current_week}
            onNudgeSuccess={() => setHistoryKey(k => k + 1)}
          />
        </div>
        <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          <AutoNudgeHistory key={historyKey} user_id={user_id!} />
        </div>
      </div>

    </div>
  )
}