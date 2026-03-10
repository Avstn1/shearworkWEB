'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import OpenBookings from '@/components/AutoNudgeDashboard/OpenBookings'
import BookingCapacity from '@/components/AutoNudgeDashboard/BookingCapacity'
import AutoNudgeImpact from '@/components/AutoNudgeDashboard/AutoNudgeImpact'
import ClientHealth from '@/components/AutoNudgeDashboard/ClientHealth'
import AutoNudgeHistory from '@/components/AutoNudgeDashboard/AutoNudgeHistory'

export default function DashboardPage() {
  const [user_id, setUser_id] = useState<string | null>(null)
  const [sms_engaged_current_week, setSms_engaged_current_week] = useState<boolean>(false)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUser_id(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('sms_engaged_current_week')
        .eq('user_id', user.id)
        .single()

      setSms_engaged_current_week(profile?.sms_engaged_current_week ?? false)
      setProfileLoaded(true)
    }
    getUser()
  }, [])

  return (
    <div
      className="flex flex-col bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] p-4 pt-6 gap-4 overflow-hidden"
      style={{
        height: 'calc(100dvh - var(--navbar-height, 72px))',
        marginTop: 'var(--navbar-height, 72px)',
      }}
    >

      {/* 3-column row */}
      <div className="grid grid-cols-3 gap-4 flex-shrink-0 h-[28%]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {user_id && <OpenBookings user_id={user_id} />}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {user_id && <BookingCapacity user_id={user_id} />}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {user_id && <AutoNudgeImpact user_id={user_id} />}
        </div>
      </div>

      {/* 2-column row */}
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          {user_id && profileLoaded && <ClientHealth user_id={user_id} sms_engaged_current_week={sms_engaged_current_week} />}
        </div>
        <div className="col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          {user_id && <AutoNudgeHistory user_id={user_id} />}
        </div>
      </div>

    </div>
  )
}