// app/api/square/pull-orders/route.ts
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

		// Step 1: Get merchant locations
		const baseUrl = squareBaseUrl()
		const headers = {
			'Authorization': `Bearer ${accessToken}`,
			'Square-Version': '2024-01-23',
			'Content-Type': 'application/json',
		}

		const locationsRes = await fetch(`${baseUrl}/v2/locations`, { headers })
		const locationsData = await locationsRes.json()
		const locationIds = Array.isArray(locationsData.locations)
			? locationsData.locations.map((loc: any) => loc.id)
			: []

		if (locationIds.length === 0) {
			return NextResponse.json(
				{ error: 'No Square locations found' },
				{ status: 400 },
			)
		}

		// Step 2: Fetch orders with pagination
		const allOrders: any[] = []
		let cursor: string | null = null

		do {
			const body: any = {
				location_ids: locationIds,
				limit: 100,
				return_entries: false,
				query: {
					filter: {
						date_time_filter: {
							created_at: {
								start_at: `${startDate}T00:00:00Z`,
								end_at: `${endDate}T23:59:59Z`
							}
						}
					}
				}
			}

			if (cursor) {
				body.cursor = cursor
			}

			const res = await fetch(`${baseUrl}/v2/orders/search`, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
			})

			if (!res.ok) {
				const errorData = await res.json()
				return NextResponse.json(
					{
						error: 'Square Orders API failed',
						details: errorData,
						status: res.status
					},
					{ status: 500 },
				)
			}

			const data = await res.json()

			if (Array.isArray(data.orders)) {
				allOrders.push(...data.orders)
			}

			cursor = data.cursor || null

			// Small delay to avoid rate limiting
			if (cursor) {
				await new Promise(resolve => setTimeout(resolve, 100))
			}
		} while (cursor)

		// Step 3: Transform and store orders
		// For now, just return summary - we'll build proper storage next
		const revenueSummary: Record<string, number> = {}
		const serviceCounts: Record<string, number> = {}
		const customerOrders: Record<string, number> = {}

		for (const order of allOrders) {
			// Extract date
			const createdAt = order.created_at ? new Date(order.created_at) : null
			const monthKey = createdAt
				? `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`
				: 'unknown'

			// Calculate total (including tips)
			let orderTotal = 0
			if (order.total_money) {
				orderTotal = parseFloat(order.total_money.amount) / 100
			}

			// Track revenue by month
			if (!revenueSummary[monthKey]) revenueSummary[monthKey] = 0
			revenueSummary[monthKey] += orderTotal

			// Track line items (services)
			if (Array.isArray(order.line_items)) {
				for (const item of order.line_items) {
					const serviceName = item.name || 'Unknown Service'
					if (!serviceCounts[serviceName]) serviceCounts[serviceName] = 0
					serviceCounts[serviceName] += 1
				}
			}

			// Track customer
			if (order.customer_id) {
				if (!customerOrders[order.customer_id]) customerOrders[order.customer_id] = 0
				customerOrders[order.customer_id] += orderTotal
			}
		}

		// Step 4: Update monthly_data table with Square revenue
		const monthlyUpserts = Object.entries(revenueSummary).map(([monthKey, revenue]) => {
			const [year, month] = monthKey.split('-')
			const monthName = [
				'January', 'February', 'March', 'April', 'May', 'June',
				'July', 'August', 'September', 'October', 'November', 'December'
			][parseInt(month) - 1]

			return {
				user_id: user.id,
				month: monthName,
				year: parseInt(year),
				total_revenue: revenue,
				num_transactions: allOrders.filter(o => {
					const orderDate = o.created_at ? new Date(o.created_at) : null
					return orderDate &&
						orderDate.getFullYear() === parseInt(year) &&
						orderDate.getMonth() + 1 === parseInt(month)
				}).length,
				source: 'square',
				updated_at: new Date().toISOString(),
			}
		})

		// Upsert to monthly_data
		if (monthlyUpserts.length > 0) {
			const { error: upsertErr } = await supabase
				.from('monthly_data')
				.upsert(monthlyUpserts, {
					onConflict: 'user_id,month,year,source',
					ignoreDuplicates: false
				})

			if (upsertErr) {
				console.error('Monthly data upsert error:', upsertErr)
			}
		}

		return NextResponse.json({
			success: true,
			summary: {
				totalOrders: allOrders.length,
				totalRevenue: Object.values(revenueSummary).reduce((a, b) => a + b, 0),
				dateRange: { startDate, endDate },
				revenueByMonth: revenueSummary,
				topServices: Object.entries(serviceCounts)
					.sort(([, a], [, b]) => b - a)
					.slice(0, 5),
				uniqueCustomers: Object.keys(customerOrders).length,
				monthlyUpserts: monthlyUpserts.length,
			},
			note: allOrders.length === 0
				? 'No orders found in dummy account. This will work with real merchant data.'
				: `Synced ${allOrders.length} orders`
		})

	} catch (error: any) {
		console.error('Square orders sync error:', error)
		return NextResponse.json(
			{ error: 'Internal server error', details: error.message },
			{ status: 500 },
		)
	}
}
