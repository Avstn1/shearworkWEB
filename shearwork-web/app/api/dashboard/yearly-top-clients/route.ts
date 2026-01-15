import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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

    const monthRange = MONTHS.slice(startMonth - 1, endMonth)

    const { data, error } = await supabase
      .from('report_top_clients')
      .select('client_id, client_name, total_paid, num_visits, client_key, month')
      .eq('user_id', user.id)
      .eq('year', year)
      .in('month', monthRange)

    if (error) {
      console.error('Yearly top clients error:', error)
      return NextResponse.json({ error: 'Failed to fetch top clients' }, { status: 500 })
    }

    const totals = new Map<string, {
      client_id: string
      client_name: string
      total_spent: number
      num_visits: number
    }>()

    for (const row of data || []) {
      const key = row.client_key || row.client_id
      if (!key) continue

      const existing = totals.get(key) || {
        client_id: row.client_id,
        client_name: row.client_name || 'Unknown',
        total_spent: 0,
        num_visits: 0,
      }

      existing.total_spent += Number(row.total_paid || 0)
      existing.num_visits += Number(row.num_visits || 0)

      totals.set(key, existing)
    }

    const clients = Array.from(totals.values())
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, limit)

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