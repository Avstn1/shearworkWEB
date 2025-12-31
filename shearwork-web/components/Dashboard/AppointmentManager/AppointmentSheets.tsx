'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { Calendar, ChevronDown } from 'lucide-react';
import AppointmentEditModal from './AppointmentEditModal';

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

  // Request sequencing
  const requestSeq = useRef(0);

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

      // Sort by datetime descending (latest first)
      const sortedAppointments = (body.appointments || []).sort((a, b) => {
        const dateA = new Date(a.datetime).getTime();
        const dateB = new Date(b.datetime).getTime();
        return dateB - dateA;
      });

      setAppointments(sortedAppointments);
    } catch (err: any) {
      if (seq !== requestSeq.current) return;
      console.error(err);
      setError(err.message || 'Something went wrong');
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
    <div className="flex flex-col gap-4 h-full">
      {/* Header with Date Picker */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-white">Daily Appointments</h2>
          <p className="text-xs text-[#bdbdbd]">
            Select a date to view appointments. Click any row to edit tips or revenue.
          </p>
        </div>

        {/* Date Navigation & Picker */}
        <div className="flex items-center gap-2">
          {/* Previous Day Button */}
          <button
            onClick={goToPreviousDay}
            className="p-2 rounded-lg bg-black/30 border border-white/10 text-white hover:bg-white/10 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Calendar Picker */}
          <div className="relative" ref={calendarRef}>
            <motion.button
              onClick={() => setIsCalendarOpen((prev) => !prev)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-white font-medium rounded-xl shadow-md hover:shadow-lg transition-all backdrop-blur-md text-sm"
            >
              <Calendar className="w-4 h-4 text-amber-300" />
              <span className="text-amber-100">
                {isToday ? 'Today' : formatDateShort(selectedDate)}
              </span>
              <ChevronDown className={`w-4 h-4 text-amber-300 transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`} />
            </motion.button>

            {/* Calendar Dropdown - Fixed positioning for mobile */}
            {isCalendarOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute left-0 sm:left-auto sm:right-0 mt-2 bg-[#1a1e18]/95 border border-white/10 rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-xl min-w-[340px]"
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
                      color: '#fcd34d',
                      fontWeight: 'bold',
                      background: 'rgba(251, 191, 36, 0.3)',
                      borderRadius: '9999px',
                    },
                  }}
                  className="
                    bg-transparent text-xs
                    [&_.rdp-day]:text-white [&_.rdp-day]:px-1 [&_.rdp-day]:py-1 [&_.rdp-day]:min-w-[2rem] [&_.rdp-day]:min-h-[2rem]
                    [&_.rdp-day--outside]:text-gray-500 [&_.rdp-day--outside]:opacity-50
                    [&_.rdp-day_today-custom]:!bg-amber-400/20 [&_.rdp-day_today-custom]:!text-amber-400 [&_.rdp-day_today-custom]:!font-bold [&_.rdp-day_today-custom]:!ring-2 [&_.rdp-day_today-custom]:!ring-amber-400 [&_.rdp-day_today-custom]:!rounded-full
                    [&_.rdp-day--disabled]:!text-gray-800 [&_.rdp-day--disabled]:!bg-[#101210] [&_.rdp-day--disabled]:!cursor-not-allowed [&_.rdp-day--disabled]:!opacity-100
                    [&_.rdp-day--weekend]:text-white
                    [&_.rdp-caption]:text-white [&_.rdp-caption]:font-semibold
                    [&_.rdp-nav-button]:bg-transparent [&_.rdp-nav-button]:hover:bg-white/10 [&_.rdp-nav-button]:text-white [&_.rdp-nav-button]:p-1 [&_.rdp-nav-button]:rounded-full
                    [&_.rdp-nav-icon]:stroke-white
                    [&_.rdp-day:hover]:bg-white/10
                    [&_.rdp-head_cell]:min-w-[2rem] [&_.rdp-head_cell]:text-center
                    [&_.rdp-table]:w-full
                  "
                  style={{ ['--rdp-accent-color' as any]: '#f59e0b' }}
                />

                {/* Quick select buttons */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
                  <button
                    onClick={() => {
                      setSelectedDate(new Date());
                      setIsCalendarOpen(false);
                    }}
                    className="flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 transition text-center"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      setSelectedDate(yesterday);
                      setIsCalendarOpen(false);
                    }}
                    className="flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-white/10 text-white hover:bg-white/20 transition text-center"
                  >
                    Yesterday
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Next Day Button */}
          <button
            onClick={goToNextDay}
            disabled={!canGoNext()}
            className={`p-2 rounded-lg border transition ${
              canGoNext()
                ? 'bg-black/30 border-white/10 text-white hover:bg-white/10'
                : 'bg-black/10 border-white/5 text-white/30 cursor-not-allowed'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Date Display & Summary */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="text-sm text-white font-medium flex items-center gap-2">
          <span className="text-amber-200">{formatDateDisplay(selectedDate)}</span>
          {isToday && (
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              TODAY
            </span>
          )}
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="px-3 py-2 rounded-full bg-black/30 border border-white/10 text-[#e5e5e5]">
            Appointments: <span className="font-semibold text-white">{dayTotals.count}</span>
          </div>
          <div className="px-3 py-2 rounded-full bg-black/30 border border-green-500/20 text-[#e5e5e5]">
            Revenue:{' '}
            <span className="font-semibold text-green-300">{formatCurrency(dayTotals.revenueTotal)}</span>
          </div>
          <div className="px-3 py-2 rounded-full bg-black/30 border border-amber-500/20 text-[#e5e5e5]">
            Tips:{' '}
            <span className="font-semibold text-amber-300">{formatCurrency(dayTotals.tipTotal)}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border border-white/10 bg-black/20 backdrop-blur-md">
        {loading ? (
          <div className="py-16 text-center text-sm text-[#bdbdbd]">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-amber-300 mb-2"></div>
            <p>Loading appointments…</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-300">{error}</div>
        ) : appointments.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">📅</div>
            <p className="text-sm text-[#bdbdbd]">
              No appointments found for {formatDateDisplay(selectedDate)}.
            </p>
            <p className="text-xs text-[#777] mt-1">
              Try selecting a different date.
            </p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-[#121613] border-b border-white/10 text-xs uppercase tracking-wide text-[#bdbdbd]">
              <tr>
                <th className="px-4 py-3 text-left w-16">#</th>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Service</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Tip</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((appt, index) => {
                const rowNumber = appointments.length - index;
                const clientName = [appt.client_first_name, appt.client_last_name]
                  .filter(Boolean)
                  .join(' ') || 'Unknown';

                return (
                  <tr
                    key={appt.id}
                    onClick={() => handleRowClick(appt)}
                    className="border-b border-white/5 hover:bg-amber-500/10 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3 text-[#666] font-mono text-xs">
                      #{rowNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">{formatTime(appt.datetime)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{clientName}</div>
                      {/* Show service on mobile under client name */}
                      {appt.service_type && (
                        <div className="text-[11px] text-[#888] sm:hidden">{appt.service_type}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0] hidden sm:table-cell">
                      {appt.service_type || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-green-300 font-medium">{formatCurrency(appt.revenue)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${appt.tip && appt.tip > 0 ? 'text-amber-300' : 'text-[#555]'}`}>
                        {formatCurrency(appt.tip)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer with Totals */}
            <tfoot className="bg-[#121613] border-t border-white/10">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-xs text-[#888] uppercase tracking-wide hidden sm:table-cell">
                  Day Totals
                </td>
                <td colSpan={3} className="px-4 py-3 text-right text-xs text-[#888] uppercase tracking-wide sm:hidden">
                  Totals
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-green-300 font-semibold">{formatCurrency(dayTotals.revenueTotal)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-amber-300 font-semibold">{formatCurrency(dayTotals.tipTotal)}</span>
                </td>
              </tr>
            </tfoot>
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