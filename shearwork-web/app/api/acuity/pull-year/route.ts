'use server'

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)
  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const requestedYear = searchParams.get('year')
    ? parseInt(searchParams.get('year') as string, 10)
    : null

  if (!requestedYear) {
    return NextResponse.json(
      { error: 'Year parameter required' },
      { status: 400 },
    )
  }

  console.log(`\n=== STARTING YEAR SYNC: ${requestedYear} for user ${user.id} ===`)

  try {
    // Call the monthly endpoint for each month
    const results = []
    
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const month = MONTHS[monthIndex]
      
      console.log(`Processing ${month} ${requestedYear}...`)
      
      // Call the existing monthly sync endpoint
      const monthUrl = new URL(request.url)
      monthUrl.pathname = '/api/acuity/pull'
      monthUrl.searchParams.set('endpoint', 'appointments')
      monthUrl.searchParams.set('month', month)
      monthUrl.searchParams.set('year', requestedYear.toString())
      
      const monthResponse = await fetch(monthUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': request.headers.get('Authorization') || '',
          'X-User-Id': request.headers.get('X-User-Id') || '',
          'x-vercel-protection-bypass': request.headers.get('x-vercel-protection-bypass') || '',
        }
      })
      
      if (!monthResponse.ok) {
        const errorText = await monthResponse.text()
        console.error(`Failed to sync ${month} ${requestedYear}:`, errorText)
        results.push({ month, success: false, error: errorText })
      } else {
        const data = await monthResponse.json()
        console.log(`✓ ${month} ${requestedYear} completed`)
        results.push({ month, success: true, data })
      }
    }
    
    // Calculate totals
    const totalAppointments = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + (r.data?.acuity_data?.length || 0), 0)
    
    // Get unique client count from database
    const { data: clients } = await supabase
      .from('acuity_clients')
      .select('client_id')
      .eq('user_id', user.id)
    
    console.log(`\n=== YEAR SYNC COMPLETE: ${requestedYear} ===`)
    console.log(`Total appointments processed: ${totalAppointments}`)
    console.log(`Total unique clients: ${clients?.length || 0}`)
    
    return NextResponse.json({
      success: true,
      year: requestedYear,
      totalAppointments,
      totalClients: clients?.length || 0,
      monthResults: results
    })
    
  } catch (error) {
    console.error('Year sync error:', error)
    return NextResponse.json(
      { error: 'Year sync failed', details: String(error) },
      { status: 500 }
    )
  }
}