'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Layout from '@/components/Layout'
import DashboardHeader from '@/components/DashboardHeader'
import StatsCard from '@/components/StatsCard'
import SectionCard from '@/components/SectionCard'
import AppointmentCard from '@/components/AppointmentCard'
import RevenueProgressCard from '@/components/RevenueProgressCard'
import SummaryCarousel, { Summary } from '@/components/SummaryCarousel'
import { supabase } from '@/utils/supabaseClient'
import { Appointment } from '@/utils/types'

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

  // mock projection for progress (later we’ll pull from DB)
  const projectedRevenue = 2000
  const actualRevenue = appointments.reduce((acc, a) => acc + (a.price || 0), 0)

  return (
    <Layout>
      <motion.div
        className="w-full h-screen px-6 md:px-12 py-6 space-y-6 text-[var(--foreground)] overflow-hidden flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <DashboardHeader />

        {/* Top Stats Row */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 flex-none"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <StatsCard title="Appointments" value={appointments.length} />
          <StatsCard title="Clients" value={new Set(appointments.map(a => a.client_name)).size} />
          <StatsCard title="Revenue" value={`$${actualRevenue}`} />
        </motion.div>

        {/* Revenue Progress + Recent Appointments */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 flex-[1.5] min-h-0"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <RevenueProgressCard actual={actualRevenue} projected={projectedRevenue} className="sm:w-1/3" />

          <SectionCard
            title="Recent Appointments"
            loading={loading}
            error={error}
            className="flex-1 min-h-0 overflow-hidden"
          >
            {appointments.length === 0 ? (
              <p className="text-[var(--text-muted)] text-center">No appointments found.</p>
            ) : (
              <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 hide-scrollbar">
                {appointments.map((a) => (
                  <div key={a.id} className="snap-start flex-shrink-0 min-w-[240px] sm:min-w-[260px]">
                    <AppointmentCard appointment={a} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </motion.div>

        {/* Daily Summaries */}
        <motion.div
          className="flex-1 min-h-0"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <SectionCard title="Daily Summaries" loading={loading} error={error} className="h-full overflow-hidden">
            {dailySummaries.length > 0 ? (
              <SummaryCarousel summaries={dailySummaries} />
            ) : (
              <p className="text-[var(--text-dark)]">No summaries yet.</p>
            )}
          </SectionCard>
        </motion.div>
      </motion.div>

      <style jsx>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          scrollbar-width: none;
        }
      `}</style>
    </Layout>
  )
}
