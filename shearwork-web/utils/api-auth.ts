// utils/api-auth.ts
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function getAuthenticatedUser(request: Request) {
  const supabase = await createSupabaseServerClient();

  // Check for service role key (for Edge Functions and internal calls)
  const authHeader = request.headers.get('Authorization');
  if (authHeader === `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    // Get user_id from custom header for service role requests
    const userId = request.headers.get('x-user-id');
    if (userId) {
      // console.log('Authenticated via service role for user:', userId);
      const { data: { user }, error } = await supabase.auth.admin.getUserById(userId);
      if (user) {
        return { user, supabase };
      }

      if (error) {
        console.log("error: " + error)
      }
    }
    // If no user_id provided, this is a system-level call
    console.log('Authenticated via service role (system)');
    return { user: null, supabase }; // Or handle differently based on your needs
  }

  const getTokenFromRequest = () => {
    let token = authHeader?.replace(/^Bearer\s+/i, '');

    // Custom header from client
    if (!token) {
      token = request.headers.get('x-client-access-token') || undefined;
    }

    // Check URL query parameters for token
    if (!token) {
      try {
        const url = new URL(request.url);
        token = url.searchParams.get('token') || undefined;
      } catch (err) {
        console.error('Failed to parse URL for token:', err);
      }
    }

    // Fallback to Vercel proxy headers
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
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) {
      console.log('Auth error via token:', error);
    }
    if (user) {
      console.log('Authenticated via token:', user.id);
      return { user, supabase };
    }
  }

  // Fallback to cookies (web)
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}