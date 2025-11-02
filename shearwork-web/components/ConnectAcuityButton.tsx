'use client'

import { useEffect, useState } from 'react'

export default function ConnectAcuityButton() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)

  // ✅ Check if user is already connected to Acuity
  useEffect(() => {
    const fetchConnectionStatus = async () => {
      try {
        const res = await fetch('/api/acuity/status')
        const data = await res.json()
        setConnected(data.connected)
      } catch (err) {
        console.error('Error checking Acuity connection:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchConnectionStatus()
  }, [])

  const handleConnect = async () => {
    window.location.href = '/api/acuity/authorize'
  }

  const handleDisconnect = async () => {
    const confirmDisconnect = confirm('Disconnect your Acuity account?')
    if (!confirmDisconnect) return

    const res = await fetch('/api/acuity/disconnect', { method: 'POST' })
    if (res.ok) {
      setConnected(false)
      alert('Acuity disconnected successfully.')
    } else {
      alert('Error disconnecting Acuity.')
    }
  }

  if (loading) {
    return <button className="px-4 py-2 bg-gray-400 text-white rounded-lg">Loading...</button>
  }

  return connected ? (
    <button
      onClick={handleDisconnect}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
    >
      Disconnect Acuity
    </button>
  ) : (
    <button
      onClick={handleConnect}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
    >
      Connect to Acuity
    </button>
  )
}
