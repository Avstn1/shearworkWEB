// utils/api-auth.ts
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { SupabaseClient, User } from '@supabase/supabase-js';

export async function getAuthenticatedUser(
  request: Request
): Promise<{ user: User | null; supabase: SupabaseClient }> {
  const supabase = await createSupabaseServerClient();
  
  // Try Bearer token first (mobile)
  const authHeader = request.headers.get('authorization');
  console.log(`THERE'S AN AUTH HEADER: ${authHeader}`)
  
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log(`Token: ${token}`)
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error){
      console.log(error)
    }
    if (!error && user) {
      return { user, supabase };
    }
  }

  // Fallback to cookies (web)
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}