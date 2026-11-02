'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface Props {
  barberId: string
  month: string
}

const handleNumericChange = (
  e: React.ChangeEvent<HTMLInputElement>,
  onChange: (val: string) => void
) => {
  const value = e.target.value
  if (value === '' || /^\d*\.?\d*$/.test(value)) {
    onChange(value)
  }
}

export default function AdminAverageTicketEditor({ barberId, month }: Props) {
  const [avgTicket, setAvgTicket] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [recordExists, setRecordExists] = useState<boolean>(false)

  const year = new Date().getFullYear()

  useEffect(() => {
    if (!barberId) return
    fetchAvgTicket()
  }, [barberId, month])

  const fetchAvgTicket = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('monthly_data')
        .select('avg_ticket')
        .eq('user_id', barberId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle()

      if (error) throw error

      setRecordExists(!!data)
      setAvgTicket(data?.avg_ticket?.toString() ?? '')
    } catch (err) {
      console.error(err)
      toast.error('Failed to load average ticket.')
    } finally {
      setLoading(false)
    }
  }

  const saveAvgTicket = async () => {
    if (avgTicket === '' || isNaN(Number(avgTicket))) {
      return toast.error('Enter a valid average ticket.')
    }

    const ticketNumber = Number(avgTicket)
    setLoading(true)

    const { error } = await supabase
      .from('monthly_data')
      .upsert(
        {
          user_id: barberId,
          month,
          year,
          avg_ticket: ticketNumber,
        },
        {
          onConflict: 'user_id,month,year', // match same unique constraint
        }
      )

    setLoading(false)

    if (error) {
      console.error(error)
      toast.error('Failed to save average ticket.')
    } else {
      toast.success('Average Ticket saved successfully!')
      setRecordExists(true)
    }
  }

  return (
    <section className="panel">
      <header className="panel-header">
        <div className="min-w-0">
          <h3 className="panel-title">Average ticket</h3>
          <p className="panel-subtitle">{month} {year}</p>
        </div>
      </header>
      <div className="panel-body">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="field-label">Avg ticket</label>
            <input
              type="text"
              inputMode="decimal"
              value={avgTicket}
              onChange={e => handleNumericChange(e, setAvgTicket)}
              placeholder="Avg ticket"
              className="field tabular-nums"
            />
          </div>
          <button
            onClick={saveAvgTicket}
            disabled={loading}
            className="btn btn-primary btn-sm"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
        {recordExists && <p className="mt-3 text-xs text-muted">Existing record updated on save.</p>}
      </div>
    </section>
  )
}
