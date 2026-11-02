'use client'

import React from 'react'
import { Appointment } from '@/utils/types'

interface Props {
  appointment: Appointment
}

const AppointmentCard: React.FC<Props> = ({ appointment }) => {
  return (
    <div className="panel flex w-80 flex-col justify-between p-5 text-ivory">
      <div className="mb-4">
        <span className="text-xs tabular-nums text-muted">{appointment.date || '—'}</span>
        <h3 className="mt-1 text-[15px] font-semibold text-ivory">
          {appointment.client_name || appointment.name}
        </h3>
        <span className="text-[13px] text-gray-400">
          {appointment.service || `Clients: ${appointment.clients}`}
        </span>
      </div>
      <div className="text-2xl font-semibold tabular-nums text-ivory">
        ${appointment.price || appointment.earnings}
      </div>
    </div>
  )
}

export default AppointmentCard
