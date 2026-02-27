import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/utils/api-auth'
import { createSupabaseAdminClient } from '@/lib/supabaseServer'

export async function POST(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request)

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { userId } = body

    // Ensure the requester can only delete their own account
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminClient = createSupabaseAdminClient()

    // Server-side subscription check — prevents deletion if the user has an
    // active Stripe subscription, even if the client-side check is bypassed
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('stripe_subscription_status')
      .eq('user_id', userId)
      .single()

    if (profileError) {
      console.error('Error fetching profile for deletion check:', profileError.message)
      return NextResponse.json({ error: 'Failed to verify account status' }, { status: 500 })
    }

    if (profile?.stripe_subscription_status === 'active') {
      return NextResponse.json(
        { error: 'You must cancel your subscription before deleting your account.', code: 'active_subscription' },
        { status: 403 }
      )
    }

    // Delete in children-first order. Only tables with NO ACTION delete rules need
    // to be explicitly deleted — CASCADE tables will be handled automatically when
    // auth.admin.deleteUser fires. We still delete them explicitly for safety.
    //
    // NO ACTION tables (MUST be cleared before deleteUser or it will fail):
    //   sms_smart_buckets, square_appointments, square_clients,
    //   square_locations, square_orders, square_payments
    //
    // Excluded views: yearly_top_clients, yearly_revenue_summary,
    //                 weekly_service_bookings, quarterly_revenue_summary
    // Excluded: migration_backup_* and test_* (historical snapshots)
    const tablesToDelete = [
      // --- NO ACTION tables — must be deleted first ---
      'square_payments',
      'square_orders',
      'square_appointments',
      'square_clients',
      'square_locations',
      'sms_smart_buckets',

      // --- CASCADE tables (deleted explicitly for safety) ---
      'sms_replies',
      'sms_sent',
      'sms_scheduled_messages',
      'barber_nudge_success',
      'credit_transactions',
      'notifications',
      'push_tokens',
      'user_devices',
      'user_page_tutorials',
      'yearly_revenue',
      'yearly_marketing_funnels',
      'yearly_expenses',
      'yearly_appointments_summary',
      'weekly_top_clients',
      'weekly_marketing_funnels_base',
      'weekly_data',
      'monthly_receipts',
      'monthly_data',
      'monthly_appointments_summary',
      'report_top_clients',
      'reports',
      'daily_summaries',
      'daily_service_bookings',
      'daily_marketing_funnels',
      'daily_data',
      'marketing_funnels',
      'service_bookings',
      'availability_slots',
      'availability_daily_summary',
      'square_tokens',
      'acuity_appointments',
      'acuity_clients',
      'acuity_tokens',
      'recurring_expenses',
      'sync_status',
      'profiles_audit',
      'profiles_backup',
      'profiles',
    ]

    const errors: string[] = []

    for (const table of tablesToDelete) {
      const { error } = await adminClient.from(table).delete().eq('user_id', userId)
      if (error) {
        console.error(`Error deleting from ${table}:`, error.message)
        errors.push(table)
      }
    }

    if (errors.length > 0) {
      console.warn(`Account deletion: failed to clean up tables [${errors.join(', ')}] for user ${userId}`)
    }

    // Delete the auth user — cascades everything else automatically
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (deleteError) {
      // Supabase returns unexpected_failure if the user no longer exists in auth.users.
      // This can happen if a previous attempt partially succeeded — verify and treat as success.
      if (deleteError.status === 500 && deleteError.code === 'unexpected_failure') {
        const { data: check } = await adminClient.auth.admin.getUserById(userId)
        if (!check?.user) {
          console.warn(`deleteUser returned unexpected_failure but user ${userId} not found — treating as success`)
          return NextResponse.json({ success: true })
        }
      }
      console.error('Error deleting auth user:', deleteError)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete account error:', err)
    return NextResponse.json({ error: 'Unexpected error', details: String(err) }, { status: 500 })
  }
}