'use client';

import { useEffect, useState, useMemo } from 'react';

type ClientRow = {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_normalized?: string | null;
  notes?: string | null;
  first_appt: string | null; // ISO date (YYYY-MM-DD)
  last_appt: string | null;  // ISO date
  total_appointments: number | null;
  total_tips_all_time?: number | null;
};

type SortField = 'last_appt' | 'first_appt' | 'first_name' | 'last_name' | 'total_appointments';

export default function ClientSheets() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_appt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Fetch from our new API route
  const fetchClients = async (opts?: { search?: string; sort?: SortField; dir?: 'asc' | 'desc' }) => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (opts?.search) params.set('search', opts.search);
    if (opts?.sort) params.set('sort', opts.sort);
    if (opts?.dir) params.set('dir', opts.dir);

    try {
      const res = await fetch(`/api/client-manager/clients?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch clients');
      }

      const body = await res.json();
      setClients(body.clients || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients({ sort: sortField, dir: sortDir });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When sort changes, re-fetch (server-side sort)
  useEffect(() => {
    fetchClients({ search, sort: sortField, dir: sortDir });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDir]);

  // Simple debounce for search
  useEffect(() => {
    const id = setTimeout(() => {
      fetchClients({ search, sort: sortField, dir: sortDir });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'first_name' || field === 'last_name' ? 'asc' : 'desc');
    }
  };

  const displayClients = useMemo(() => clients, [clients]);

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    // Expecting YYYY-MM-DD or ISO
    const dateObj = new Date(d);
    if (Number.isNaN(dateObj.getTime())) return d;
    return dateObj.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '';

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
            onClick={() => fetchClients({ search, sort: sortField, dir: sortDir })}
            className="px-3 py-2 rounded-lg bg-lime-300 text-black text-xs font-semibold shadow hover:bg-lime-200 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5]">
          Total clients: <span className="font-semibold">{clients.length}</span>
        </div>
        <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5]">
          Repeat clients (2+ visits):{' '}
          <span className="font-semibold">
            {clients.filter((c) => (c.total_appointments ?? 0) >= 2).length}
          </span>
        </div>
        <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5]">
          Heavy regulars (10+ visits):{' '}
          <span className="font-semibold">
            {clients.filter((c) => (c.total_appointments ?? 0) >= 10).length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-white/10 bg-black/20 backdrop-blur-md">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#bdbdbd]">Loading clients…</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-300">
            {error}
          </div>
        ) : displayClients.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#bdbdbd]">
            No clients found yet. Once you start taking appointments, they’ll appear here.
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
                        {c.phone && (
                          <div className="text-[12px]">
                            {c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="text-[11px] text-[#a0a0a0] hidden sm:block">
                            {c.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#d4d4d4]">
                      {formatDate(c.last_appt)}
                    </td>
                    <td className="px-4 py-3 text-[#d4d4d4]">
                      {formatDate(c.first_appt)}
                    </td>
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
