// app/api/square/test-apis/route.ts
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: Request) {
	try {
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

		const accessToken = tokenRow.access_token
		const headers = {
			'Authorization': `Bearer ${accessToken}`,
			'Square-Version': '2024-01-23',
			'Content-Type': 'application/json',
		}

		const results: any = {}

		// Test 1: Basic API connectivity
		const merchantRes = await fetch(`${baseUrl}/v2/merchants/${tokenRow.merchant_id}`, { headers })
		results.merchant = {
			status: merchantRes.status,
			ok: merchantRes.ok
		}

		// Test 2: Customers (we know this works)
		const customersRes = await fetch(`${baseUrl}/v2/customers?limit=1`, { headers })
		results.customers = {
			status: customersRes.status,
			ok: customersRes.ok
		}

		// Test 3: Try Bookings API
		const today = new Date().toISOString().split('T')[0]
		const bookingsUrl = `${baseUrl}/v2/bookings?start_at=${today}T00:00:00Z&end_at=${today}T23:59:59Z&limit=1`
		const bookingsRes = await fetch(bookingsUrl, { headers })
		results.bookings = {
			status: bookingsRes.status,
			ok: bookingsRes.ok,
			hasFeature: bookingsRes.ok
		}

		// If bookings returns data, show a sample
		if (bookingsRes.ok) {
			const bookingsData = await bookingsRes.json()
			results.bookings.data = bookingsData
		}

		// Test 4: Try Orders API
		const ordersRes = await fetch(`${baseUrl}/v2/orders/search`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				limit: 1,
				query: {
					filter: {
						date_time_filter: {
							created_at: {
								start_at: `${today}T00:00:00Z`,
								end_at: `${today}T23:59:59Z`
							}
						}
					}
				}
			})
		})
		results.orders = {
			status: ordersRes.status,
			ok: ordersRes.ok
		}

		return NextResponse.json({
			success: true,
			merchant_id: tokenRow.merchant_id,
			environment: process.env.SQUARE_ENV,
			tests: results,
			summary: {
				hasBookings: results.bookings?.ok === true,
				hasOrders: results.orders?.ok === true,
				hasCustomers: results.customers?.ok === true
			}
		})

	} catch (error: any) {
		console.error('Square API test error:', error)
		return NextResponse.json({
			success: false,
			error: error.message,
			stack: error.stack
		}, { status: 500 })
	}
}
