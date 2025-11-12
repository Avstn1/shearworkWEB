'use server'

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 })

  // Fetch Acuity token
  const { data: tokenRow } = await supabase.from('acuity_tokens').select('*').eq('user_id', user.id).single()
  if (!tokenRow) return NextResponse.json({ error: 'No Acuity connection found' }, { status: 400 })

  let accessToken = tokenRow.access_token

  // ---------------- Fetch all clients from Acuity ----------------
  try {
    const res = await fetch('https://acuityscheduling.com/api/v1/clients', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })
    if (!res.ok) throw new Error(`Failed to fetch clients: ${res.statusText}`)
    const clients = await res.json()

    // Just log them to server console
    console.log('All Acuity Clients:', clients)

    // Return them in the JSON response
    return NextResponse.json({ success: true, totalClients: clients.length, clients })
  } catch (err) {
    console.error('Error fetching clients:', err)
    return NextResponse.json({ error: 'Failed to fetch clients', details: String(err) }, { status: 500 })
  }
}
