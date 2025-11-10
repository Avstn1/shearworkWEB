import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_DOCKER_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  
  console.log('cron is working')
  return NextResponse.json({ message: 'cron is working' })
}
