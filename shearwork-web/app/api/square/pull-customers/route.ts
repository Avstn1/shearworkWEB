// app/api/square/pull-customer/route.ts
'use server'
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
	const { user, supabase } = await getAuthenticatedUser(request)
	if (!user || !supabase) {
		return Response.json({ error: 'Not authenticated' }, { status: 401 })
	}

	// 1) Load Square token with merchant_id
	const { data: tokenRow, error: tokenErr } = await supabase
		.from('square_tokens')
		.select('access_token, merchant_id')
		.eq('user_id', user.id)
		.single()

	if (tokenErr || !tokenRow?.access_token) {
		return Response.json(
			{ error: 'No Square connection found' },
			{ status: 400 },
		)
	}

	const accessToken = tokenRow.access_token
	const merchantId = tokenRow.merchant_id

	if (!merchantId) {
		return Response.json(
			{ error: 'No merchant ID associated with Square account' },
			{ status: 400 },
		)
	}

	// 2) Paginate customers
	const allCustomers: any[] = []
	let cursor: string | null = null

	do {
		const url = new URL(`${squareBaseUrl()}/v2/customers`)
		url.searchParams.set('limit', '100')
		if (cursor) url.searchParams.set('cursor', cursor)

		const res = await fetch(url.toString(), {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Square-Version': '2024-01-23', // ← Add Square-Version header!
				'Content-Type': 'application/json',
			},
		})

		if (!res.ok) {
			const errorData = await res.json()
			console.error('Square API error:', errorData)
			return Response.json(
				{
					error: 'Square API request failed',
					details: errorData,
					status: res.status
				},
				{ status: 500 },
			)
		}

		const data = await res.json()

		if (Array.isArray(data.customers)) {
			allCustomers.push(...data.customers)
		}

		cursor = data.cursor || null

		// Optional: add a small delay to avoid rate limiting
		if (cursor) {
			await new Promise(resolve => setTimeout(resolve, 100))
		}
	} while (cursor)

	// 3) Normalize into DB rows
	const rows = allCustomers
		.filter((c) => c?.id)
		.map((c) => {
			const phone = c.phone_number || null
			const email = (c.email_address || '').toLowerCase().trim() || null
			const givenName = c.given_name || null
			const familyName = c.family_name || null

			// Extract creation time for first_appt if available
			const createdAt = c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : null

			return {
				user_id: user.id,
				customer_id: c.id,
				merchant_id: merchantId, // ← REQUIRED by your table schema
				first_name: givenName,
				last_name: familyName,
				email,
				phone,
				phone_normalized: normalizePhone(phone) || null,
				first_appt: createdAt, // Use Square's created_at as first appointment
				last_appt: createdAt,
				notes: c.note || null,
				total_appointments: 0, // Will need to sync from orders later
				total_revenue: 0, // Will need to sync from payments later
				first_source: c.source || null,
				updated_at: new Date().toISOString(),
			}
		})

	// 4) Upsert into square_clients
	const { error: upsertErr } = await supabase
		.from('square_clients')
		.upsert(rows, {
			onConflict: 'user_id,customer_id',
			ignoreDuplicates: false
		})

	if (upsertErr) {
		console.error('Supabase upsert error:', upsertErr)
		return Response.json(
			{ error: 'Database upsert failed', details: upsertErr.message },
			{ status: 500 },
		)
	}

	return Response.json({
		success: true,
		totalFetched: allCustomers.length,
		totalUpserted: rows.length,
		merchantId,
		syncedAt: new Date().toISOString(),
	})
}
