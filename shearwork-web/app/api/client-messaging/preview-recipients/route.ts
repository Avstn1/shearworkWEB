// app/api/sms/preview-recipients/route.ts
'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { selectClientsForSMS } from '@/lib/clientSmsSelectionAlgorithm_DSLV'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: Request) {
  try {
    // Authenticate user
    const { user } = await getAuthenticatedUser(request)
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get limit from query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    // Select clients using the algorithm
    const selectedClients = await selectClientsForSMS(supabase, user.id, limit)

    if (selectedClients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible clients found',
        clients: [],
        stats: {
          total_selected: 0,
          breakdown: {},
          avg_score: 0,
          avg_days_overdue: 0
        }
      })
    }

    // Calculate statistics
    const breakdown = selectedClients.reduce((acc, client) => {
      const type = client.visiting_type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const stats = {
      total_selected: selectedClients.length,
      breakdown,
      avg_score: (selectedClients.reduce((sum, c) => sum + c.score, 0) / selectedClients.length).toFixed(2),
      avg_days_overdue: (selectedClients.reduce((sum, c) => sum + c.days_overdue, 0) / selectedClients.length).toFixed(2),
      avg_days_since_last_visit: (selectedClients.reduce((sum, c) => sum + c.days_since_last_visit, 0) / selectedClients.length).toFixed(2)
    }

    return NextResponse.json({
      success: true,
      clients: selectedClients,
      stats,
      timestamp: new Date().toISOString()
    })

  } catch (err: any) {
    console.error('❌ Error previewing SMS recipients:', err)
    return NextResponse.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}