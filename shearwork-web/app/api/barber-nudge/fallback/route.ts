import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
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