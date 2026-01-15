'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Filter, X, ChevronDown } from 'lucide-react';
import ClientSheetsFilterDropdown, {
  ActiveFilter,
  FilterType,
} from '@/components/Dashboard/ClientManager/ClientSheetsFilterModal';
import FAQModal from '@/components/Dashboard/ClientManager/FAQModal';

import toast from 'react-hot-toast'

type ClientRow = {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  notes: string | null;
  first_appt: string | null;
  last_appt: string | null;
  total_appointments: number | null;
  total_tips_all_time: number | null;
  visiting_type: string | null;
  date_last_sms_sent: string | null;
  sms_subscribed: boolean;
};

type SortField =
  | 'last_appt'
  | 'first_appt'
  | 'first_name'
  | 'last_name'
  | 'total_appointments'
  | 'date_last_sms_sent';

const FILTERS_STORAGE_KEY = 'clientSheetsFilters';

export default function ClientSheets() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>('last_appt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [minYear, setMinYear] = useState<number>(new Date().getFullYear() - 10);
  const [useApproximateCount, setUseApproximateCount] = useState(false);
  const [isFAQOpen, setIsFAQOpen] = useState(false);

  const [user, setUser] = useState<any>(null)
  const [dataSource, setDataSource] = useState<'acuity' | 'square'>('acuity')

  const requestSeq = useRef(0);
  const statsCache = useRef<{ minYear?: number; timestamp?: number }>({});

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        if (authError) throw authError
        if (!session?.user) return
        setUser(session.user)

        const { data: squareToken } = await supabase
          .from('square_tokens')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle()

        const useSquare = Boolean(squareToken?.user_id)
        setDataSource(useSquare ? 'square' : 'acuity')

        const sourceKey = useSquare ? 'square' : 'acuity'
        const cacheKey = `client_stats_${session.user.id}_${sourceKey}`
        const cached = sessionStorage.getItem(cacheKey)
        const now = Date.now()

        if (cached) {
          try {
            const { minYear: cachedMinYear, timestamp } = JSON.parse(cached)
            if (cachedMinYear && timestamp && (now - timestamp < 3600000)) { // 1 hour
              setMinYear(cachedMinYear)
              statsCache.current = { minYear: cachedMinYear, timestamp }
              return
            }
          } catch (e) {
            // Invalid cache, continue to fetch
          }
        }

        if (!useSquare) {
          const { data: statsData } = await supabase
            .from('user_client_stats')
            .select('min_year')
            .eq('user_id', session.user.id)
            .single()

          if (statsData?.min_year) {
            const year = statsData.min_year
            setMinYear(year)
            const cacheData = { minYear: year, timestamp: now }
            statsCache.current = cacheData
            sessionStorage.setItem(cacheKey, JSON.stringify(cacheData))
            return
          }
        }

        const tableName = useSquare ? 'square_clients' : 'acuity_clients'
        const { data: minYearData } = await supabase
          .from(tableName)
          .select('first_appt')
          .eq('user_id', session.user.id)
          .not('first_appt', 'is', null)
          .order('first_appt', { ascending: true })
          .limit(1)
          .single()

        if (minYearData?.first_appt) {
          const year = new Date(minYearData.first_appt).getFullYear()
          setMinYear(year)
          const cacheData = { minYear: year, timestamp: now }
          statsCache.current = cacheData
          sessionStorage.setItem(cacheKey, JSON.stringify(cacheData))
        }
      } catch (err) {
        console.error('Error fetching user:', err)
        toast.error('Failed to fetch user.')
      }
    }
    fetchUser()
  }, [])

  // Load filters from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveFilters(parsed);
      } catch (e) {
        console.error('Failed to parse saved filters', e);
      }
    }
  }, []);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(activeFilters));
  }, [activeFilters]);

  const fetchClients = async () => {
    if (!user) return;
    
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);

    try {
      const tableName = dataSource === 'square' ? 'square_clients' : 'acuity_clients';
      const clientIdField = dataSource === 'square' ? 'customer_id' : 'client_id';

      const monthFilters = activeFilters.filter(
        (f) => f.type === 'first_appt_month' || f.type === 'last_appt_month'
      );

      let query = supabase
        .from(tableName)
        .select('*', { count: useApproximateCount ? 'planned' : 'exact' })
        .eq('user_id', user.id);

      // Apply filters
      activeFilters.forEach((filter) => {
        const { type, value } = filter;

        if (
          type === 'first_name' ||
          type === 'last_name' ||
          type === 'email' ||
          type === 'phone_normalized'
        ) {
          query = query.ilike(type, `%${value}%`);
        } else if (type === 'first_appt_month') {
          const monthNum = Number(value);
          const currentYear = new Date().getFullYear();
          // Generate date ranges for this month across multiple years (last 20 years)
          const years = Array.from({ length: 20 }, (_, i) => currentYear - i);
          const orConditions = years.map(year => {
            const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
            const endMonth = monthNum === 12 ? 1 : monthNum + 1;
            const endYear = monthNum === 12 ? year + 1 : year;
            const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
            return `and(first_appt.gte.${startDate},first_appt.lt.${endDate})`;
          }).join(',');
          query = query.or(orConditions);
        } else if (type === 'first_appt_year') {
          query = query.gte('first_appt', `${value}-01-01`);
          query = query.lt('first_appt', `${Number(value) + 1}-01-01`);
        } else if (type === 'last_appt_month') {
          const monthNum = Number(value);
          const currentYear = new Date().getFullYear();
          // Generate date ranges for this month across multiple years (last 20 years)
          const years = Array.from({ length: 20 }, (_, i) => currentYear - i);
          const orConditions = years.map(year => {
            const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
            const endMonth = monthNum === 12 ? 1 : monthNum + 1;
            const endYear = monthNum === 12 ? year + 1 : year;
            const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
            return `and(last_appt.gte.${startDate},last_appt.lt.${endDate})`;
          }).join(',');
          query = query.or(orConditions);
        } else if (type === 'last_appt_year') {
          query = query.gte('last_appt', `${value}-01-01`);
          query = query.lt('last_appt', `${Number(value) + 1}-01-01`);
        } else if (type === 'visiting_type') {
          query = query.eq('visiting_type', value);
        } else if (type === 'sms_subscribed') {
          query = query.eq('sms_subscribed', value === 'true');
        } else if (type === 'phone_available') {
          if (value === 'true') {
            query = query.not('phone_normalized', 'is', null);
            query = query.neq('phone_normalized', '');
          } else {
            query = query.or('phone_normalized.is.null,phone_normalized.eq.');
          }
        }
      });

      query = query.order(sortField, { ascending: sortDir === 'asc' });

      const start = (page - 1) * limit;
      query = query.range(start, start + limit - 1);

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;
      if (seq !== requestSeq.current) return;

      const mapped = (data || []).map((row: any) => ({
        ...row,
        client_id: row.client_id ?? row[clientIdField] ?? row.customer_id ?? row.client_id,
      })) as ClientRow[];

      setClients(mapped);
      setTotal(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / limit)));
    } catch (err: any) {
      if (seq !== requestSeq.current) return;
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      if (seq !== requestSeq.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDir, page, limit, activeFilters, user, dataSource]);

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'first_name' || field === 'last_name' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const handleRemoveFilter = (filterId: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== filterId));
    setPage(1);
  };

  const displayClients = useMemo(() => clients, [clients]);

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '—';
    const [year, month, day] = d.split('-').map(Number);
    if (!year || !month || !day) return '—';
    const dateObj = new Date(year, month - 1, day);
    if (Number.isNaN(dateObj.getTime())) return '—';
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Toronto',
    });
  };

  const formatDateTime = (d: string | null | undefined) => {
    if (!d) return '—';
    const dateObj = new Date(d);
    if (Number.isNaN(dateObj.getTime())) return '—';
    return dateObj.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Toronto',
    });
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '';

  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-3 overflow-hidden p-1" style={{ height: 'calc(80vh - 80px)', maxHeight: 'calc(82vh - 80px)' }}>
      {/* Top controls */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between flex-shrink-0">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-white">Client Sheets</h2>
          <p className="text-xs text-[#bdbdbd]">
            View and manage detailed client information, visit history, and preferences.
          </p>
        </div>

        <div className="relative">
          <button
            data-filter-toggle
            onClick={() => setIsFilterModalOpen(!isFilterModalOpen)}
            className="px-4 py-2 rounded-lg bg-lime-300 text-black text-sm font-semibold shadow hover:bg-lime-200 transition flex items-center gap-2"
          >
            <Filter size={16} />
            Add Filter
            <ChevronDown size={16} className={`transition-transform ${isFilterModalOpen ? 'rotate-180' : ''}`} />
          </button>
          
          <ClientSheetsFilterDropdown
            isOpen={isFilterModalOpen}
            onToggle={() => setIsFilterModalOpen(false)}
            activeFilters={activeFilters}
            onFiltersChange={(filters) => {
              setActiveFilters(filters);
              setPage(1);
            }}
            minYear={minYear}
          />
        </div>
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {activeFilters.map((filter) => (
            <div
              key={filter.id}
              className="px-3 py-1.5 rounded-full bg-lime-300/10 border border-lime-300/30 text-lime-300 text-xs font-medium flex items-center gap-2"
            >
              <span>{filter.label}</span>
              <button
                onClick={() => handleRemoveFilter(filter.id)}
                className="hover:bg-lime-300/20 rounded-full p-0.5 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              setActiveFilters([]);
              setPage(1);
            }}
            className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium hover:bg-red-500/20 transition-colors"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Pagination bar with summary chips */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between flex-shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-[#bdbdbd]">
            {total > 0 ? (
              <>
                Showing <span className="text-white">{pageStart}</span>–
                <span className="text-white">{pageEnd}</span> of{' '}
                <span className="text-white">{total}</span>
                {activeFilters.length > 0 && (
                  <>
                    {' '}
                    <span className="text-[#a0a0a0]">(filtered)</span>
                  </>
                )}
              </>
            ) : (
              <>Showing 0 results</>
            )}
          </div>
          
          <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5] text-xs flex items-center gap-2">
            <span>Total clients: <span className="font-semibold">{total}</span></span>
            <button
              onClick={() => {
                setIsFAQOpen(true);
              }}
              className="italic text-lime-400/70 hover:text-lime-400 transition-colors text-xs sm:text-[10px] px-1 py-0.5"
            >
              Info
            </button>
          </div>

          <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5] text-xs">
            Repeat clients (2+ visits) on this page:{' '}
            <span className="font-semibold">
              {displayClients.filter((c) => (c.total_appointments ?? 0) >= 2).length}
            </span>
          </div>
          <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5] text-xs">
            Heavy regulars (10+ visits) on this page:{' '}
            <span className="font-semibold">
              {displayClients.filter((c) => (c.total_appointments ?? 0) >= 10).length}
            </span>
          </div>
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

      {/* Table - Scrollable */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-white/10 bg-black/20 backdrop-blur-md">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#bdbdbd]">Loading clients…</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-300">{error}</div>
        ) : displayClients.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#bdbdbd]">
              {activeFilters.length > 0
                ? 'No clients match your current filters.'
                : 'No clients found.'}
            </p>
            {activeFilters.length > 0 && (
              <button
                onClick={() => {
                  setActiveFilters([]);
                  setPage(1);
                }}
                className="mt-3 text-xs text-lime-300 hover:text-lime-200 underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-[#121613] border-b border-white/10 text-[10px] sm:text-xs uppercase tracking-wide text-[#bdbdbd]">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">Name</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">Email</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">Phone</th>
                <th
                  className="px-2 sm:px-4 py-2 sm:py-3 text-left cursor-pointer select-none hover:text-lime-200"
                  onClick={() => handleSortClick('first_appt')}
                >
                  First Visit {sortIndicator('first_appt')}
                </th>
                <th
                  className="px-2 sm:px-4 py-2 sm:py-3 text-left cursor-pointer select-none hover:text-lime-200"
                  onClick={() => handleSortClick('last_appt')}
                >
                  Last Visit {sortIndicator('last_appt')}
                </th>
                <th
                  className="px-2 sm:px-4 py-2 sm:py-3 text-left cursor-pointer select-none hover:text-lime-200"
                  onClick={() => handleSortClick('total_appointments')}
                >
                  Total Visits {sortIndicator('total_appointments')}
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">Visiting Type</th>
                <th
                  className="px-2 sm:px-4 py-2 sm:py-3 text-left cursor-pointer select-none hover:text-lime-200"
                  onClick={() => handleSortClick('date_last_sms_sent')}
                >
                  Last SMS Sent {sortIndicator('date_last_sms_sent')}
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left">SMS Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {displayClients.map((c) => {
                const fullName =
                  `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unknown';

                const lastVisit = formatDate(c.last_appt);
                const firstVisit = formatDate(c.first_appt);
                const lastSmsSent = formatDateTime(c.date_last_sms_sent);

                return (
                  <tr
                    key={c.client_id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-white">
                      <div className="font-medium text-xs sm:text-sm">{fullName}</div>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-[#d4d4d4]">
                      <div className="text-[10px] sm:text-[11px]">{c.email || '—'}</div>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-[#d4d4d4]">
                      <div className="text-[11px] sm:text-[12px]">{c.phone || '—'}</div>
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-[#d4d4d4] text-xs sm:text-sm">{firstVisit}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-[#d4d4d4] text-xs sm:text-sm">{lastVisit}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-[#d4d4d4] text-xs sm:text-sm">
                      {(c.total_appointments ?? 0).toString()}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-[#d4d4d4] text-xs sm:text-sm">
                      {c.visiting_type ? (
                        <span className="capitalize">{c.visiting_type.replace('-', ' ')}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-[#d4d4d4] text-xs sm:text-sm">{lastSmsSent}</td>
                    <td className="px-2 sm:px-4 py-2 sm:py-3 text-[#d4d4d4] text-xs sm:text-sm">
                      {c.sms_subscribed ? (
                        <span className="text-lime-300">Yes</span>
                      ) : (
                        <span className="text-red-300">No</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* FAQ Modal - Renders to document.body via portal */}
      <FAQModal 
        isOpen={isFAQOpen} 
        onClose={() => {
          setIsFAQOpen(false);
        }}
        initialSearchQuery="Why are my Client Sheets total clients way bigger than my SMS clients"
      />
    </div>
  );
}