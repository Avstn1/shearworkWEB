import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

function squareBaseUrl() {
	return process.env.SQUARE_ENV === 'production'
		? 'https://connect.squareup.com'
		: 'https://connect.squareupsandbox.com'
}

function getSquareVersion() {
	return process.env.SQUARE_VERSION || '2025-10-16'
}

export async function GET(request: Request) {
	try {
		const { user, supabase } = await getAuthenticatedUser(request)
		if (!user || !supabase) {
			return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
		}

		const { data: tokenRow, error: tokenError } = await supabase
			.from('square_tokens')
			.select('access_token, merchant_id')
			.eq('user_id', user.id)
			.single()

		if (tokenError || !tokenRow?.access_token) {
			return NextResponse.json({ error: 'No Square connection found' }, { status: 400 })
		}

		const { data: existingLocations, error: existingError } = await supabase
			.from('square_locations')
			.select('location_id, selected, is_active')
			.eq('user_id', user.id)

		if (existingError) {
			console.error('Failed to load square_locations:', existingError)
			return NextResponse.json({ error: 'Failed to load existing locations' }, { status: 500 })
		}

		const selectedMap = new Map(
			(existingLocations || []).map((loc) => [loc.location_id, loc])
		)

		const response = await fetch(`${squareBaseUrl()}/v2/locations`, {
			headers: {
				Authorization: `Bearer ${tokenRow.access_token}`,
				'Square-Version': getSquareVersion(),
			},
		})

		const data = await response.json()
		if (!response.ok) {
			return NextResponse.json({
				error: 'Square locations fetch failed',
				details: data,
			}, { status: 500 })
		}

		const locations = Array.isArray(data.locations) ? data.locations : []

		const upserts = locations.map((location: any) => {
			const existing = selectedMap.get(location.id)
			return {
				user_id: user.id,
				merchant_id: tokenRow.merchant_id ?? location.merchant_id ?? '',
				location_id: location.id,
				name: location.name ?? null,
				timezone: location.timezone ?? null,
				status: location.status ?? null,
				country: location.country ?? null,
				currency: location.currency ?? null,
				address: location.address ?? null,
				is_active: location.status === 'ACTIVE',
				selected: existing?.selected ?? false,
				updated_at: new Date().toISOString(),
			}
		})

		if (upserts.length > 0) {
			const { error: upsertError } = await supabase
				.from('square_locations')
				.upsert(upserts, { onConflict: 'user_id,location_id' })

			if (upsertError) {
				console.error('Failed to upsert square_locations:', upsertError)
				return NextResponse.json({ error: 'Failed to save locations' }, { status: 500 })
			}
		}

		type SquareLocationUpsert = (typeof upserts)[number]

		const payload = [...upserts]
			.sort((a: SquareLocationUpsert, b: SquareLocationUpsert) =>
				(a.name || '').localeCompare(b.name || '')
			)
			.map((loc: SquareLocationUpsert) => ({
				location_id: loc.location_id,
				name: loc.name,
				timezone: loc.timezone,
				status: loc.status,
				is_active: loc.is_active,
				selected: loc.selected,
			}))

		return NextResponse.json({ locations: payload })
	} catch (err) {
		console.error('Square locations error:', err)
		return NextResponse.json(
			{ error: 'Internal server error', details: String(err) },
			{ status: 500 }
		)
	}
}

export async function POST(request: Request) {
	try {
		const { user, supabase } = await getAuthenticatedUser(request)
		if (!user || !supabase) {
			return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
		}

		const body = await request.json()
		const selectedLocationIds = Array.isArray(body?.selectedLocationIds)
			? body.selectedLocationIds.filter((id: unknown) => typeof id === 'string')
			: []

		const { error: clearError } = await supabase
			.from('square_locations')
			.update({ selected: false, updated_at: new Date().toISOString() })
			.eq('user_id', user.id)

		if (clearError) {
			console.error('Failed to clear square location selections:', clearError)
			return NextResponse.json({ error: 'Failed to update locations' }, { status: 500 })
		}

		if (selectedLocationIds.length > 0) {
			const { error: selectError } = await supabase
				.from('square_locations')
				.update({ selected: true, updated_at: new Date().toISOString() })
				.eq('user_id', user.id)
				.in('location_id', selectedLocationIds)

			if (selectError) {
				console.error('Failed to update selected locations:', selectError)
				return NextResponse.json({ error: 'Failed to update locations' }, { status: 500 })
			}
		}

		return NextResponse.json({ selectedLocationIds })
	} catch (err) {
		console.error('Square locations update error:', err)
		return NextResponse.json(
			{ error: 'Internal server error', details: String(err) },
			{ status: 500 }
		)
	}
}
