'use client'

import { useState } from 'react'

export default function Analytics() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handlePopulate = async () => {
    setLoading(true)
    setMessage('')

    try {
      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = String(today.getDate()).padStart(2, '0')
      const targetDate = `${yyyy}-${mm}-${dd}`

      const res = await fetch('/api/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ targetDate }),
      })

      const data = await res.json()
      setMessage(JSON.stringify(data))
    } catch (err) {
      setMessage('Error: ' + err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <button
        onClick={handlePopulate}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Populating...' : 'Populate Summaries'}
      </button>
      {message && <pre className="mt-4 text-sm">{message}</pre>}
    </div>
  )
}
