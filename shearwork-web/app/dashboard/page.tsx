'use client'

import React, { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import DashboardHeader from '@/components/DashboardHeader'
import StatsCard from '@/components/StatsCard'
import SectionCard from '@/components/SectionCard'
import AppointmentCard from '@/components/AppointmentCard'
import { supabase } from '@/utils/supabaseClient'
import { Appointment } from '@/utils/types'
import SummaryCarousel, { Summary } from '@/components/SummaryCarousel'

export default function DashboardPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [dailySummaries, setDailySummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const userId = session.user.id

        const { data: appointmentsData } = await supabase
          .from('barber_data')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })

        setAppointments(appointmentsData || [])

        const { data: summaryData } = await supabase
          .from('daily_summaries')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })

        setDailySummaries(summaryData || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <Layout>
      <div className="w-full px-6 md:px-12 py-8 space-y-8 text-[var(--foreground)] overflow-hidden">
        <DashboardHeader />

        {/* Top Stats Row - More Compact */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatsCard title="Appointments" value={appointments.length} />
          <StatsCard title="Clients" value={new Set(appointments.map(a => a.client_name)).size} />
          <StatsCard title="Revenue" value={`$${appointments.reduce((acc, a) => acc + (a.price || 0), 0)}`} />
        </div>

        {/* Daily Summaries */}
        <SectionCard title="Daily Summaries" loading={loading} error={error} className="flex-1">
          {dailySummaries.length > 0 ? (
            <SummaryCarousel summaries={dailySummaries} />
          ) : (
            <p className="text-[var(--text-dark)]">No summaries yet.</p>
          )}
        </SectionCard>

        {/* Recent Appointments */}
        <SectionCard title="Recent Appointments" loading={loading} error={error} className="flex-1">
          {appointments.length === 0 ? (
            <p className="text-[var(--text-muted)] text-center">No appointments found.</p>
          ) : (
            <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2">
              {appointments.map((a) => (
                <div key={a.id} className="snap-start flex-shrink-0 min-w-[260px] sm:min-w-[280px]">
                  <AppointmentCard appointment={a} />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </Layout>
  )
}
