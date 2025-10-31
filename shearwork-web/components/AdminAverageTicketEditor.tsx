'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import toast from 'react-hot-toast'

interface Props {
  barberId: string
  month: string
}

export default function AdminAverageTicketEditor({ barberId, month }: Props) {
  const [avgTicket, setAvgTicket] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!barberId) return
    fetchAvgTicket()
  }, [barberId, month])

  const fetchAvgTicket = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('reports')
      .select('avg_ticket')
      .eq('user_id', barberId)
      .eq('type', 'monthly')
      .eq('month', month)
      .eq('year', new Date().getFullYear())
      .maybeSingle()

    if (error) console.error(error)
    setAvgTicket(data?.avg_ticket ?? '')
    setLoading(false)
  }

  const updateAvgTicket = async () => {
    if (avgTicket === '') return toast.error('Enter a valid average ticket.')
    setLoading(true)
    const { error } = await supabase
      .from('reports')
      .update({ avg_ticket: Number(avgTicket) })
      .eq('user_id', barberId)
      .eq('type', 'monthly')
      .eq('month', month)
      .eq('year', new Date().getFullYear())

    setLoading(false)
    if (error) toast.error('Update failed.')
    else toast.success('Average Ticket updated!')
  }

  return (
    <div className="bg-[#1f1f1a] p-4 rounded-lg shadow-md">
      <h3 className="text-[#E8EDC7] font-semibold mb-3 text-lg">💵 Average Ticket Editor</h3>
      <div className="flex items-center gap-3 mb-3">
        <input
          type="number"
          value={avgTicket}
          onChange={e => setAvgTicket(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="Avg ticket"
          className="p-2 rounded bg-[#2b2b2b] text-white w-32"
        />
        <button
          onClick={updateAvgTicket}
          disabled={loading}
          className="px-4 py-2 bg-[#445539] text-white rounded hover:bg-[#4d6544]"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
