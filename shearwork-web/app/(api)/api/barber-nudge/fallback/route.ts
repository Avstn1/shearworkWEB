// /api/barber-nudge/fallback/route.ts
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

import { NextResponse } from 'next/server'
import { verifyTwilioRequest } from '@/lib/api/guards'
const supabase = createSupabaseAdminClient()

export async function POST(request: Request) {
  try {
    // Only accept requests signed by Twilio
    const params = await verifyTwilioRequest(request)
    if (!params) return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 403 })
    const formData = new URLSearchParams(params)
    const body = Object.fromEntries(formData.entries())
    
    // Log the failed webhook attempt
    await supabase
      .from('webhook_failures')
      .insert({
        webhook_type: 'sms_reply',
        payload: body,
        error_message: 'Primary webhook failed',
        created_at: new Date().toISOString()
      })
    
    console.error('Webhook fallback triggered:', body)
    
    return NextResponse.json({ success: true, fallback: true })
  } catch (error) {
    console.error('Fallback webhook error:', error)
    return NextResponse.json({ error: 'Fallback failed' }, { status: 500 })
  }
}