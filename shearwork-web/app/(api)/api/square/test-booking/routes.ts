// app/api/square/test-bookings/route.ts
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: Request) {
	const { user, supabase } = await getAuthenticatedUser(request)
	if (!user || !supabase) {
		return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
	}

	const { data: tokenRow } = await supabase
		.from('square_tokens')
		.select('access_token, merchant_id')
		.eq('user_id', user.id)
		.single()

	if (!tokenRow?.access_token) {
		return NextResponse.json({ error: 'No Square connection' }, { status: 400 })
	}

	const baseUrl = process.env.SQUARE_ENV === 'production'
		? 'https://connect.squareup.com'
		: 'https://connect.squareupsandbox.com'

	// Try to fetch bookings to see if feature is available
	const today = new Date().toISOString().split('T')[0]
	const url = `${baseUrl}/v2/bookings?start_at=${today}T00:00:00Z&end_at=${today}T23:59:59Z&limit=1`

	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${tokenRow.access_token}`,
			'Square-Version': '2024-01-23',
		},
	})

	const data = await res.json()

	return NextResponse.json({
		success: res.ok,
		hasBookingsFeature: res.ok && Array.isArray(data.bookings),
		status: res.status,
		response: data,
	})
}
