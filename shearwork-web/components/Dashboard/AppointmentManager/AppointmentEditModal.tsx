'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

type Props = {
  isOpen: boolean;
  appointment: AppointmentRow | null;
  onClose: () => void;
  onUpdate: (appointmentId: string, updates: { tip?: number; revenue?: number }) => void;
};

export default function AppointmentEditModal({
  isOpen,
  appointment,
  onClose,
  onUpdate,
}: Props) {
  const [tip, setTip] = useState('');
  const [revenue, setRevenue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state when modal opens with new appointment
  useEffect(() => {
    if (appointment) {
      setTip(appointment.tip?.toString() || '0');
      setRevenue(appointment.revenue?.toString() || '0');
      setError(null);
      setSuccess(false);
    }
  }, [appointment]);

  const handleSave = async () => {
    if (!appointment) return;

    const tipValue = parseFloat(tip);
    const revenueValue = parseFloat(revenue);

    if (isNaN(tipValue) || tipValue < 0) {
      setError('Please enter a valid tip amount (0 or greater)');
      return;
    }

    if (isNaN(revenueValue) || revenueValue < 0) {
      setError('Please enter a valid revenue amount (0 or greater)');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/appointment-manager/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: appointment.id,
          tip: tipValue,
          revenue: revenueValue,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error || 'Failed to update appointment');
      }

      setSuccess(true);
      onUpdate(appointment.id, { tip: tipValue, revenue: revenueValue });

      // Close modal after a brief success indication
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (d: string | null | undefined) => {
    if (!d) return '—';
    const dateObj = new Date(d);
    if (Number.isNaN(dateObj.getTime())) return '—';
    return dateObj.toLocaleString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const clientName =
    `${appointment?.client_first_name || ''} ${appointment?.client_last_name || ''}`.trim() ||
    'Unknown Client';

  return (
    <AnimatePresence>
      {isOpen && appointment && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-md bg-gradient-to-br from-[#1a1f1b] to-[#252b26] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 bg-black/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    Edit Appointment
                  </h3>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-white/10 transition text-[#bdbdbd] hover:text-white"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-4">
                {/* Appointment Details */}
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs text-[#a0a0a0] uppercase tracking-wide">
                      Client
                    </span>
                    <span className="text-sm text-white font-medium text-right">
                      {clientName}
                    </span>
                  </div>

                  <div className="flex justify-between items-start">
                    <span className="text-xs text-[#a0a0a0] uppercase tracking-wide">
                      Date & Time
                    </span>
                    <span className="text-sm text-[#d4d4d4] text-right">
                      {formatDateTime(appointment.datetime)}
                    </span>
                  </div>

                  {appointment.phone_normalized && (
                    <div className="flex justify-between items-start">
                      <span className="text-xs text-[#a0a0a0] uppercase tracking-wide">
                        Phone
                      </span>
                      <span className="text-sm text-[#d4d4d4] text-right">
                        {appointment.phone_normalized}
                      </span>
                    </div>
                  )}

                  {appointment.service_type && (
                    <div className="flex justify-between items-start">
                      <span className="text-xs text-[#a0a0a0] uppercase tracking-wide">
                        Service
                      </span>
                      <span className="text-sm text-[#d4d4d4] text-right">
                        {appointment.service_type}
                      </span>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-white/10" />

                {/* Revenue Input */}
                <div className="space-y-2">
                  <label className="block text-xs text-[#a0a0a0] uppercase tracking-wide">
                    Revenue
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-300 font-medium">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={revenue}
                      onChange={(e) => setRevenue(e.target.value)}
                      disabled={saving}
                      className="w-full pl-7 pr-4 py-3 rounded-lg bg-black/30 border border-white/15 text-white text-lg font-medium placeholder:text-[#555] focus:outline-none focus:ring-2 focus:ring-green-300/70 disabled:opacity-50"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Tip Input */}
                <div className="space-y-2">
                  <label className="block text-xs text-[#a0a0a0] uppercase tracking-wide">
                    Tip
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-300 font-medium">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tip}
                      onChange={(e) => setTip(e.target.value)}
                      disabled={saving}
                      className="w-full pl-7 pr-4 py-3 rounded-lg bg-black/30 border border-white/15 text-white text-lg font-medium placeholder:text-[#555] focus:outline-none focus:ring-2 focus:ring-amber-300/70 disabled:opacity-50"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Error/Success Messages */}
                {error && (
                  <div className="px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-sm flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Appointment updated successfully!
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/10 bg-black/20 flex justify-end gap-3">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[#bdbdbd] hover:text-white hover:bg-white/10 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || success}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
                    saving || success
                      ? 'bg-amber-300/50 text-black/50 cursor-not-allowed'
                      : 'bg-amber-300 text-black hover:bg-amber-200 shadow-lg hover:shadow-amber-300/30'
                  }`}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Saving...
                    </span>
                  ) : success ? (
                    'Saved!'
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}