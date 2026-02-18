// utils/api-auth.ts
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { isValidUUID } from '@/utils/validation'

export async function getAuthenticatedUser(request: Request) {
  const supabase = await createSupabaseServerClient();

  // Check for service role key (for Edge Functions and internal calls)
  const authHeader = request.headers.get('Authorization');
  if (authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    const userId = request.headers.get('x-user-id');
    if (userId) {
      if (!isValidUUID(userId)) {
        console.error('Invalid x-user-id format:', userId);
        return { user: null, supabase };
      }
      const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
      if (user) return { user, supabase };
      if (error) console.log("error: " + error)
    }
    console.log('Authenticated via service role (system)');
    return { user: null, supabase };
  }

  const getTokenFromRequest = () => {
    let token = authHeader?.replace(/^Bearer\s+/i, '');

    if (!token) {
      token = request.headers.get('x-client-access-token') || undefined;
    }

    if (!token) {
      try {
        const url = new URL(request.url);
        token = url.searchParams.get('token') || undefined;
      } catch (err) {
        console.error('Failed to parse URL for token:', err);
      }
    }

    if (!token) {
      const scHeaders = request.headers.get('x-vercel-sc-headers');
      if (scHeaders) {
        try {
          const parsed = JSON.parse(scHeaders);
          token = parsed['Authorization']?.replace(/^Bearer\s+/i, '');
        } catch (err) {
          console.error('Failed to parse x-vercel-sc-headers:', err);
        }
      }
    }

    return token;
  };

  const token = getTokenFromRequest();

  if (token) {
    // Use a plain anon client (not cookie-bound) to validate the Bearer token
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error } = await anonClient.auth.getUser(token);
    if (error) {
      console.log('Auth error via token:', error.message);
    }
    if (user) {
      console.log('Authenticated via token:', user.id);
      // Return cookie-based supabase for DB ops (RLS), but with user confirmed
      return { user, supabase };
    }
  }

  // Fallback to cookies (web)
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}