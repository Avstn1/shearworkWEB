// utils/api-auth.ts
import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  createSupabaseTokenClient,
} from '@/lib/supabaseServer'
import { isValidUUID } from '@/utils/validation'
import { isServiceRequest } from '@/lib/api/guards'

type AuthResult = { user: User | null; supabase: SupabaseClient; isService: boolean }

/**
 * Resolves the caller of an API route.
 *
 * - Service role (edge functions / internal calls): `Authorization: Bearer <service key>`
 *   plus optional `x-user-id`. Returns an admin client.
 * - Mobile / Bearer token: returns a client scoped to that user's token (RLS applies).
 * - Web: falls back to the session cookies (RLS applies).
 */
export async function getAuthenticatedUser(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization')

  if (isServiceRequest(request)) {
    const admin = createSupabaseAdminClient()
    const userId = request.headers.get('x-user-id')
    if (userId) {
      if (!isValidUUID(userId)) {
        console.error('Invalid x-user-id format:', userId)
        return { user: null, supabase: admin, isService: true }
      }
      const { data: { user }, error } = await admin.auth.admin.getUserById(userId)
      if (user) return { user, supabase: admin, isService: true }
      if (error) console.error('getUserById error:', error.message)
    }
    return { user: null, supabase: admin, isService: true }
  }

  const getTokenFromRequest = () => {
    let token = authHeader?.replace(/^Bearer\s+/i, '')

    if (!token) {
      token = request.headers.get('x-client-access-token') || undefined
    }

    if (!token) {
      try {
        const url = new URL(request.url)
        token = url.searchParams.get('token') || undefined
      } catch (err) {
        console.error('Failed to parse URL for token:', err)
      }
    }

    if (!token) {
      const scHeaders = request.headers.get('x-vercel-sc-headers')
      if (scHeaders) {
        try {
          const parsed = JSON.parse(scHeaders)
          token = parsed['Authorization']?.replace(/^Bearer\s+/i, '')
        } catch (err) {
          console.error('Failed to parse x-vercel-sc-headers:', err)
        }
      }
    }

    return token
  }

  const token = getTokenFromRequest()

  if (token) {
    const tokenClient = createSupabaseTokenClient(token)
    const { data: { user }, error } = await tokenClient.auth.getUser(token)
    if (error) {
      console.log('Auth error via token:', error.message)
    }
    if (user) {
      return { user, supabase: tokenClient, isService: false }
    }
  }

  // Fallback to cookies (web)
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { user, supabase, isService: false }
}
