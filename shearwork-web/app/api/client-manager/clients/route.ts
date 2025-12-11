/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/api-auth';

const ALLOWED_SORT_FIELDS = new Set([
  'last_appt',
  'first_appt',
  'first_name',
  'last_name',
  'total_appointments',
]);

export async function GET(request: Request) {
  const { user, supabase } = await getAuthenticatedUser(request);

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() || '';
  const sort = searchParams.get('sort') || 'last_appt';
  const dir = (searchParams.get('dir') || 'desc') as 'asc' | 'desc';

  const sortField = ALLOWED_SORT_FIELDS.has(sort) ? sort : 'last_appt';
  const sortAsc = dir === 'asc';

  let query = supabase
    .from('acuity_clients')
    .select(
      `
      client_id,
      first_name,
      last_name,
      email,
      phone,
      phone_normalized,
      notes,
      first_appt,
      last_appt,
      total_appointments,
      total_tips_all_time
    `
    )
    .eq('user_id', user.id);

  if (search) {
    const term = `%${search.toLowerCase()}%`;
    query = query.or(
      [
        `first_name.ilike.${term}`,
        `last_name.ilike.${term}`,
        `email.ilike.${term}`,
        `phone.ilike.${term}`,
        `phone_normalized.ilike.${term}`,
        `notes.ilike.${term}`,
      ].join(',')
    );
  }

  query = query.order(sortField, { ascending: sortAsc, nullsFirst: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    );
  }

  return NextResponse.json({ clients: data ?? [] });
}
