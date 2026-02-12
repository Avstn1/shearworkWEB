// app/api/square/test/route.ts
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function GET(request: Request) {
	const { user, supabase } = await getAuthenticatedUser(request)

	if (!user || !supabase) {
		return NextResponse.json({
			success: false,
			error: 'Not authenticated'
		}, { status: 401 })
	}

	try {
		const { data: tokenRow } = await supabase
			.from('square_tokens')
			.select('access_token, merchant_id')
			.eq('user_id', user.id)
			.maybeSingle()

		if (!tokenRow?.access_token) {
			return NextResponse.json({
				success: false,
				error: 'No Square connection found'
			}, { status: 400 })
		}

		// Simple check - just verify we have a token
		return NextResponse.json({
			success: true,
			connected: true,
			merchant_id: tokenRow.merchant_id,
			message: 'Square connection is active'
		})
	} catch (error: any) {
		return NextResponse.json({
			success: false,
			error: 'Connection test failed',
			details: error.message
		}, { status: 500 })
	}
}
