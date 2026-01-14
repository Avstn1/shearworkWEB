// app/api/square/pull-appointments/route.ts
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

function squareBaseUrl() {
	return process.env.SQUARE_ENV === 'production'
		? 'https://connect.squareup.com'
		: 'https://connect.squareupsandbox.com'
}

function normalizePhone(phone?: string | null) {
	return phone ? phone.replace(/\D/g, '') : ''
}

export async function GET(request: Request) {
	try {
		const { user, supabase } = await getAuthenticatedUser(request)
		if (!user || !supabase) {
			return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
		}

		// Get Square token
		const { data: tokenRow, error: tokenErr } = await supabase
			.from('square_tokens')
			.select('access_token, merchant_id')
			.eq('user_id', user.id)
			.single()

		if (tokenErr || !tokenRow?.access_token) {
			return NextResponse.json(
				{ error: 'No Square connection found' },
				{ status: 400 },
			)
		}

		const accessToken = tokenRow.access_token
		const merchantId = tokenRow.merchant_id
		const { searchParams } = new URL(request.url)

		// Get date range (default: current month)
		const now = new Date()
		const startDate = searchParams.get('start_date') ||
			new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
		const endDate = searchParams.get('end_date') ||
			new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

		// Fetch appointments with pagination
		const allAppointments: any[] = []
		let cursor: string | null = null

		do {
			const url = new URL(`${squareBaseUrl()}/v2/bookings`)
			url.searchParams.set('start_at', `${startDate}T00:00:00Z`)
			url.searchParams.set('end_at', `${endDate}T23:59:59Z`)
			url.searchParams.set('limit', '100')
			if (cursor) url.searchParams.set('cursor', cursor)

			const res = await fetch(url.toString(), {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Square-Version': '2024-01-23',
				},
			})

			if (!res.ok) {
				const errorData = await res.json()
				return NextResponse.json(
					{
						error: 'Square Bookings API failed',
						details: errorData,
						status: res.status
					},
					{ status: 500 },
				)
			}

			const data = await res.json()

			if (Array.isArray(data.bookings)) {
				allAppointments.push(...data.bookings)
			}

			cursor = data.cursor || null

			// Small delay to avoid rate limiting
			if (cursor) {
				await new Promise(resolve => setTimeout(resolve, 100))
			}
		} while (cursor)

		// Transform to match your square_appointments table schema
		const rows = allAppointments
			.filter((booking: any) => booking?.id && booking?.customer_id)
			.map((booking: any) => {
				const startTime = booking.start_at ? new Date(booking.start_at) : null
				const appointmentDate = startTime ? startTime.toISOString().split('T')[0] : null

				// Extract phone from booking or customer details
				const phone = booking.customer_phone ||
					booking.customer_details?.phone_number ||
					null
				const phoneNormalized = normalizePhone(phone)

				// Try to extract price - Square bookings might have appointment segments with price
				let revenue = 0
				if (booking.appointment_segments && booking.appointment_segments.length > 0) {
					const segment = booking.appointment_segments[0]
					if (segment.service_variation_price_money) {
						revenue = parseFloat(segment.service_variation_price_money.amount) / 100
					}
				}

				return {
					user_id: user.id,
					merchant_id: merchantId,
					location_id: booking.location_id || null,
					square_booking_id: booking.id,
					customer_id: booking.customer_id,
					phone_normalized: phoneNormalized,
					appointment_date: appointmentDate,
					datetime: booking.start_at || null,
					revenue: revenue,
					tip: 0, // Tips might come from payments API, not bookings
					service_type: booking.appointment_segments?.[0]?.service_variation_name || null,
					team_member_id: booking.team_member_id || null,
					order_id: booking.order_id || null,
					payment_id: null, // Bookings don't have payment ID directly
					status: booking.status || null,
					notes: booking.customer_note || null,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				}
			})

		// Upsert into square_appointments
		const { error: upsertErr } = await supabase
			.from('square_appointments')
			.upsert(rows, {
				onConflict: 'user_id,square_booking_id',
				ignoreDuplicates: false
			})

		if (upsertErr) {
			console.error('Square appointments upsert error:', upsertErr)
			return NextResponse.json(
				{ error: 'Failed to save appointments', details: upsertErr.message },
				{ status: 500 },
			)
		}

		return NextResponse.json({
			success: true,
			totalFetched: allAppointments.length,
			totalUpserted: rows.length,
			merchantId,
			dateRange: { startDate, endDate },
			syncedAt: new Date().toISOString(),
		})

	} catch (error: any) {
		console.error('Square appointments sync error:', error)
		return NextResponse.json(
			{ error: 'Internal server error', details: error.message },
			{ status: 500 },
		)
	}
}
