import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('q')

  if (!search || search.length < 2) {
    return NextResponse.json([])
  }

  const supabase = await createSupabaseServerClient() 

  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, booking_link, phone')
    .ilike('full_name', `%${search}%`)
    .limit(10)

  if (error) {
    console.error('Error searching barbers:', error)
    return NextResponse.json({ error: 'Failed to search barbers' }, { status: 500 })
  }

  return NextResponse.json(data || [])
}