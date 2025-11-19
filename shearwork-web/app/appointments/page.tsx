'use client'
import { useEffect, useState } from 'react'

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const res = await fetch('/api/acuity/pull?endpoint=appointments')
        const data = await res.json()
        // console.log('Appointments data:', data)
        setAppointments(data.data || [])
      } catch (err) {
        console.error('Error fetching appointments:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAppointments()
  }, [])

  if (loading) return <p>Loading...</p>

  return (
    <ul>
      {appointments.map((a) => (
        <li key={a.id}>{a.firstName} {a.lastName} - {a.date}</li>
      ))}
    </ul>
  )
}
