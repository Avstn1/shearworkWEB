'use client'

import React from 'react'
import { Appointment } from '@/utils/types'

interface Props {
  appointment: Appointment
}

const AppointmentCard: React.FC<Props> = ({ appointment }) => {
  return (
    <div className="w-80 bg-[var(--accent-2)] p-6 rounded-2xl shadow-lg hover:shadow-2xl transition-transform transform hover:-translate-y-1 flex flex-col justify-between text-[var(--foreground)]">
      <div className="mb-4">
        <span className="text-[var(--accent-4)] text-sm">{appointment.date || '—'}</span>
        <h3 className="text-[var(--foreground)] text-xl font-semibold mt-1">
          {appointment.client_name || appointment.name}
        </h3>
        <span className="text-[var(--accent-1)] text-sm">
          {appointment.service || `Clients: ${appointment.clients}`}
        </span>
      </div>
      <div className="text-[var(--background)] font-bold text-2xl">
        ${appointment.price || appointment.earnings}
      </div>
    </div>
  )
}

export default AppointmentCard
