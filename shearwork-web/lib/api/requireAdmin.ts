// lib/api/requireAdmin.ts
import type { User } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

/** Resolves the caller and returns them only if their profile role is Admin. */
export async function requireAdmin(request: Request): Promise<User | null> {
  const { user } = await getAuthenticatedUser(request)
  if (!user) return null

  const { data: profile } = await createSupabaseAdminClient()
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  return profile?.role?.toLowerCase() === 'admin' ? user : null
}
