'use client'

import { useEffect, useState } from 'react'

interface ConnectAcuityButtonProps {
  onConnectSuccess?: () => void
  onBeforeConnect?: () => Promise<boolean | void>
  disabled?: boolean
  disabledReason?: string
  className?: string
  variant?: 'primary' | 'secondary'
}

export default function ConnectAcuityButton({
  onConnectSuccess,
  onBeforeConnect,
  disabled = false,
  disabledReason,
  className = '',
  variant = 'primary',
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
    return <button type="button" disabled className={`btn btn-glass btn-sm ${className}`}>Loading...</button>
  }

  const baseClass = variant === 'secondary' ? 'btn-glass' : 'btn-primary'

  return connected ? (
    <button
      type="button"
      onClick={handleDisconnect}
      className={`btn btn-glass btn-sm text-[#FF8F7D] ${className}`}
    >
      Disconnect Acuity
    </button>
  ) : (
    <button
      type="button"
      onClick={handleConnect}
      disabled={disabled || preparing}
      title={disabledReason}
      className={`btn btn-sm ${baseClass} ${className}`}
    >
      {preparing ? 'Preparing...' : 'Connect to Acuity'}
    </button>
  )
}
