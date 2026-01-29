// app/api/square/status/route.ts
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: Request) {
	const { user, supabase } = await getAuthenticatedUser(request)

	if (!user || !supabase) {
		return NextResponse.json({ connected: false }, { status: 401 })
	}

	try {
		const { data: tokenRow } = await supabase
			.from('square_tokens')
			.select('merchant_id, created_at')
			.eq('user_id', user.id)
			.maybeSingle()

		if (!tokenRow) {
			return NextResponse.json({
				connected: false
			})
		}

		return NextResponse.json({
			connected: true,
			merchant_id: tokenRow.merchant_id,
			connected_at: tokenRow.created_at
		})
	} catch (error) {
		console.error('Status check error:', error)
		return NextResponse.json({
			connected: false,
			error: 'Failed to check status'
		}, { status: 500 })
	}
}
