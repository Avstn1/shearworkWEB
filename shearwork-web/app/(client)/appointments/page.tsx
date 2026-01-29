'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

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

  if (isLoading && loading) return <p>Loading...</p>

  return (
    <ul>
      {appointments.map((a) => (
        <li key={a.id}>{a.firstName} {a.lastName} - {a.date}</li>
      ))}
    </ul>
  )
}
