// app/api/sms/preview-recipients/route.ts
'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/utils/api-auth'

// import { selectClientsForSMS_DSLV } from '@/lib/clientSmsSelectionAlgorithm_DSLV' 
import { selectClientsForSMS_Overdue } from '@/lib/clientSmsSelectionAlgorithm_Overdue' 
import { selectClientsForSMS_Campaign } from '@/lib/clientSmsSelectionAlgorithm_Campaign' 

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
    // Get limit from query params
    const { searchParams } = new URL(request.url)
    
    const userId = searchParams.get('userId')
    if (!userId) throw new Error('userId is required');

    const visitingType = searchParams.get('visitingType')
    const limit = parseInt(searchParams.get('limit') || '25')

    // Select clients using the algorithm
    const algorithm = searchParams.get('algorithm')

    let selectedClients;

    if (algorithm === 'overdue') {
      selectedClients = await selectClientsForSMS_Overdue(supabase, userId, limit, visitingType || undefined)
    } else {
      selectedClients = await selectClientsForSMS_Campaign(supabase, userId, limit, visitingType || undefined)
    } 

    if (selectedClients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No eligible clients found',
        clients: [],
        phoneNumbers: [],
        stats: {
          total_selected: 0,
          breakdown: {},
          avg_score: 0,
          avg_days_overdue: 0,
          avg_days_since_last_visit: 0
        }
      })
    }

    // Extract phone numbers
    const phoneNumbers = selectedClients.map(client => ({
      full_name: `${client.first_name || ''} ${client.last_name || ''}`.trim(),
      phone_normalized: client.phone_normalized
    }))

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
      phoneNumbers,
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