import { createSupabaseAdminClient } from '@/lib/supabaseServer'
import { NextRequest, NextResponse } from 'next/server'

// Public barber lookup for the /book page. Only returns the public booking fields
// of onboarded, non-admin profiles.
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('q')?.trim()

  if (!search || search.length < 2 || search.length > 60) {
    return NextResponse.json([])
  }

  // Treat the query literally: escape LIKE wildcards
  const pattern = `%${search.replace(/[\\%_]/g, char => `\\${char}`)}%`

  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, booking_link, phone')
    .ilike('full_name', pattern)
    .eq('onboarded', true)
    .neq('role', 'Admin')
    .limit(10)

  if (error) {
    console.error('Error searching barbers:', error)
    return NextResponse.json({ error: 'Failed to search barbers' }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
