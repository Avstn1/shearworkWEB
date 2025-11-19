'use client'
import { useEffect, useState } from 'react'

const ENDPOINTS = [
  'appointments',
  'appointment-addons',
  'appointment-types',
  'availability/dates',
  'availability/times',
  'availability/classes',
  'availability/check-times',
  'blocks',
  'calendars',
  'certificates',
  'clients',
  'forms',
  'labels',
  'me',
  'meta',
  'orders',
  'products',
]

export default function AcuityDataViewer() {
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAllEndpoints = async () => {
      const results: Record<string, any> = {}

      for (const endpoint of ENDPOINTS) {
        try {
          const res = await fetch(`/api/acuity/pull?endpoint=${endpoint}`)
          const json = await res.json()
          results[endpoint] = json.data || json
        } catch (err) {
          console.error(`Error fetching ${endpoint}:`, err)
          results[endpoint] = { error: String(err) }
        }
      }

      setData(results)
      setLoading(false)
      // console.log('Full Acuity API data:', results)
    }

    fetchAllEndpoints()
  }, [])

  if (loading) return <p>Loading Acuity data...</p>

  return (
    <div>
      {Object.entries(data).map(([endpoint, value]) => (
        <div key={endpoint} style={{ marginBottom: '2rem' }}>
          <h2 className="text-lg font-bold">{endpoint}</h2>
          <pre
            style={{
              maxHeight: '300px',
              overflow: 'auto',
              background: '#f4f4f4',
              padding: '1rem',
              color: 'black',          // <-- set text color to black
            }}
          >
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}
