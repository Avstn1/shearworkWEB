// app/api/square/disconnect/route.ts
import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'

export async function POST(request: Request) {
	const { user, supabase } = await getAuthenticatedUser(request)

	if (!user || !supabase) {
		return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
	}

	try {
		const { error } = await supabase
			.from('square_tokens')
			.delete()
			.eq('user_id', user.id)

		if (error) throw error

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
