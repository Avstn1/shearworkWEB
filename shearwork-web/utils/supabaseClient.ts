import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const getProjectRef = () => {
  if (!SUPABASE_URL) return 'unknown'
  try {
    return new URL(SUPABASE_URL).hostname.split('.')[0]
  } catch {
    return 'unknown'
  }
}

export const getSupabaseStorageKey = () => `sb-${getProjectRef()}-auth-token`

const noOpLock = async <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => {
  return await fn()
}

const createSupabaseClient = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase env vars are missing for client')
  }

  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      lock: noOpLock,
    },
  })
}

export const supabase = createSupabaseClient()
