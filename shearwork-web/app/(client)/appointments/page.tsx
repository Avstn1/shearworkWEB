'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import { AppPage, PageHeader, Panel } from '@/components/ui/AppKit'

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { user, profile, isLoading } = useAuth()

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await fetch('/api/acuity/pull?endpoint=appointments')
        const data = await res.json()
        setAppointments(data.data || [])
      } catch (err) {
        console.error('Error fetching appointments:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAppointments()
  }, [])

  return (
    <AppPage>
      <PageHeader title="Appointments" />
      <Panel bodyClassName="">
        {isLoading && loading ? (
          <div className="empty-state">
            <Loader2 className="animate-spin" aria-hidden="true" />
            <p>Loading...</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {appointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="font-medium text-ivory">{a.firstName} {a.lastName}</span>
                <span className="tabular-nums text-muted">{a.date}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppPage>
  )
}
