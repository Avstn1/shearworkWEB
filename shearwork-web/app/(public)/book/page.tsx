import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { redirect } from 'next/navigation'
import { BarberSearch } from './BarberSearch'

type PageProps = {
  searchParams: Promise<{ profile?: string; t?: string }>
}

function getISOWeek(): string {
  const now = new Date(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  )

  const day = now.getDay() || 7
  now.setDate(now.getDate() + 4 - day)

  const yearStart = new Date(now.getFullYear(), 0, 1)
  const week = Math.ceil(((+now - +yearStart) / 86400000 + 1) / 7)
  const year = now.getFullYear()

  return `${year}-W${week.toString().padStart(2, '0')}`
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
  const isoWeek = getISOWeek()
  if (linkToken) {
    supabase
      .from('acuity_clients')
      .update({ last_date_clicked_link: new Date().toISOString() })
      .eq('link_token', linkToken)
      .then(() => {})

    const { error } = await supabase.rpc(
      'increment_barber_nudge_clicked_link',
      {
        p_user_id: profile.user_id,        
        p_iso_week: isoWeek       
      }
    )

    if (error) {
      console.error(error)
    }
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