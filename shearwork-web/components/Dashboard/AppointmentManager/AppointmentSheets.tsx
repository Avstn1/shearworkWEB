'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AppointmentEditModal from './AppointmentEditModal';

type AppointmentRow = {
  id: string;
  acuity_appointment_id: string | null;
  client_id: string | null;
  phone_normalized: string | null;
  appointment_date: string; // date (YYYY-MM-DD)
  datetime: string; // full timestamp
  revenue: number | null;
  tip: number | null;
  service_type: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
};

type SortField = 'datetime' | 'revenue' | 'tip';

type ApiResponse = {
  appointments: AppointmentRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function AppointmentSheets() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [search, setSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Sort state
  const [sortField, setSortField] = useState<SortField>('datetime');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modal state
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Request sequencing to prevent stale responses
  const requestSeq = useRef(0);

  const fetchAppointments = async (opts?: {
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

    const s = (opts?.search ?? searchTerm).trim().toLowerCase();
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
      const res = await fetch(`/api/appointment-manager/appointments?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch appointments');
      }

      const body: ApiResponse = await res.json();

      if (seq !== requestSeq.current) return;

      setAppointments(body.appointments || []);
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

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => {
      const normalized = search.trim().toLowerCase();
      setSearchTerm(normalized);
      setPage(1);
    }, 350);

    return () => clearTimeout(id);
  }, [search]);

  // Fetch when query state changes
  useEffect(() => {
    fetchAppointments({
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
      setSortDir(field === 'datetime' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const handleRowClick = (appointment: AppointmentRow) => {
    setSelectedAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedAppointment(null);
  };

  const handleAppointmentUpdate = (appointmentId: string, updates: { tip?: number; revenue?: number }) => {
    // Update the local state to reflect the changes
    setAppointments((prev) =>
      prev.map((appt) =>
        appt.id === appointmentId
          ? { 
              ...appt, 
              ...(updates.tip !== undefined && { tip: updates.tip }),
              ...(updates.revenue !== undefined && { revenue: updates.revenue }),
            }
          : appt
      )
    );
  };

  const displayAppointments = useMemo(() => appointments, [appointments]);

  const formatDateTime = (d: string | null | undefined) => {
    if (!d) return '—';
    const dateObj = new Date(d);
    if (Number.isNaN(dateObj.getTime())) return '—';
    return dateObj.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return `$${value.toFixed(2)}`;
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '';

  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = Math.min(page * limit, total);

  // Calculate totals for current page
  const pageTotals = useMemo(() => {
    const revenueTotal = displayAppointments.reduce(
      (sum, appt) => sum + (appt.revenue || 0),
      0
    );
    const tipTotal = displayAppointments.reduce(
      (sum, appt) => sum + (appt.tip || 0),
      0
    );
    return { revenueTotal, tipTotal };
  }, [displayAppointments]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Top controls */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-white">Appointment Sheets</h2>
          <p className="text-xs text-[#bdbdbd]">
            View past appointments and manage tips. Click any row to edit.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="px-3 py-2 rounded-lg bg-black/30 border border-white/15 text-sm text-white placeholder:text-[#777] focus:outline-none focus:ring-2 focus:ring-amber-300/70"
          />
          <button
            onClick={() => {
              const normalized = search.trim().toLowerCase();
              setSearchTerm(normalized);
              setPage(1);
              fetchAppointments({ search: normalized, sort: sortField, dir: sortDir, page: 1, limit });
            }}
            className="px-3 py-2 rounded-lg bg-amber-300 text-black text-xs font-semibold shadow hover:bg-amber-200 transition"
          >
            Search
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5]">
          Total appointments: <span className="font-semibold">{total}</span>
        </div>
        <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5]">
          Page revenue total:{' '}
          <span className="font-semibold text-green-300">{formatCurrency(pageTotals.revenueTotal)}</span>
        </div>
        <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5]">
          Page tips total:{' '}
          <span className="font-semibold text-amber-300">{formatCurrency(pageTotals.tipTotal)}</span>
        </div>
      </div>

      {/* Pagination bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="text-xs text-[#bdbdbd]">
          {total > 0 ? (
            <>
              Showing <span className="text-white">{pageStart}</span>–
              <span className="text-white">{pageEnd}</span> of{' '}
              <span className="text-white">{total}</span>
              {searchTerm ? (
                <span className="text-[#a0a0a0]"> (filtered)</span>
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
            className="px-2 py-2 rounded-lg bg-black/30 border border-white/15 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-300/50"
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
          <div className="py-16 text-center text-sm text-[#bdbdbd]">Loading appointments…</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-300">{error}</div>
        ) : displayAppointments.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#bdbdbd]">
            No past appointments found.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-[#121613] border-b border-white/10 text-xs uppercase tracking-wide text-[#bdbdbd]">
              <tr>
                <th className="px-4 py-3 text-left">Appt #</th>
                <th className="px-4 py-3 text-left">First Name</th>
                <th className="px-4 py-3 text-left">Last Name</th>
                <th
                  className="px-4 py-3 text-left cursor-pointer select-none hover:text-amber-200"
                  onClick={() => handleSortClick('revenue')}
                >
                  Revenue {sortIndicator('revenue')}
                </th>
                <th
                  className="px-4 py-3 text-left cursor-pointer select-none hover:text-amber-200"
                  onClick={() => handleSortClick('tip')}
                >
                  Tip {sortIndicator('tip')}
                </th>
                <th
                  className="px-4 py-3 text-left cursor-pointer select-none hover:text-amber-200"
                  onClick={() => handleSortClick('datetime')}
                >
                  Date & Time {sortIndicator('datetime')}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayAppointments.map((appt, index) => {
                const rowNumber = pageStart + index;

                return (
                  <tr
                    key={appt.id}
                    onClick={() => handleRowClick(appt)}
                    className="border-b border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-[#a0a0a0] font-mono text-xs">
                      #{rowNumber}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {appt.client_first_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {appt.client_last_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-green-300 font-medium">
                      {formatCurrency(appt.revenue)}
                    </td>
                    <td className="px-4 py-3 text-amber-300 font-medium">
                      {formatCurrency(appt.tip)}
                    </td>
                    <td className="px-4 py-3 text-[#d4d4d4]">
                      {formatDateTime(appt.datetime)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      <AppointmentEditModal
        isOpen={isModalOpen}
        appointment={selectedAppointment}
        onClose={handleModalClose}
        onUpdate={handleAppointmentUpdate}
      />
    </div>
  );
}