import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { createSquareClient } from '@/lib/square/client'

export async function POST() {
	const user = await getAuthenticatedUser()
	if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

	const supabase = createSupabaseAdminClient()
	const { data } = await supabase
		.from('square_tokens')
		.select('access_token')
		.eq('user_id', user.id)
		.maybeSingle()

	if (data?.access_token) {
		const square = createSquareClient()
		const authHeader = `Client ${process.env.SQUARE_APPLICATION_SECRET}`

		// revoke token
		await square.oAuthApi.revokeToken(
			{
				clientId: process.env.SQUARE_APPLICATION_ID!,
				accessToken: data.access_token,
				revokeOnlyAccessToken: false,
			},
			authHeader
		)
	}

	// delete row
	await supabase.from('square_tokens').delete().eq('user_id', user.id)

	return NextResponse.json({ ok: true })
}
