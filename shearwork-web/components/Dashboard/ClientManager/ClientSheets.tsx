'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Filter, X, ChevronDown, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Info, Loader2, AlertCircle, Users } from 'lucide-react';
import ClientSheetsFilterDropdown, {
  ActiveFilter,
  FilterType,
} from '@/components/Dashboard/ClientManager/ClientSheetsFilterModal';
import FAQModal from '@/components/Dashboard/ClientManager/FAQModal';

import { useAuth } from '@/contexts/AuthContext'

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

  const [dataSource, setDataSource] = useState<'acuity' | 'square'>('acuity')

  const requestSeq = useRef(0);
  const statsCache = useRef<{ minYear?: number; timestamp?: number }>({});

  const { user, profile, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!user?.id) return

    const checkDataSource = async () => {
      const { data: squareToken } = await supabase
        .from('square_tokens')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      const useSquare = Boolean(squareToken?.user_id)
      setDataSource(useSquare ? 'square' : 'acuity')

      const sourceKey = useSquare ? 'square' : 'acuity'
      const cacheKey = `client_stats_${user.id}_${sourceKey}`
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
          .eq('user_id', user.id)
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
        .eq('user_id', user.id)
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
    }

    checkDataSource()
  }, [user])

  useEffect(() => {
    if (!user?.id) return

    const addToLogs = async () => {
      if (profile?.role != 'Admin') {
        const { error: insertError } = await supabase
        .from('system_logs')
        .insert({
          source: `${profile?.full_name}: ${user.id}`,
          action: 'clicked_clientSheets',
          status: 'success',
          details: `Opened navigation link: Client Sheets`,
        })

        if (insertError) throw insertError
      }
    }

    addToLogs()
  }, [user, profile])

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

      const mapped = (data || []).map((row) => {
        const record = row as ClientRow & { customer_id?: string | null; client_id?: string | null };
        const derivedId = record.client_id ?? record.customer_id ?? record[clientIdField as keyof typeof record];
        return {
          ...record,
          client_id: typeof derivedId === 'string' ? derivedId : record.client_id ?? '',
        };
      });

      setClients(mapped);
      setTotal(count || 0);
      setTotalPages(Math.max(1, Math.ceil((count || 0) / limit)));
    } catch (err: unknown) {
      if (seq !== requestSeq.current) return;
      console.error(err);
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      if (seq !== requestSeq.current) return;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) return;  // Don't call fetchClients at all if no user
    
    fetchClients();
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
    sortField === field ? (
      sortDir === 'asc' ? (
        <ArrowUp size={12} strokeWidth={2} className="inline-block align-[-1px]" aria-hidden="true" />
      ) : (
        <ArrowDown size={12} strokeWidth={2} className="inline-block align-[-1px]" aria-hidden="true" />
      )
    ) : null;

  const sortableTh = 'cursor-pointer select-none transition-colors hover:!text-ivory';

  const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const pageEnd = Math.min(page * limit, total);

  const repeatOnPage = displayClients.filter((c) => (c.total_appointments ?? 0) >= 2).length;
  const regularsOnPage = displayClients.filter((c) => (c.total_appointments ?? 0) >= 10).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <div className="panel grid grid-cols-1 divide-y divide-white/[0.07] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:block">
          <p className="stat-label flex items-center gap-2">
            Total clients
            <button
              type="button"
              onClick={() => {
                setIsFAQOpen(true);
              }}
              className="inline-flex items-center gap-1 normal-case tracking-normal text-[11px] font-medium text-sage transition-colors hover:text-sage-bright"
              aria-label="Why is this number different from my SMS clients?"
            >
              <Info size={12} strokeWidth={1.75} />
              Info
            </button>
          </p>
          <p className="text-xl font-semibold tabular-nums text-ivory sm:mt-1.5">{total.toLocaleString()}</p>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:block">
          <p className="stat-label">Repeat clients on page</p>
          <p className="text-xl font-semibold tabular-nums text-ivory sm:mt-1.5">
            {repeatOnPage}
            <span className="ml-1.5 text-xs font-normal text-gray-500">2+ visits</span>
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:block">
          <p className="stat-label">Heavy regulars on page</p>
          <p className="text-xl font-semibold tabular-nums text-ivory sm:mt-1.5">
            {regularsOnPage}
            <span className="ml-1.5 text-xs font-normal text-gray-500">10+ visits</span>
          </p>
        </div>
      </div>

      {/* Table panel */}
      <section className="panel flex flex-col" style={{ maxHeight: 'calc(100dvh - var(--navbar-height, 72px) - 2rem)' }}>
        <header className="panel-header flex-wrap">
          <div className="min-w-0">
            <h2 className="panel-title">Client sheets</h2>
            <p className="panel-subtitle">
              {total > 0 ? (
                <>
                  Showing <span className="tabular-nums text-gray-200">{pageStart}–{pageEnd}</span> of{' '}
                  <span className="tabular-nums text-gray-200">{total.toLocaleString()}</span>
                  {activeFilters.length > 0 && <span className="text-gray-500"> (filtered)</span>}
                </>
              ) : (
                <>Showing 0 results</>
              )}
            </p>
          </div>

          <div className="relative">
            <button
              type="button"
              data-filter-toggle
              onClick={() => setIsFilterModalOpen(!isFilterModalOpen)}
              aria-expanded={isFilterModalOpen}
              className="btn btn-glass btn-sm"
            >
              <Filter size={16} strokeWidth={1.75} />
              Add Filter
              <ChevronDown size={16} strokeWidth={1.75} className={`transition-transform ${isFilterModalOpen ? 'rotate-180' : ''}`} />
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
        </header>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.07] px-5 py-3">
            {activeFilters.map((filter) => (
              <span
                key={filter.id}
                className="badge badge-sage !py-1 !pl-2 !pr-1 !text-xs !font-medium"
              >
                <span>{filter.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveFilter(filter.id)}
                  aria-label={`Remove filter ${filter.label}`}
                  className="rounded p-0.5 transition-colors hover:bg-white/10"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                setActiveFilters([]);
                setPage(1);
              }}
              className="ml-1 text-xs font-medium text-muted transition-colors hover:text-[#FF8F7D]"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Table - Scrollable */}
        <div className="min-h-[240px] flex-1 overflow-auto">
          {loading ? (
            <div className="empty-state">
              <Loader2 className="animate-spin" aria-hidden="true" />
              <p>Loading clients. Please refresh the site</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <AlertCircle aria-hidden="true" />
              <p className="text-[#FF8F7D]">{error}</p>
            </div>
          ) : displayClients.length === 0 ? (
            <div className="empty-state">
              <Users aria-hidden="true" />
              <strong>
                {activeFilters.length > 0
                  ? 'No clients match your current filters.'
                  : 'No clients found.'}
              </strong>
              {activeFilters.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilters([]);
                    setPage(1);
                  }}
                  className="btn btn-glass btn-sm mt-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <table className="table-clean min-w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th className={sortableTh} onClick={() => handleSortClick('first_appt')}>
                    First Visit {sortIndicator('first_appt')}
                  </th>
                  <th className={sortableTh} onClick={() => handleSortClick('last_appt')}>
                    Last Visit {sortIndicator('last_appt')}
                  </th>
                  <th className={sortableTh} onClick={() => handleSortClick('total_appointments')}>
                    Total Visits {sortIndicator('total_appointments')}
                  </th>
                  <th>Visiting Type</th>
                  <th className={sortableTh} onClick={() => handleSortClick('date_last_sms_sent')}>
                    Last SMS Sent {sortIndicator('date_last_sms_sent')}
                  </th>
                  <th>SMS Subscribed</th>
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
                    <tr key={c.client_id}>
                      <td className="whitespace-nowrap font-medium !text-ivory">{fullName}</td>
                      <td className="text-[13px] !text-muted">{c.email || '—'}</td>
                      <td className="whitespace-nowrap text-[13px] tabular-nums">{c.phone || '—'}</td>
                      <td className="whitespace-nowrap tabular-nums">{firstVisit}</td>
                      <td className="whitespace-nowrap tabular-nums">{lastVisit}</td>
                      <td className="tabular-nums">{(c.total_appointments ?? 0).toString()}</td>
                      <td className="whitespace-nowrap">
                        {c.visiting_type ? (
                          <span className="capitalize">{c.visiting_type.replace('-', ' ')}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap tabular-nums">{lastSmsSent}</td>
                      <td>
                        {c.sms_subscribed ? (
                          <span className="badge badge-sage">Yes</span>
                        ) : (
                          <span className="badge badge-danger">No</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footer */}
        <footer className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-4 py-3 sm:px-5">
          <label className="flex items-center gap-2 text-xs text-muted">
            Rows
            <select
              value={limit}
              onChange={(e) => {
                const newLimit = parseInt(e.target.value, 10);
                setLimit(newLimit);
                setPage(1);
              }}
              className="field !h-8 !w-auto !px-2 !text-xs"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/page
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn btn-glass btn-sm !h-8 !px-2.5"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
              <span className="hidden sm:inline">Prev</span>
            </button>

            <span className="px-1 text-xs text-muted tabular-nums">
              Page <span className="font-semibold text-ivory">{page}</span> of{' '}
              <span className="font-semibold text-ivory">{totalPages}</span>
            </span>

            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="btn btn-glass btn-sm !h-8 !px-2.5"
              aria-label="Next page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>
        </footer>
      </section>

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
