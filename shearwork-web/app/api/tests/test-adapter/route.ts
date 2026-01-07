// app/api/test-adapter/route.ts

import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { getBookingAdapter } from '@/lib/booking/adapters'

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)
  
  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const results: Record<string, any> = {}

  try {
    // Test 1: Factory lookup
    const adapter = getBookingAdapter('acuity')
    results.adapterName = adapter.name

    // Test 2: Token
    const token = await adapter.ensureValidToken(supabase, user.id)
    results.tokenValid = true
    results.tokenPreview = token.substring(0, 20) + '...'

    // Test 3: Calendar
    const calendarId = await adapter.getCalendarId(token, supabase, user.id)
    results.calendarId = calendarId

    // Test 4: Fetch one week of appointments
    const appointments = await adapter.fetchAppointments(token, calendarId, {
      startISO: '2025-01-01',
      endISO: '2025-01-07',
    })
    results.appointmentCount = appointments.length
    results.sampleAppointment = appointments[0] || null

    // Test 5: Invalid adapter throws
    try {
      getBookingAdapter('nonexistent')
      results.invalidAdapterTest = 'FAILED - should have thrown'
    } catch {
      results.invalidAdapterTest = 'PASSED'
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json({ 
      success: false, 
      results,
      error: String(err) 
    }, { status: 500 })
  }
}