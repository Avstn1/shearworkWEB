'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import AutoNudgeStatus from '@/components/AutoNudgeDashboard/AutoNudgeStatus'
import OpenBookings from '@/components/AutoNudgeDashboard/OpenBookings'
import BookingCapacity from '@/components/AutoNudgeDashboard/BookingCapacity'
import AutoNudgeImpact from '@/components/AutoNudgeDashboard/AutoNudgeImpact'
import ClientHealth from '@/components/AutoNudgeDashboard/ClientHealth'
import AutoNudgeHistory from '@/components/AutoNudgeDashboard/AutoNudgeHistory'

export default function DashboardPage() {
  const [user_id, setUser_id] = useState<string | null>(null)
  const [sms_engaged_current_week, setSms_engaged_current_week] = useState<boolean>(false)
  const [dateAutonudgeEnabled, setDateAutonudgeEnabled] = useState<string | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)

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
        .select('sms_engaged_current_week, special_access, date_autonudge_enabled')
        .eq('user_id', user.id)
        .single()

      setSms_engaged_current_week(profile?.sms_engaged_current_week ?? false)
      setDateAutonudgeEnabled(profile?.date_autonudge_enabled ?? null)
      setUser_id(user.id)
      setProfileLoaded(true)

      void supabase.functions
        .invoke('update_barber_availability', {
          body: {
            user_id: user.id,
            force_refresh: false,
          },
        })
        .catch((err) => {
          console.error('Availability update failed:', err)
        })
    }
    getUser()
  }, [])

  if (!profileLoaded) return null

  return (
    <div
      className="flex flex-col bg-gradient-to-br from-[#101312] via-[#1a1f1b] to-[#2e3b2b] p-3 pt-4 gap-3"
      style={{
        height: 'calc(100dvh - var(--navbar-height, 72px))',
        marginTop: 'var(--navbar-height, 72px)',
      }}
    >

      {/* ── TOP ROW ── */}

      {/* Mobile: 3 cards in a row + Corva's Impact full width below */}
      <div className="flex flex-col gap-3 flex-shrink-0 md:hidden">
        <div className="grid grid-cols-3 gap-3" style={{ height: 178 }}>
          <div className="rounded-2xl border border-white/10 bg-white/5">
            <AutoNudgeStatus user_id={user_id!} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5">
            <OpenBookings user_id={user_id!} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5">
            <BookingCapacity user_id={user_id!} />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5" style={{ height: 100 }}>
          <AutoNudgeImpact user_id={user_id!} />
        </div>
      </div>

      {/* Desktop: original grid with explicit height */}
      <div className="hidden md:grid grid-cols-3 gap-4 flex-shrink-0" style={{ height: '28%' }}>
        <div className="rounded-2xl border border-white/10 bg-white/5">
          <AutoNudgeStatus user_id={user_id!} />
        </div>
        <div className="col-span-2 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5">
            <OpenBookings user_id={user_id!} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5">
            <BookingCapacity user_id={user_id!} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5">
            <AutoNudgeImpact user_id={user_id!} />
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW ── */}

      {/* Mobile: stacked + scrollable */}
      <div className="flex flex-col gap-3 flex-1 min-h-0 md:hidden overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex-shrink-0" style={{ height: 420 }}>
          <ClientHealth
            user_id={user_id!}
            sms_engaged_current_week={sms_engaged_current_week}
            date_autonudge_enabled={dateAutonudgeEnabled}
            onNudgeSuccess={() => setHistoryKey(k => k + 1)}
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex-shrink-0" style={{ minHeight: 380 }}>
          <AutoNudgeHistory key={historyKey} user_id={user_id!} />
        </div>
      </div>

      {/* Desktop: side by side */}
      <div className="hidden md:grid grid-cols-3 gap-4 flex-1 min-h-0">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 overflow-hidden">
          <ClientHealth
            user_id={user_id!}
            sms_engaged_current_week={sms_engaged_current_week}
            date_autonudge_enabled={dateAutonudgeEnabled}
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
