import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    global: {
      headers: {
        'x-client-info': 'supabase-js-web'
      }
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  }
)

// Test localStorage on client
if (typeof window !== 'undefined') {
  console.log('🟣 Testing localStorage write...')
  try {
    localStorage.setItem('test-key', 'test-value')
    const read = localStorage.getItem('test-key')
    console.log('✅ localStorage write/read test passed:', read === 'test-value')
    localStorage.removeItem('test-key')
  } catch (e) {
    console.error('❌ localStorage FAILED:', e)
  }
}

// Handle page visibility to manually trigger reconnection
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      supabase.auth.refreshSession()
    }
  })
}