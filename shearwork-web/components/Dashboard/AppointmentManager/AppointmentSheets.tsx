'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { Calendar, CalendarX, ChevronDown, ChevronLeft, ChevronRight, Loader2, AlertCircle, CalendarDays } from 'lucide-react';
import { PageHeader, EmptyState } from '@/components/ui/AppKit';
import AppointmentEditModal from './AppointmentEditModal';
import { supabase } from '@/utils/supabaseClient';

type AppointmentRow = {
  id: string;
  acuity_appointment_id: string | null;
  client_id: string | null;
  phone_normalized: string | null;
  appointment_date: string;
  datetime: string;
  revenue: number | null;
  tip: number | null;
  service_type: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
};

type ApiResponse = {
  appointments: AppointmentRow[];
  total: number;
};

export default function AppointmentSheets() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date picker state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [session, setSession] = useState<any>(null);

  // Request sequencing
  const requestSeq = useRef(0);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        console.error('Error fetching session:', sessionError);
        return;
      }
      setSession(session);
    };

    getSession()
  }, [])

  useEffect(() => {
    if (session == null) return;

    const addToLogs = async () => {
      const userId = session.user.id
      const { data: userData } = await supabase.from('profiles').select('role, full_name').eq('user_id', userId).single();

      if (userData?.role != 'Admin') {
        const { error: insertError } = await supabase
        .from('system_logs')
        .insert({
          source: `${userData?.full_name}: ${userId}`,
          action: 'clicked_appointmentSheets',
          status: 'success',
          details: `Opened navigation link: Appointment Sheets`,
        })

        if (insertError) throw insertError
      }
    }

    addToLogs()
  }, [session])

  // Format date to YYYY-MM-DD
  const formatDateToISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date for display
  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Short format for button
  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const selectedDateStr = formatDateToISO(selectedDate);

  const calendarStyle: CSSProperties & { ['--rdp-accent-color']?: string } = {
    '--rdp-accent-color': '#3DD27A',
  };

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAppointments = async (dateStr: string) => {
    const seq = ++requestSeq.current;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('date', dateStr);

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

      // Sort by datetime ascending (earliest first)
      const sortedAppointments = (body.appointments || []).sort((a, b) => {
        const dateA = new Date(a.datetime).getTime();
        const dateB = new Date(b.datetime).getTime();
        return dateA - dateB;
      });

      setAppointments(sortedAppointments);
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

  // Fetch when date changes
  useEffect(() => {
    fetchAppointments(selectedDateStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateStr]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setIsCalendarOpen(false);
    }
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

  const formatTime = (d: string | null | undefined) => {
    if (!d) return '—';
    const dateObj = new Date(d);
    if (Number.isNaN(dateObj.getTime())) return '—';
    return dateObj.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '—';
    return `$${value.toFixed(2)}`;
  };

  // Calculate totals for the day
  const dayTotals = useMemo(() => {
    const revenueTotal = appointments.reduce((sum, appt) => sum + (appt.revenue || 0), 0);
    const tipTotal = appointments.reduce((sum, appt) => sum + (appt.tip || 0), 0);
    return { revenueTotal, tipTotal, count: appointments.length };
  }, [appointments]);

  // Check if selected date is today
  const isToday = formatDateToISO(selectedDate) === formatDateToISO(new Date());

  // Navigate to previous/next day
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
  };

  const canGoNext = () => {
    const tomorrow = new Date(selectedDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow <= new Date();
  };

  return (
    <div className="flex flex-col">
      <PageHeader icon={CalendarDays} tone="sand"
        title="Appointment Manager"
        subtitle="View daily appointments, manage tips, and track revenue"
        actions={
          <div className="flex items-center gap-2">
            {/* Previous Day Button */}
            <button
              type="button"
              onClick={goToPreviousDay}
              aria-label="Previous day"
              className="btn btn-glass btn-sm !px-2.5"
            >
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>

            {/* Calendar Picker */}
            <div className="relative" ref={calendarRef}>
              <button
                type="button"
                onClick={() => setIsCalendarOpen((prev) => !prev)}
                aria-expanded={isCalendarOpen}
                className="btn btn-glass btn-sm min-w-[9.5rem]"
              >
                <Calendar size={16} strokeWidth={1.75} className="text-muted" />
                <span className="tabular-nums">
                  {isToday ? 'Today' : formatDateShort(selectedDate)}
                </span>
                <ChevronDown size={16} strokeWidth={1.75} className={`text-muted transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Calendar Dropdown */}
              {isCalendarOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="modal-surface absolute right-0 z-50 mt-2 min-w-[320px] p-4"
                >
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    disabled={{ after: new Date(new Date().setHours(23, 59, 59, 999)) }}
                    weekStartsOn={1}
                    showOutsideDays
                    modifiersClassNames={{
                      today: 'rdp-day_today-custom',
                    }}
                    modifiersStyles={{
                      selected: {
                        color: '#0D1014',
                        fontWeight: 600,
                        background: '#3DD27A',
                        borderRadius: '6px',
                      },
                    }}
                    className="
                      bg-transparent text-xs
                      [&_.rdp-day]:text-gray-200 [&_.rdp-day]:px-1 [&_.rdp-day]:py-1 [&_.rdp-day]:min-w-[2rem] [&_.rdp-day]:min-h-[2rem] [&_.rdp-day]:rounded-md
                      [&_.rdp-day--outside]:text-gray-500 [&_.rdp-day--outside]:opacity-50
                      [&_.rdp-day_today-custom]:!text-sage-bright [&_.rdp-day_today-custom]:!font-semibold [&_.rdp-day_today-custom]:!ring-1 [&_.rdp-day_today-custom]:!ring-sage/60 [&_.rdp-day_today-custom]:!rounded-md
                      [&_.rdp-day--disabled]:!text-gray-600 [&_.rdp-day--disabled]:!cursor-not-allowed [&_.rdp-day--disabled]:!opacity-60
                      [&_.rdp-day--weekend]:text-gray-200
                      [&_.rdp-caption]:text-ivory [&_.rdp-caption]:font-semibold
                      [&_.rdp-nav-button]:bg-transparent [&_.rdp-nav-button]:hover:bg-white/[0.06] [&_.rdp-nav-button]:text-ivory [&_.rdp-nav-button]:p-1 [&_.rdp-nav-button]:rounded-md
                      [&_.rdp-nav-icon]:stroke-ivory
                      [&_.rdp-day:hover]:bg-white/[0.06]
                      [&_.rdp-head_cell]:min-w-[2rem] [&_.rdp-head_cell]:text-center
                      [&_.rdp-table]:w-full
                    "
                    style={calendarStyle}
                  />

                  {/* Quick select buttons */}
                  <div className="mt-3 flex gap-2 border-t border-white/[0.07] pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(new Date());
                        setIsCalendarOpen(false);
                      }}
                      className="btn btn-glass btn-sm flex-1 !h-8 !text-xs"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setSelectedDate(yesterday);
                        setIsCalendarOpen(false);
                      }}
                      className="btn btn-ghost btn-sm flex-1 !h-8 !text-xs"
                    >
                      Yesterday
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Next Day Button */}
            <button
              type="button"
              onClick={goToNextDay}
              disabled={!canGoNext()}
              aria-label="Next day"
              className="btn btn-glass btn-sm !px-2.5"
            >
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="panel mb-4 grid grid-cols-3 divide-x divide-white/[0.07]">
        <div className="px-4 py-3">
          <p className="stat-label">Appointments</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-ivory">{dayTotals.count}</p>
        </div>
        <div className="px-4 py-3">
          <p className="stat-label">Revenue</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-ivory">{formatCurrency(dayTotals.revenueTotal)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="stat-label">Tips</p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums text-ivory">{formatCurrency(dayTotals.tipTotal)}</p>
        </div>
      </div>

      {/* Table panel */}
      <section className="panel flex flex-col overflow-hidden">
        <header className="panel-header">
          <div className="min-w-0">
            <h2 className="panel-title flex flex-wrap items-center gap-2">
              {formatDateDisplay(selectedDate)}
              {isToday && <span className="badge badge-sage">Today</span>}
            </h2>
            <p className="panel-subtitle">Click any row to edit tips or revenue.</p>
          </div>
        </header>

        <div className="overflow-auto" style={{ maxHeight: 'calc(100dvh - var(--navbar-height, 72px) - 18rem)', minHeight: 240 }}>
          {loading ? (
            <div className="empty-state">
              <Loader2 className="animate-spin" aria-hidden="true" />
              <p>Loading appointments…</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <AlertCircle aria-hidden="true" />
              <p className="text-[#FF8F7D]">{error}</p>
            </div>
          ) : appointments.length === 0 ? (
            <EmptyState icon={CalendarX} title={`No appointments found for ${formatDateDisplay(selectedDate)}.`}>
              Try selecting a different date. Note: Only appointments that have passed their date and time will appear here.
            </EmptyState>
          ) : (
            <table className="table-clean min-w-full">
              <thead>
                <tr>
                  <th className="w-16">#</th>
                  <th>Time</th>
                  <th>Client</th>
                  <th className="hidden sm:table-cell">Service</th>
                  <th className="!text-right">Revenue</th>
                  <th className="!text-right">Tip</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt, index) => {
                  const rowNumber = index + 1;
                  const clientName = [appt.client_first_name, appt.client_last_name]
                    .filter(Boolean)
                    .join(' ') || 'Unknown';

                  return (
                    <tr
                      key={appt.id}
                      onClick={() => handleRowClick(appt)}
                      className="cursor-pointer"
                    >
                      <td className="text-xs tabular-nums !text-gray-500">
                        {rowNumber}
                      </td>
                      <td className="whitespace-nowrap font-medium tabular-nums !text-ivory">
                        {formatTime(appt.datetime)}
                      </td>
                      <td>
                        <div className="font-medium text-ivory">{clientName}</div>
                        {/* Show service on mobile under client name */}
                        {appt.service_type && (
                          <div className="text-xs text-gray-500 sm:hidden">{appt.service_type}</div>
                        )}
                      </td>
                      <td className="hidden !text-muted sm:table-cell">
                        {appt.service_type || '—'}
                      </td>
                      <td className="text-right font-medium tabular-nums !text-ivory">
                        {formatCurrency(appt.revenue)}
                      </td>
                      <td className={`text-right tabular-nums ${appt.tip && appt.tip > 0 ? 'font-medium !text-sage-bright' : '!text-gray-500'}`}>
                        {formatCurrency(appt.tip)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Table Footer with Totals */}
              <tfoot>
                <tr className="border-t border-white/[0.07] bg-raised">
                  <td colSpan={4} className="hidden px-[0.875rem] py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted sm:table-cell">
                    Day Totals
                  </td>
                  <td colSpan={3} className="px-[0.875rem] py-3 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted sm:hidden">
                    Totals
                  </td>
                  <td className="px-[0.875rem] py-3 text-right font-semibold tabular-nums text-ivory">
                    {formatCurrency(dayTotals.revenueTotal)}
                  </td>
                  <td className="px-[0.875rem] py-3 text-right font-semibold tabular-nums text-sage-bright">
                    {formatCurrency(dayTotals.tipTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>

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
