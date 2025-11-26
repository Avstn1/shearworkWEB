// utils/api-auth.ts
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { SupabaseClient, User } from '@supabase/supabase-js';

export async function getAuthenticatedUser(
  request: Request
): Promise<{ user: User | null; supabase: SupabaseClient }> {
  const supabase = await createSupabaseServerClient();

  // First: Check Authorization header for mobile calls
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();

    // IMPORTANT: pass token into getUser({ token })
    const { data, error } = await supabase.auth.getUser(token);

    if (!error && data?.user) {
      return { user: data.user, supabase };
    }
  }

  // Fallback: Cookie-based session (for Next.js web)
  const { data: cookieData } = await supabase.auth.getUser();
  return { user: cookieData.user, supabase };
}
