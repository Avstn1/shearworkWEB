'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertCircle, Loader2 } from 'lucide-react';

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
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
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

  const detailLabel = 'text-xs text-muted';
  const detailValue = 'text-right text-sm text-gray-200';

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
            className="modal-backdrop"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="appointment-edit-title"
              className="modal-surface w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
                <h3 id="appointment-edit-title" className="text-[15px] font-semibold text-ivory">
                  Edit Appointment
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="btn btn-ghost btn-sm !px-2"
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </div>

              {/* Content */}
              <div className="space-y-5 px-5 py-5">
                {/* Appointment Details */}
                <dl className="space-y-2.5">
                  <div className="flex items-start justify-between gap-4">
                    <dt className={detailLabel}>Client</dt>
                    <dd className="text-right text-sm font-medium text-ivory">{clientName}</dd>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <dt className={detailLabel}>Date &amp; Time</dt>
                    <dd className={`${detailValue} tabular-nums`}>{formatDateTime(appointment.datetime)}</dd>
                  </div>

                  {appointment.phone_normalized && (
                    <div className="flex items-start justify-between gap-4">
                      <dt className={detailLabel}>Phone</dt>
                      <dd className={`${detailValue} tabular-nums`}>{appointment.phone_normalized}</dd>
                    </div>
                  )}

                  {appointment.service_type && (
                    <div className="flex items-start justify-between gap-4">
                      <dt className={detailLabel}>Service</dt>
                      <dd className={detailValue}>{appointment.service_type}</dd>
                    </div>
                  )}
                </dl>

                <hr className="divider" />

                <div className="grid grid-cols-2 gap-3">
                  {/* Revenue Input */}
                  <div>
                    <label htmlFor="appt-revenue" className="field-label">
                      Revenue
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        $
                      </span>
                      <input
                        id="appt-revenue"
                        type="number"
                        step="0.01"
                        min="0"
                        value={revenue}
                        onChange={(e) => setRevenue(e.target.value)}
                        disabled={saving}
                        className="field !pl-7 tabular-nums disabled:opacity-50"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Tip Input */}
                  <div>
                    <label htmlFor="appt-tip" className="field-label">
                      Tip
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                        $
                      </span>
                      <input
                        id="appt-tip"
                        type="number"
                        step="0.01"
                        min="0"
                        value={tip}
                        onChange={(e) => setTip(e.target.value)}
                        disabled={saving}
                        className="field !pl-7 tabular-nums disabled:opacity-50"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Error/Success Messages */}
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-[#FF8F7D]/25 bg-[#FF8F7D]/10 px-3 py-2 text-sm text-[#FF8F7D]">
                    <AlertCircle size={16} strokeWidth={1.75} className="shrink-0" />
                    {error}
                  </div>
                )}
                {success && (
                  <div className="flex items-center gap-2 rounded-lg border border-sage/25 bg-sage/10 px-3 py-2 text-sm text-sage-bright">
                    <Check size={16} strokeWidth={1.75} className="shrink-0" />
                    Appointment updated successfully!
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 border-t border-white/[0.07] px-5 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || success}
                  className="btn btn-primary btn-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} strokeWidth={1.75} className="animate-spin" />
                      Saving...
                    </>
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
