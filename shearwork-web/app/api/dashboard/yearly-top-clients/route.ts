import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

// Month ranges for quarters
const QUARTER_MONTHS: Record<string, { startMonth: number; endMonth: number }> = {
  year: { startMonth: 1, endMonth: 12 },
  Q1: { startMonth: 1, endMonth: 3 },
  Q2: { startMonth: 4, endMonth: 6 },
  Q3: { startMonth: 7, endMonth: 9 },
  Q4: { startMonth: 10, endMonth: 12 },
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const timeframe = searchParams.get('timeframe') || 'year'
    const limit = parseInt(searchParams.get('limit') || '5')

    const quarterConfig = QUARTER_MONTHS[timeframe] || QUARTER_MONTHS['year']
    const { startMonth, endMonth } = quarterConfig

    console.log('Yearly top clients RPC call:', { year, timeframe, startMonth, endMonth, limit })

    // Call RPC function
    const { data, error } = await supabase.rpc('get_yearly_top_clients', {
      p_user_id: user.id,
      p_year: year,
      p_start_month: startMonth,
      p_end_month: endMonth,
      p_limit: limit,
    })

    if (error) {
      console.error('RPC error:', error)
      return NextResponse.json({ error: 'Failed to fetch top clients' }, { status: 500 })
    }

    console.log('Yearly top clients result:', data)

    // Format response
    const clients = (data || []).map((row: any) => ({
      client_id: row.client_id,
      client_name: row.client_name,
      total_spent: parseFloat(row.total_spent) || 0,
      num_visits: parseInt(row.num_visits) || 0,
    }))

    return NextResponse.json({
      clients,
      total: clients.length,
      year,
      timeframe,
    })
  } catch (err: any) {
    console.error('Yearly top clients error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}