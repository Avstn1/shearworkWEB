// app/api/client-messaging/preview-recipients/route.ts
'use server'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { selectClientsForSMS_AutoNudge } from '@/lib/clientSmsSelectionAlgorithm_AutoNudge' 
import { selectClientsForSMS_Campaign } from '@/lib/clientSmsSelectionAlgorithm_Campaign'
import { selectClientsForSMS_Mass } from '@/lib/clientSmsSelectionAlgorithm_Mass'

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
    const limit = parseInt(searchParams.get('limit') || '50')

    // Select clients using the algorithm
    const algorithm = searchParams.get('algorithm')

    const messageId = searchParams.get('messageId')

    let selectedClients;
    let result;

    if (algorithm === 'auto-nudge') {
      selectedClients = await selectClientsForSMS_AutoNudge(supabase, userId, limit, visitingType || undefined)
    } else if (algorithm === 'mass') {
       result = await selectClientsForSMS_Mass(supabase, userId, limit || undefined, messageId ?? undefined);
      selectedClients = result.clients;
    } else {
      result = await selectClientsForSMS_Campaign(supabase, userId, limit || undefined, messageId ?? undefined);
      selectedClients = result.clients;
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
      phone_normalized: client.phone_normalized,
      client_id: client.client_id ?? null,
      primary_service: (client as { primary_service?: string | null }).primary_service ?? null,
    }))

    // Calculate statistics
    const breakdown = selectedClients.reduce((acc, client) => {
      const type = client.visiting_type || 'unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Filter out clients that don't have required stats (manually selected clients from Other Clients tab)
    const clientsWithStats = selectedClients.filter(c => 
      c.score !== undefined && 
      c.days_overdue !== undefined && 
      c.days_since_last_visit !== undefined
    );

    const stats = {
      total_selected: selectedClients.length, // Total includes all clients
      breakdown,
      avg_score: clientsWithStats.length > 0 
        ? (clientsWithStats.reduce((sum, c) => sum + c.score, 0) / clientsWithStats.length).toFixed(2)
        : '0.00',
      avg_days_overdue: clientsWithStats.length > 0
        ? (clientsWithStats.reduce((sum, c) => sum + c.days_overdue, 0) / clientsWithStats.length).toFixed(2)
        : '0.00',
      avg_days_since_last_visit: clientsWithStats.length > 0
        ? (clientsWithStats.reduce((sum, c) => sum + c.days_since_last_visit, 0) / clientsWithStats.length).toFixed(2)
        : '0.00'
    }

    return NextResponse.json({
      success: true,
      clients: selectedClients,
      deselectedClients: result?.deselectedClients,
      phoneNumbers,
      stats,
      timestamp: new Date().toISOString(),
      maxClient: result?.totalAvailableClients
    })

  } catch (err: unknown) {
    console.error('❌ Error previewing SMS recipients:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  return GET(request)
}
