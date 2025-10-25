import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  // ✅ The latest Next.js docs now use "await cookies()" syntax.
  // This works fine in async server components or layouts.
  const cookieStore = await cookies();

  // ✅ Create Supabase client (using the stable, non-deprecated API)
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Required: read cookies (getAll is the modern method)
        getAll() {
          return cookieStore.getAll();
        },
        // Optional but recommended: write cookies
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Setting cookies may fail in server components — that's OK
          }
        },
      },
    }
  );
}
