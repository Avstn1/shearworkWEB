import { createSupabaseServerClient } from '@/lib/supabaseServer'

/**
 * Get a valid access token for the logged-in user.
 * If the token is expired, automatically refreshes it.
 */
export async function getValidAcuityToken(userId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient()

  const { data: tokenData } = await supabase
    .from('acuity_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!tokenData) return null

  const expiresAt = tokenData.expires_at ? new Date(tokenData.expires_at).getTime() : 0
  const now = Date.now()

  // Token expired → refresh it
  if (expiresAt && expiresAt < now) {
    console.log('🔁 Refreshing expired Acuity token...')

    const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/acuity/refresh`, {
      method: 'POST',
      credentials: 'include',
    })

    if (!refreshResponse.ok) {
      console.error('Failed to refresh Acuity token')
      return null
    }

    const data = await refreshResponse.json()
    return data.access_token
  }

  // Token still valid
  return tokenData.access_token
}
