import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)

export async function POST(req: NextRequest) {
  try {
    const { userId, calendarId } = await req.json()
    if (!userId || !calendarId) return NextResponse.json({ error: 'Missing userId or calendarId' }, { status: 400 })

    const { error } = await supabase.from('profiles').update({ calendar: calendarId }).eq('user_id', userId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
