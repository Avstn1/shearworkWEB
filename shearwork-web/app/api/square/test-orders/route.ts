// app/api/square/debug-orders-v2/route.ts
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

		// Step 1: Get merchant locations
		const locationsRes = await fetch(`${baseUrl}/v2/locations`, { headers })
		const locationsData = await locationsRes.json()

		const locations = Array.isArray(locationsData.locations)
			? locationsData.locations.map((loc: any) => ({
				id: loc.id,
				name: loc.name,
				business_name: loc.business_name,
				status: loc.status
			}))
			: []

		// Step 2: Try orders with location IDs
		let ordersResult = null
		if (locations.length > 0) {
			const today = new Date().toISOString().split('T')[0]
			const locationIds = locations.map((loc: any) => loc.id)

			const ordersRes = await fetch(`${baseUrl}/v2/orders/search`, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					location_ids: locationIds, // ← CRITICAL: Add location IDs
					limit: 2,
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

			ordersResult = {
				success: ordersRes.ok,
				status: ordersRes.status,
				data: ordersRes.ok ? await ordersRes.json() : await ordersRes.text()
			}
		}

		return NextResponse.json({
			success: true,
			merchant_id: tokenRow.merchant_id,
			has_locations: locations.length > 0,
			locations: locations,
			orders_test: ordersResult,
			scopes_status: locationsRes.ok ? 'Has MERCHANT_PROFILE_READ (for locations)' : 'Missing scopes',
			orders_access: ordersResult?.success ? 'Has ORDERS_READ' : 'May need ORDERS_READ scope'
		})

	} catch (error: any) {
		return NextResponse.json({
			success: false,
			error: error.message,
			stack: error.stack
		}, { status: 500 })
	}
}
