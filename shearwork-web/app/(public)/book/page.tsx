import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { BarberSearch } from './BarberSearch'

type PageProps = {
  searchParams: Promise<{ profile?: string; t?: string }>
}

export default async function BookingRedirectPage({ searchParams }: PageProps) {
  const params = await searchParams
  const profileUsername = params.profile?.toLowerCase()
  const linkToken = params.t

  console.log(linkToken)

  if (!profileUsername) {
    return <BarberSearch />
  }

  const supabase = await createSupabaseServerClient()

  // Get barber profile (case-insensitive)
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id, full_name, booking_link, phone')
    .ilike('username', profileUsername)
    .single()

  if (!profile) {
    return <BarberSearch />
  }

  // Update click tracking if token exists
  if (linkToken) {
    supabase
      .from('test_acuity_clients')
      .update({ last_date_clicked_link: new Date().toISOString() })
      .eq('link_token', linkToken)
      .then(() => {}) // Fire and forget
  }

  // If no booking link set, show search with this barber selected
  if (!profile.booking_link) {
    return (
      <BarberSearch
        initialBarber={{
          full_name: profile.full_name,
          booking_link: null,
          phone: profile.phone,
        }}
      />
    )
  }

  // Redirect to booking link
  redirect(profile.booking_link)
}