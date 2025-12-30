'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ClientRow = {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_normalized?: string | null;
  notes?: string | null;
  first_appt: string | null; // ISO date (YYYY-MM-DD)
  last_appt: string | null; // ISO date
  total_appointments: number | null;
  total_tips_all_time?: number | null;
};

type SortField =
  | 'last_appt'
  | 'first_appt'
  | 'first_name'
  | 'last_name'
  | 'total_appointments';

type ApiResponse = {
  clients: ClientRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function ClientSheets() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // what user is typing
  const [search, setSearch] = useState('');
  // debounced + normalized version we actually query with
  const [searchTerm, setSearchTerm] = useState('');

  const [sortField, setSortField] = useState<SortField>('last_appt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ✅ Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // used to prevent older fetch responses from overwriting newer ones
  const requestSeq = useRef(0);

  const fetchClients = async (opts?: {
    search?: string;
    sort?: SortField;
    dir?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) => {
    const seq = ++requestSeq.current;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();

    const sRaw = opts?.search ?? searchTerm;
    const s = sRaw.trim().toLowerCase(); // ✅ normalize on client (API uses ilike anyway)
    const sf = opts?.sort ?? sortField;
    const sd = opts?.dir ?? sortDir;
    const p = opts?.page ?? page;
    const l = opts?.limit ?? limit;

    if (s) params.set('search', s);
    params.set('sort', sf);
    params.set('dir', sd);
    params.set('page', String(p));
    params.set('limit', String(l));

    try {
      const res = await fetch(`/api/client-manager/clients?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch clients');
      }

      const body: ApiResponse = await res.json();

      // if a newer request finished already, ignore this response
      if (seq !== requestSeq.current) return;

      setClients(body.clients || []);
      setPage(body.page ?? p);
      setLimit(body.limit ?? l);
      setTotal(body.total ?? 0);
      setTotalPages(body.totalPages ?? 1);
    } catch (err: any) {
      if (seq !== requestSeq.current) return;
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      if (seq !== requestSeq.current) return;
      setLoading(false);
    }
  };

  // ✅ debounce search input -> searchTerm (server search is case-insensitive anyway)
  useEffect(() => {
    const id = setTimeout(() => {
      const normalized = search.trim().toLowerCase();
      setSearchTerm(normalized);
      setPage(1); // always reset page when search changes
    }, 350);

    return () => clearTimeout(id);
  }, [search]);

  // ✅ fetch whenever "query state" changes
  // - includes searchTerm (debounced), sort, dir, page, limit
  useEffect(() => {
    fetchClients({
      search: searchTerm,
      sort: sortField,
      dir: sortDir,
      page,
      limit,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, sortField, sortDir, page, limit]);

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'first_name' || field === 'last_name' ? 'asc' : 'desc');
    }
    setPage(1); // reset page on sort change
  };

  const displayClients = useMemo(() => clients, [clients]);

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    const [year, month, day] = d.split('-').map(Number);
    if (!year || !month || !day) return '—';
    const dateObj = new Date(year, month - 1, day);
    if (Number.isNaN(dateObj.getTime())) return '—';
    return dateObj.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '';

  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top controls */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-white">Client Sheets</h2>
          <p className="text-xs text-[#bdbdbd]">
            View and manage detailed client information, visit history, and preferences.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="px-3 py-2 rounded-lg bg-black/30 border border-white/15 text-sm text-white placeholder:text-[#777] focus:outline-none focus:ring-2 focus:ring-lime-300/70"
          />
          <button
            onClick={() => {
              // force immediate refresh with current input (server-side)
              const normalized = search.trim().toLowerCase();
              setSearchTerm(normalized);
              setPage(1);
              fetchClients({ search: normalized, sort: sortField, dir: sortDir, page: 1, limit });
            }}
            className="px-3 py-2 rounded-lg bg-lime-300 text-black text-xs font-semibold shadow hover:bg-lime-200 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5]">
          Total clients: <span className="font-semibold">{total}</span>
        </div>

        {/* page-based counts (expected with pagination) */}
        <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5]">
          Repeat clients (2+ visits) on this page:{' '}
          <span className="font-semibold">
            {displayClients.filter((c) => (c.total_appointments ?? 0) >= 2).length}
          </span>
        </div>
        <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5]">
          Heavy regulars (10+ visits) on this page:{' '}
          <span className="font-semibold">
            {displayClients.filter((c) => (c.total_appointments ?? 0) >= 10).length}
          </span>
        </div>
      </div>

      {/* Pagination bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="text-xs text-[#bdbdbd]">
          {total > 0 ? (
            <>
              Showing <span className="text-white">{pageStart}</span>–<span className="text-white">{pageEnd}</span> of{' '}
              <span className="text-white">{total}</span>
              {searchTerm ? (
                <>
                  {' '}
                  <span className="text-[#a0a0a0]">(filtered)</span>
                </>
              ) : null}
            </>
          ) : (
            <>Showing 0 results</>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={limit}
            onChange={(e) => {
              const newLimit = parseInt(e.target.value, 10);
              setLimit(newLimit);
              setPage(1);
            }}
            className="px-2 py-2 rounded-lg bg-black/30 border border-white/15 text-xs text-white focus:outline-none focus:ring-2 focus:ring-lime-300/50"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>

          <button
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
              loading || page <= 1
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Prev
          </button>

          <div className="px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs text-white">
            Page <span className="font-semibold">{page}</span> /{' '}
            <span className="font-semibold">{totalPages}</span>
          </div>

          <button
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
              loading || page >= totalPages
                ? 'bg-white/10 text-white/40 cursor-not-allowed'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            Next
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-white/10 bg-black/20 backdrop-blur-md">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#bdbdbd]">Loading clients…</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-300">{error}</div>
        ) : displayClients.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#bdbdbd]">
            No clients found.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-[#121613] border-b border-white/10 text-xs uppercase tracking-wide text-[#bdbdbd]">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th
                  className="px-4 py-3 text-left cursor-pointer select-none hover:text-lime-200"
                  onClick={() => handleSortClick('last_appt')}
                >
                  Last Visit {sortIndicator('last_appt')}
                </th>
                <th
                  className="px-4 py-3 text-left cursor-pointer select-none hover:text-lime-200"
                  onClick={() => handleSortClick('first_appt')}
                >
                  First Visit {sortIndicator('first_appt')}
                </th>
                <th
                  className="px-4 py-3 text-left cursor-pointer select-none hover:text-lime-200"
                  onClick={() => handleSortClick('total_appointments')}
                >
                  Total Visits {sortIndicator('total_appointments')}
                </th>
                <th className="px-4 py-3 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {displayClients.map((c) => {
                const fullName =
                  `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unknown';

                const lastVisitRaw = c.last_appt ?? c.first_appt;
                const lastVisit = formatDate(lastVisitRaw);
                const firstVisit = formatDate(c.first_appt);

                return (
                  <tr
                    key={c.client_id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-3 text-white">
                      <div className="font-medium">{fullName}</div>
                      {c.email && (
                        <div className="text-[11px] text-[#a0a0a0] sm:hidden">
                          {c.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#d4d4d4]">
                      <div className="space-y-0.5">
                        {c.phone && <div className="text-[12px]">{c.phone}</div>}
                        {c.email && (
                          <div className="text-[11px] text-[#a0a0a0] hidden sm:block">
                            {c.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#d4d4d4]">{lastVisit}</td>
                    <td className="px-4 py-3 text-[#d4d4d4]">{firstVisit}</td>
                    <td className="px-4 py-3 text-[#d4d4d4]">
                      {(c.total_appointments ?? 0).toString()}
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0] max-w-xs truncate">
                      {c.notes || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
