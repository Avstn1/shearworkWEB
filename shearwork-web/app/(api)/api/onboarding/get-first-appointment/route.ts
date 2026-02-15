// app/api/onboarding/get-first-appointment/route.ts
import { getAuthenticatedUser } from '@/utils/api-auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const { user, supabase } = await getAuthenticatedUser(request)

    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 404 })
    }

    // Get Acuity tokens
    const { data: acuityTokens, error: tokensError } = await supabase
      .from('acuity_tokens')
      .select('access_token, calendar_id')
      .eq('user_id', user.id)
      .single()

    if (tokensError || !acuityTokens?.access_token || !acuityTokens?.calendar_id) {
      return NextResponse.json({ error: 'Acuity not connected' }, { status: 404 })
    }

    // Fetch first appointment from Acuity
    const url = new URL('https://acuityscheduling.com/api/v1/appointments')
    url.searchParams.set('max', '1')
    url.searchParams.set('calendarID', String(acuityTokens.calendar_id))
    url.searchParams.set('direction', 'ASC')

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${acuityTokens.access_token}`,
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch from Acuity' }, { status: response.status })
    }

    const appointments = await response.json()

    if (!appointments || appointments.length === 0) {
      return NextResponse.json({ firstAppointment: null })
    }

    // Return the first appointment
    return NextResponse.json({ firstAppointment: appointments[0] })
  } catch (error) {
    console.error('Error fetching first appointment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}