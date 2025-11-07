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
    <div className="bg-[#1f1f1a] p-4 rounded-lg shadow-md">
      <h3 className="text-[#E8EDC7] font-semibold mb-3 text-lg">💵 Average Ticket Editor</h3>
      <div className="flex items-center gap-3 mb-3">
        <input
          type="text"
          inputMode="decimal"
          value={avgTicket}
          onChange={e => handleNumericChange(e, setAvgTicket)}
          placeholder="Avg ticket"
          className="p-2 rounded bg-[#2b2b2b] text-white w-32"
        />
        <button
          onClick={saveAvgTicket}
          disabled={loading}
          className="px-4 py-2 bg-[#445539] text-white rounded hover:bg-[#4d6544]"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
      {recordExists && <p className="text-sm text-gray-400">Existing record updated on save.</p>}
    </div>
  )
}
