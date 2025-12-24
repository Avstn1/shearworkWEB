// app/api/client-manager/clients/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/api-auth';

type SortField =
  | 'last_appt'
  | 'first_appt'
  | 'first_name'
  | 'last_name'
  | 'total_appointments';

type DbRow = {
  client_id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_normalized?: string | null;
  notes?: string | null;
  first_appt: string | null;
  last_appt: string | null;
  total_appointments: number | null;
  total_tips_all_time?: number | null;
};

type AggregatedClient = {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  notes: string | null;
  first_appt: string | null;
  last_appt: string | null;
  total_appointments: number;
  total_tips_all_time: number;
};

function buildIdentityKey(row: DbRow): string {
  const emailKey = (row.email ?? '').toLowerCase().trim();
  const phoneKey = (row.phone_normalized ?? row.phone ?? '').replace(/\D/g, '');
  const nameKey =
    `${(row.first_name ?? '').trim().toLowerCase()} ${(row.last_name ?? '')
      .trim()
      .toLowerCase()}`.trim();

  // Prefer email, then phone, then name, then fallback to client_id
  return emailKey || phoneKey || nameKey || row.client_id;
}

function compareDates(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function normalizePhone(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '');
}

// ✅ case-insensitive, supports "first last" and multi-token
function matchesSearch(c: AggregatedClient, raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s) return true;

  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const fullName = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim().toLowerCase();
  const email = (c.email ?? '').toLowerCase();
  const phone = normalizePhone(c.phone);
  const phoneNorm = normalizePhone(c.phone_normalized);
  const notes = (c.notes ?? '').toLowerCase();

  // One combined haystack helps "tiago andrade" match fullName naturally
  const combined = `${fullName} ${email} ${phone} ${phoneNorm} ${notes}`.trim();

  // Require every token to appear somewhere (AND behavior)
  return tokens.every((t) => combined.includes(t));
}

export async function GET(req: Request) {
  return handleClientRequest(req, 'GET');
}

export async function POST(req: Request) {
  return handleClientRequest(req, 'POST');
}

async function handleClientRequest(req: Request, method: 'GET' | 'POST') {
  const { user, supabase } = await getAuthenticatedUser(req);

  if (!user || !supabase) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  
  // Parse request body for POST
  let excludePhones: string[] = [];
  if (method === 'POST') {
    try {
      const body = await req.json();
      excludePhones = body.exclude || [];
    } catch (e) {
      // If body parsing fails, continue with empty array
    }
  } else {
    // GET: Use query params (for small lists or backward compatibility)
    const excludeParam = url.searchParams.get('exclude')?.trim() ?? '';
    excludePhones = excludeParam
      ? excludeParam.split(',').map(phone => phone.trim()).filter(Boolean)
      : [];
  }
  
  const search = url.searchParams.get('search')?.trim() ?? '';
  const sort: SortField =
    ((url.searchParams.get('sort') as SortField | null) ?? 'last_appt');
  const dir: 'asc' | 'desc' =
    url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  // ✅ Pagination params (1-based)
  const pageRaw = parseInt(url.searchParams.get('page') ?? '1', 10);
  const limitRaw = parseInt(url.searchParams.get('limit') ?? '25', 10);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const limitUnclamped =
    Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 25;
  const limit = Math.min(100, Math.max(5, limitUnclamped));

  // 1️⃣ Fetch raw rows from acuity_clients for this user
  // NOTE: we intentionally do NOT apply DB search here, because "Tiago Andrade"
  // won't match first_name or last_name individually. We'll search AFTER dedupe.
  let query = supabase
    .from('acuity_clients')
    .select(
      `
      client_id,
      user_id,
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
    `,
    )
    .eq('user_id', user.id);

  // Optional: still order raw rows a bit (not required, since we sort after dedupe)
  const orderColumn: SortField = sort ?? 'last_appt';
  query = query.order(orderColumn, { ascending: dir === 'asc' });

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 },
    );
  }

  const rows: DbRow[] = (data ?? []) as DbRow[];

  // 2️⃣ Merge duplicates by identity key
  const map = new Map<string, AggregatedClient>();

  for (const row of rows) {
    const identity = buildIdentityKey(row);

    const existing = map.get(identity);
    if (!existing) {
      map.set(identity, {
        client_id: identity,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        phone: row.phone,
        phone_normalized:
          ((row.phone_normalized ?? row.phone ?? '').replace(/\D/g, '') ||
            null) as string | null,
        notes: (row.notes as string | null) ?? null,
        first_appt: row.first_appt,
        last_appt: row.last_appt,
        total_appointments: row.total_appointments ?? 0,
        total_tips_all_time: row.total_tips_all_time ?? 0,
      });
    } else {
      if (!existing.first_name && row.first_name) existing.first_name = row.first_name;
      if (!existing.last_name && row.last_name) existing.last_name = row.last_name;
      if (!existing.email && row.email) existing.email = row.email;
      if (!existing.phone && row.phone) existing.phone = row.phone;
      if (!existing.notes && row.notes) existing.notes = row.notes as string | null;

      if (
        row.first_appt &&
        (!existing.first_appt || compareDates(row.first_appt, existing.first_appt) < 0)
      ) {
        existing.first_appt = row.first_appt;
      }

      if (
        row.last_appt &&
        (!existing.last_appt || compareDates(row.last_appt, existing.last_appt) > 0)
      ) {
        existing.last_appt = row.last_appt;
      }

      existing.total_appointments += row.total_appointments ?? 0;
      existing.total_tips_all_time += row.total_tips_all_time ?? 0;
    }
  }

  let clients = Array.from(map.values());

  // ✅ 3️⃣ Apply search AFTER dedupe (case-insensitive, works across ALL pages)
  if (search) {
    clients = clients.filter((c) => matchesSearch(c, search));
  }

  let clientListLength = 0;
  if (method === 'POST' && excludePhones.length > 0) {
    clientListLength = clients.length;
    
    // Strip the '+' prefix from exclude phones to match database format
    const excludeSet = new Set(excludePhones.map(phone => phone.replace(/^\+/, '')));
    
    clients = clients.filter((c) => !excludeSet.has(c.phone_normalized || ''));
  }

  // 4️⃣ Final sort on aggregated (and filtered) data
  clients.sort((a, b) => {
    let cmp = 0;

    switch (sort) {
      case 'first_name': {
        const av = (a.first_name ?? '').toLowerCase();
        const bv = (b.first_name ?? '').toLowerCase();
        cmp = av.localeCompare(bv);
        break;
      }
      case 'last_name': {
        const av = (a.last_name ?? '').toLowerCase();
        const bv = (b.last_name ?? '').toLowerCase();
        cmp = av.localeCompare(bv);
        break;
      }
      case 'total_appointments': {
        cmp = (a.total_appointments ?? 0) - (b.total_appointments ?? 0);
        break;
      }
      case 'first_appt': {
        cmp = compareDates(a.first_appt, b.first_appt);
        break;
      }
      case 'last_appt':
      default: {
        cmp = compareDates(a.last_appt, b.last_appt);
        break;
      }
    }

    return dir === 'asc' ? cmp : -cmp;
  });

  // ✅ 5️⃣ Paginate AFTER search + dedupe + sort + exclude
  const total = clients.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;
  const paged = clients.slice(start, start + limit);

  console.log(`Total clients ${total}`)
  console.log(`Total clients length ${clientListLength}`)

  return NextResponse.json({
    clients: paged,
    page: safePage,
    limit,
    total,
    totalPages,
    clientListLength, 
  });
}