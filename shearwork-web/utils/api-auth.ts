export async function getAuthenticatedUser(request: Request) {
  const supabase = await createSupabaseServerClient();

  // First, check normal Authorization header
  let authHeader = request.headers.get('authorization');

  // If missing, try x-vercel-sc-headers
  if (!authHeader) {
    const scHeaders = request.headers.get('x-vercel-sc-headers');
    if (scHeaders) {
      try {
        const parsed = JSON.parse(scHeaders);
        authHeader = parsed['Authorization'] || parsed['authorization'] || null;
        console.log('Recovered auth from x-vercel-sc-headers:', authHeader);
      } catch (err) {
        console.error('Failed to parse x-vercel-sc-headers:', err);
      }
    }
  }

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('Token:', token);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) console.log('Auth error:', error);
    if (user) {
      console.log('Authenticated via Bearer token:', user.id);
      return { user, supabase };
    }
  }

  // Fallback to cookies
  console.log('Falling back to cookie auth');
  const { data: { user } } = await supabase.auth.getUser();
  if (user) console.log('Authenticated via cookies:', user.id);
  else console.log('No user found in cookies either');

  return { user, supabase };
}
