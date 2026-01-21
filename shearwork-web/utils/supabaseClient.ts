import { createBrowserClient } from '@supabase/ssr'

// Create a function that returns a new client instance
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// For backward compatibility, export a default instance
// But components should use the function above for critical operations
export const supabase = createSupabaseBrowserClient()

// Handle page visibility to manually trigger reconnection
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      supabase.auth.refreshSession()
    }
  })
}