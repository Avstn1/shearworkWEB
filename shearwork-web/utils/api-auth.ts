// utils/api-auth.ts
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function getAuthenticatedUser(request: Request) {
  const supabase = await createSupabaseServerClient();
  
  // Try Bearer token first (mobile)
  const authHeader = request.headers.get('authorization');
  console.log(`THERE'S AN AUTH HEADER: ${authHeader}`)
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log(`Token: ${token}`)
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error){
      console.log('Auth error:', error)
    }
    if (!error && user) {
      console.log('Authenticated via Bearer token:', user.id)
      return { user, supabase };
    }
  }

  // Fallback to cookies (web)
  console.log('Falling back to cookie auth')
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    console.log('Authenticated via cookies:', user.id)
  } else {
    console.log('No user found in cookies either')
  }
  return { user, supabase };
}