// utils/api-auth.ts
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function getAuthenticatedUser(request: Request) {
  const supabase = await createSupabaseServerClient();

  // Helper to extract auth token from headers
  const getAuthHeader = () => {
    let authHeader = request.headers.get('authorization');

    // If missing, check Vercel stripped headers
    if (!authHeader) {
      const scHeaders = request.headers.get('x-vercel-sc-headers');
      if (scHeaders) {
        try {
          const parsed = JSON.parse(scHeaders);
          authHeader = parsed['Authorization'] || parsed['authorization'] || null;
        } catch (err) {
          console.error('Failed to parse x-vercel-sc-headers:', err);
        }
      }
    }

    return authHeader;
  }

  const authHeader = getAuthHeader();

  // Try Bearer token first (mobile)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) console.log('Auth error via Bearer token:', error);
    if (user) return { user, supabase };
  }

  // Fallback to cookies (web)
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}
