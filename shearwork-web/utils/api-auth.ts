// utils/api-auth.ts
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

export async function getAuthenticatedUser(request: Request) {
  const cookieClient = await createSupabaseServerClient()

  // 1️⃣ Check for mobile Bearer token
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const accessToken = authHeader.replace('Bearer ', '')

    // ❗ Create a client bound to this token
    const tokenClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // server key
      {
        global: {
          headers: { Authorization: `Bearer ${accessToken}` }
        },
        auth: {
          persistSession: false
        }
      }
    )

    const { data, error } = await tokenClient.auth.getUser()

    if (!error && data.user) {
      return { user: data.user, supabase: tokenClient }
    }
  }

  // 2️⃣ Fallback: web browser using cookies
  const { data } = await cookieClient.auth.getUser()
  return { user: data.user, supabase: cookieClient }
}
