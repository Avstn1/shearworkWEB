'use client'

import React, { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import AppointmentCard from '@/components/AppointmentCard'
import UserProfile from '@/components/UserProfile'
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
        if (!session) {
          setAppointments([])
          setDailySummaries([])
          return
        }

        const userId = session.user.id

        const { data: appointmentsData, error: appointmentsError } = await supabase
          .from('barber_data')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })

        if (appointmentsError) setError(appointmentsError.message)
        else setAppointments(appointmentsData || [])

        const { data: summaryData, error: summaryError } = await supabase
          .from('daily_summaries')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false })

        if (summaryError) console.error(summaryError.message)
        else setDailySummaries(summaryData || [])
      } catch (err: any) {
        setAppointments([])
        setDailySummaries([])
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <Layout>
      <div className="flex flex-col items-center w-full px-4 md:px-8 my-8">
        {/* Header */}
        <div className="flex justify-between items-center w-full max-w-[100%] mb-10">
          <h1 className="text-5xl font-extrabold text-[var(--accent-3)]">Dashboard</h1>
          <UserProfile />
        </div>

        {/* Loading / Error */}
        {loading && <p className="text-[var(--accent-2)]">Loading data...</p>}
        {error && (
          <p className="text-red-600 bg-[var(--accent-2)]/20 p-2 rounded">
            {error}
          </p>
        )}

        {/* Daily Summaries Carousel */}
        {!loading && !error && dailySummaries.length > 0 && (
          <div className="w-full max-w-6xl overflow-visible">
            <h2 className="text-3xl font-semibold mb-6 text-[var(--accent-2)]">
              Daily Summaries
            </h2>
            <SummaryCarousel summaries={dailySummaries} />
          </div>
        )}

        {/* Appointments */}
        {!loading && !error && (
          <div className="w-full max-w-6xl overflow-visible">
            <h2 className="text-3xl font-semibold mb-6 text-[var(--accent-2)]">
              Recent Appointments
            </h2>
            {appointments.length === 0 ? (
              <p className="text-[var(--accent-2)] text-center">
                No appointments found.
              </p>
            ) : (
              <div className="">
                <div className="flex gap-6 snap-x snap-mandatory scroll-px-6">
                  {appointments.map((a) => (
                    <div
                      key={a.id}
                      className="snap-start flex-shrink-0"
                      style={{ minWidth: '300px', maxWidth: 'calc(100vw - 6rem)' }}
                    >
                      <AppointmentCard appointment={a} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
