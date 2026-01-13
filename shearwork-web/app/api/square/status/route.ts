import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

export async function GET() {
	const user = await getAuthenticatedUser()
	if (!user) return NextResponse.json({ connected: false }, { status: 401 })

	const supabase = createSupabaseAdminClient()
	const { data } = await supabase
		.from('square_tokens')
		.select('merchant_id, expires_in')
		.eq('user_id', user.id)
		.maybeSingle()

	return NextResponse.json({
		connected: !!data?.merchant_id,
		merchant_id: data?.merchant_id ?? null,
		expires_in: data?.expires_in ?? null,
	})
}
