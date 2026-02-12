// app/api/square/disconnect/route.ts
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

const DEFAULT_SQUARE_VERSION = '2025-10-16'

function squareBaseUrl() {
	return process.env.SQUARE_ENV === 'production'
		? 'https://connect.squareup.com'
		: 'https://connect.squareupsandbox.com'
}

function getSquareVersion() {
	return process.env.SQUARE_VERSION || DEFAULT_SQUARE_VERSION
}

export async function POST(request: Request) {
	const { user } = await getAuthenticatedUser(request)

	if (!user) {
		return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
	}

	const supabaseAdmin = createSupabaseAdminClient()

	try {
		const { data: tokenRow, error: tokenError } = await supabaseAdmin
			.from('square_tokens')
			.select('access_token, merchant_id')
			.eq('user_id', user.id)
			.maybeSingle()

		if (tokenError) throw tokenError

		if (tokenRow?.access_token && process.env.SQUARE_APPLICATION_SECRET && process.env.SQUARE_APPLICATION_ID) {
			try {
				const revokeResponse = await fetch(`${squareBaseUrl()}/oauth2/revoke`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Square-Version': getSquareVersion(),
						Authorization: `Client ${process.env.SQUARE_APPLICATION_SECRET}`,
					},
					body: JSON.stringify({
						client_id: process.env.SQUARE_APPLICATION_ID,
						access_token: tokenRow.access_token,
					}),
				})

				if (!revokeResponse.ok) {
					const revokeBody = await revokeResponse.json().catch(() => ({}))
					console.error('Square revoke failed:', revokeBody)
				}
			} catch (revokeError) {
				console.error('Square revoke error:', revokeError)
			}
		}

		const { error: tokenDeleteError } = await supabaseAdmin
			.from('square_tokens')
			.delete()
			.eq('user_id', user.id)

		if (tokenDeleteError) throw tokenDeleteError

		const { error: locationError } = await supabaseAdmin
			.from('square_locations')
			.delete()
			.eq('user_id', user.id)

		if (locationError) throw locationError

		return NextResponse.json({
			success: true,
			message: 'Square disconnected successfully'
		})
	} catch (error: any) {
		console.error('Disconnect error:', error)
		return NextResponse.json({
			error: 'Failed to disconnect',
			details: error.message
		}, { status: 500 })
	}
}
