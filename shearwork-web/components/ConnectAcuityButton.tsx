'use client'

import { useEffect, useState } from 'react'

interface ConnectAcuityButtonProps {
  onConnectSuccess?: () => void
  onBeforeConnect?: () => Promise<boolean | void>
  disabled?: boolean
  disabledReason?: string
}

export default function ConnectAcuityButton({
  onConnectSuccess,
  onBeforeConnect,
  disabled = false,
  disabledReason,
}: ConnectAcuityButtonProps) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)

  // Track initial connection state
  const [initialConnected, setInitialConnected] = useState<boolean | null>(null)

  useEffect(() => {
    const fetchConnectionStatus = async () => {
      try {
        const res = await fetch('/api/acuity/status')
        const data = await res.json()
        setConnected(data.connected)
        setInitialConnected(data.connected) // save initial state
      } catch (err) {
        console.error('Error checking Acuity connection:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchConnectionStatus()
  }, [])

  const handleConnect = async () => {
    if (disabled || preparing) return
    setPreparing(true)

    try {
      if (onBeforeConnect) {
        const result = await onBeforeConnect()
        if (result === false) {
          setPreparing(false)
          return
        }
      }

      // Redirect to Acuity OAuth
      window.location.href = '/api/acuity/authorize'
    } catch (err) {
      console.error('Acuity connect error:', err)
      setPreparing(false)
    }
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

  // 🔹 Detect first successful connection after initial state
  useEffect(() => {
    if (connected && initialConnected === false && onConnectSuccess) {
      // First time connecting
      onConnectSuccess()
    }
  }, [connected, initialConnected, onConnectSuccess])

  if (loading) {
    return <button className="px-4 py-2 bg-gray-400 text-white rounded-lg">Loading connect acuity button...</button>
  }

  return connected ? (
    <button
      type="button"
      onClick={handleDisconnect}
      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
    >
      Disconnect Acuity
    </button>
  ) : (
    <button
      type="button"
      onClick={handleConnect}
      disabled={disabled || preparing}
      title={disabledReason}
      className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ${
        disabled || preparing ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      {preparing ? 'Preparing...' : 'Connect to Acuity'}
    </button>
  )
}
