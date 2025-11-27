// utils/api-auth.ts
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function getAuthenticatedUser(request: Request) {
  const supabase = await createSupabaseServerClient();

  // Extract token from either Authorization, x-client-access-token, or Vercel headers
  const getTokenFromRequest = () => {
    // Standard Authorization header
    let token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    // Custom header from client
    if (!token) {
      token = request.headers.get('x-client-access-token') || undefined;
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
  if (user) {
    console.log('Authenticated via cookies:', user.id);
  } else {
    console.log('No authenticated user found');
  }

  return { user, supabase };
}
