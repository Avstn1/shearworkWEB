import { motion } from 'framer-motion';
import { Calendar, Clock, FileText, Zap } from 'lucide-react';
import { SMSMessage, DAYS_OF_WEEK, DAYS_OF_MONTH, HOURS_12, MINUTES, PERIODS } from './types';

interface MessageScheduleProps {
  message: SMSMessage;
  isSaving: boolean;
  savingMode: 'draft' | 'activate' | null;
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onSave: (msgId: string, mode: 'draft' | 'activate') => void;
  onCancelEdit: (id: string) => void;
}

// Right side of the MessageCard
export function MessageSchedule({
  message: msg,
  isSaving,
  savingMode,
  onUpdate,
  onSave,
  onCancelEdit,
}: MessageScheduleProps) {
  return (
    <div className="space-y-4">
      {/* Frequency */}
      <div>
        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
          <Calendar className="w-3 h-3 inline mr-1" />
          Frequency
        </label>
        <select
          value={msg.frequency}
          onChange={(e) =>
            onUpdate(msg.id, {
              frequency: e.target.value as SMSMessage['frequency'],
            })
          }
          disabled={!msg.isEditing}
          className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
            !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
          }`}
        >
          <option value="weekly" className="bg-[#1a1a1a]">
            Weekly
          </option>
          <option value="biweekly" className="bg-[#1a1a1a]">
            Bi-weekly
          </option>
          <option value="monthly" className="bg-[#1a1a1a]">
            Monthly
          </option>
        </select>
      </div>

      {/* Day Selection */}
      <div>
        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
          {msg.frequency === 'monthly' ? 'Day of Month' : 'Day of Week'}
        </label>
        {msg.frequency === 'monthly' ? (
          <select
            value={msg.dayOfMonth || 1}
            onChange={(e) =>
              onUpdate(msg.id, {
                dayOfMonth: parseInt(e.target.value),
              })
            }
            disabled={!msg.isEditing}
            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
            }`}
          >
            {DAYS_OF_MONTH.map((day) => (
              <option
                key={day.value}
                value={day.value}
                className="bg-[#1a1a1a]"
              >
                {day.label}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={msg.dayOfWeek}
            onChange={(e) =>
              onUpdate(msg.id, { dayOfWeek: e.target.value })
            }
            disabled={!msg.isEditing}
            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
            }`}
          >
            {DAYS_OF_WEEK.map((day) => (
              <option
                key={day.value}
                value={day.value}
                className="bg-[#1a1a1a]"
              >
                {day.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Time - 12hr format with AM/PM */}
      <div>
        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
          <Clock className="w-3 h-3 inline mr-1" />
          Time
        </label>
        <div className="grid grid-cols-3 gap-2">
          {/* Hour */}
          <select
            value={msg.hour === 0 ? 12 : msg.hour > 12 ? msg.hour - 12 : msg.hour}
            onChange={(e) => {
              const newHour = parseInt(e.target.value);
              onUpdate(msg.id, { hour: newHour });
            }}
            disabled={!msg.isEditing}
            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
            }`}
          >
            {HOURS_12.map((hour) => (
              <option
                key={hour.value}
                value={hour.value}
                className="bg-[#1a1a1a]"
              >
                {hour.label}
              </option>
            ))}
          </select>

          {/* Minute */}
          <select
            value={msg.minute}
            onChange={(e) =>
              onUpdate(msg.id, {
                minute: parseInt(e.target.value),
              })
            }
            disabled={!msg.isEditing}
            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
            }`}
          >
            {MINUTES.map((minute) => (
              <option
                key={minute.value}
                value={minute.value}
                className="bg-[#1a1a1a]"
              >
                {minute.label}
              </option>
            ))}
          </select>

          {/* AM/PM */}
          <select
            value={msg.period}
            onChange={(e) =>
              onUpdate(msg.id, {
                period: e.target.value as 'AM' | 'PM',
              })
            }
            disabled={!msg.isEditing}
            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
            }`}
          >
            {PERIODS.map((period) => (
              <option
                key={period.value}
                value={period.value}
                className="bg-[#1a1a1a]"
              >
                {period.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      {msg.isEditing ? (
        <div className="space-y-2">
          {/* Two Choice Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {/* Save as Draft */}
            <button
              onClick={() => onSave(msg.id, 'draft')}
              disabled={isSaving || msg.message.length < 100}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-300 ${
                isSaving || msg.message.length < 100
                  ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                  : 'bg-amber-300/20 text-amber-300 border border-amber-300/30 hover:bg-amber-300/30'
              }`}
            >
              {isSaving && savingMode === 'draft' ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Clock className="w-5 h-5" />
                  </motion.div>
                  Saving...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Save Draft
                </>
              )}
            </button>

            {/* Activate Schedule */}
            <button
              onClick={() => onSave(msg.id, 'activate')}
              disabled={
                isSaving ||
                msg.message.length < 100 ||
                !msg.isValidated  // ← REMOVED the validationStatus check
              }
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-300 ${
                isSaving ||
                msg.message.length < 100 ||
                !msg.isValidated
                  ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-sky-300 to-lime-300 text-black hover:shadow-[0_0_20px_rgba(125,211,252,0.6)]'
              }`}
            >
              {isSaving && savingMode === 'activate' ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Clock className="w-5 h-5" />
                  </motion.div>
                  Activating...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Activate
                </>
              )}
            </button>
          </div>

          {/* Cancel Button */}
          {msg.isSaved && (
            <button
              onClick={() => onCancelEdit(msg.id)}
              className="w-full px-6 py-3 rounded-xl font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
            >
              Cancel
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}