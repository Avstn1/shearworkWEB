// SMS Campaigns Message Schedule - Updated with 7-day scheduling limits

import { motion } from 'framer-motion';
import { Calendar, Clock, FileText, Zap, Users, Hash, Info, AlertCircle } from 'lucide-react';
import { SMSMessage, CAMPAIGN_TYPES } from './types';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// 15-minute intervals
const MINUTES_15 = [
  { value: 0, label: '00' },
  { value: 15, label: '15' },
  { value: 30, label: '30' },
  { value: 45, label: '45' },
];

const HOURS_12 = [
  { value: 0, label: '12' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7' },
  { value: 8, label: '8' },
  { value: 9, label: '9' },
  { value: 10, label: '10' },
  { value: 11, label: '11' },
];

const PERIODS = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

interface MessageScheduleProps {
  maxClients: number;
  message: SMSMessage;
  isSaving: boolean;
  savingMode: 'draft' | 'activate' | null;
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onSave: (msgId: string, mode: 'draft' | 'activate') => void;
  onCancelEdit: (id: string) => void;
  setAlgorithmType: (type: 'campaign' | 'mass') => void;
  previewCount?: number;
  availableCredits?: number; 
}

export function MessageSchedule({
  maxClients,
  setAlgorithmType,
  message: msg,
  isSaving,
  savingMode,
  onUpdate,
  onSave,
  onCancelEdit,
  previewCount = 0,
  availableCredits = 0, 
}: MessageScheduleProps) {

  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const getMaxLimit = () => {
    return Math.min(availableCredits, maxClients);
  };

  // Determine if current limit is a predefined value
  const isPredefinedLimit = () => {
    const predefinedLimits = [50, 100, 250, 500, 750, 1000, 1500, 2000];
    return predefinedLimits.includes(msg.clientLimit) || msg.clientLimit === getMaxLimit();
  };

  const [customLimit, setCustomLimit] = useState<string>(() => {
    // Initialize with current limit if it's not predefined
    return !isPredefinedLimit() ? msg.clientLimit.toString() : '';
  });
  
  const [showCustomInput, setShowCustomInput] = useState(() => !isPredefinedLimit());

  // Update when message changes (e.g., switching between messages)
  useEffect(() => {
    const isPredef = isPredefinedLimit();
    setShowCustomInput(!isPredef);
    if (!isPredef) {
      setCustomLimit(msg.clientLimit.toString());
    } else {
      setCustomLimit('');
    }
  }, [msg.id, msg.clientLimit]);

  const now = new Date();

  const maxDateTime = new Date(now);
  maxDateTime.setDate(now.getDate() + 7);

  const minDate = now.toLocaleDateString('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const maxDate = maxDateTime.toLocaleDateString('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Validate scheduled time is within 7 days
  const validateScheduledTime = (): boolean => {
    if (!msg.scheduleDate) return false;

    // Convert 12-hour to 24-hour
    let hour24 = msg.hour;
    if (msg.period === 'PM' && msg.hour !== 12) {
      hour24 = msg.hour + 12;
    } else if (msg.period === 'AM' && msg.hour === 12) {
      hour24 = 0;
    }

    // Create scheduled time in Toronto timezone
    const scheduledDateTime = new Date(`${msg.scheduleDate}T${hour24.toString().padStart(2, '0')}:${msg.minute.toString().padStart(2, '0')}:00-05:00`);

    // Get current time in Toronto timezone
    const nowInToronto = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' }));
    
    // Add 5 minute buffer and round to next 15-min interval
    const nowWithBuffer = new Date(nowInToronto);
    nowWithBuffer.setMinutes(nowWithBuffer.getMinutes() + 5);
    const minutes = nowWithBuffer.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    nowWithBuffer.setMinutes(roundedMinutes);
    nowWithBuffer.setSeconds(0, 0);

    const maxAllowedTime = new Date(nowInToronto);
    maxAllowedTime.setDate(maxAllowedTime.getDate() + 7);

    if (scheduledDateTime < nowWithBuffer) {
      toast.error('Please select a time at least 5 minutes from now (rounded to 15-minute intervals)');
      return false;
    }

    if (scheduledDateTime > maxAllowedTime) {
      toast.error('Please select a time within 7 days from now');
      return false;
    }

    return true;
  };

  const handleActivate = () => {
    if (!validateScheduledTime()) {
      return;
    }
    onSave(msg.id, 'activate');
  };
    
  // const getMaxLimit = () => {
  //   return Math.min(availableCredits, maxClients);
  // };

  const handleLimitChange = (value: number) => {
    const maxLimit = getMaxLimit();
    
    if (value === -1) {
      setShowCustomInput(true);
      const newLimit = customLimit && parseInt(customLimit) >= 100 ? parseInt(customLimit) : 100;
      setCustomLimit(newLimit.toString());
      onUpdate(msg.id, { clientLimit: Math.min(newLimit, maxLimit) });
    } else if (value === -2) {
      setShowCustomInput(false);
      setCustomLimit('');
      onUpdate(msg.id, { clientLimit: maxLimit });
    } else {
      setShowCustomInput(false);
      setCustomLimit('');
      onUpdate(msg.id, { clientLimit: value });
    }
  };

  const handleCustomLimitChange = (value: string) => {
    setCustomLimit(value);
    console.log("Custom limit changed to:" + value)
    const numValue = parseInt(value);
    const maxLimit = getMaxLimit();
    
    if (!isNaN(numValue) && numValue >= 0) {
      onUpdate(msg.id, { clientLimit: Math.min(numValue, maxLimit) });
    }
  };

  const handlepurposeChange = (type: 'mass' | 'campaign') => {
    const maxLimit = availableCredits;
    const newLimit = Math.min(msg.clientLimit, maxLimit);

    // Update parent state AND message purpose
    setAlgorithmType(type);
    
    onUpdate(msg.id, { 
      purpose: type,
      clientLimit: newLimit
    });
  };

  // Sync parent algorithmType with message purpose when message loads or changes
  useEffect(() => {
    if (msg.purpose && (msg.purpose === 'mass' || msg.purpose === 'campaign')) {
      console.log("Purpose: " + msg.purpose)
      setAlgorithmType(msg.purpose);
    }
  }, [msg.id, msg.purpose]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Campaign Type Selection */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-[#bdbdbd] mb-1.5 sm:mb-2">
          <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 inline mr-1" />
          Algorithm Type
        </label>
        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
          {CAMPAIGN_TYPES.map((type) => (
            <div key={type.value} className="relative group">
              <button
                type="button"
                onClick={() => handlepurposeChange(type.value)}
                disabled={!msg.isEditing}
                className={`w-full px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2 ${
                  msg.purpose === type.value
                    ? 'bg-sky-300/20 text-sky-300 border-2 border-sky-300/50 shadow-[0_0_12px_rgba(125,211,252,0.3)]'
                    : 'bg-white/5 text-[#bdbdbd] border-2 border-white/10 hover:border-white/20'
                } ${!msg.isEditing ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {type.label}
                <div className="relative">
                  <Info className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block z-10 pointer-events-none w-64 sm:w-72">
                    <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                      <p className="whitespace-normal break-words">{type.description}</p>
                      <div className="mt-1 text-amber-300 font-semibold">
                        Max: {availableCredits.toLocaleString()} credits (available credits)
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 -mb-1">
                        <div className="border-4 border-transparent border-b-[#0a0a0a]" />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Client Limit Selection */}
      <div>
        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
          <label className="block text-xs sm:text-sm font-medium text-[#bdbdbd]">
            <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 inline mr-1" />
            Maximum Number of Clients to Message.
          </label>
        </div>

        <select
          value={
            showCustomInput 
              ? -1 
              : msg.clientLimit === getMaxLimit() 
                ? -2 
                : msg.clientLimit
          }
          onChange={(e) => handleLimitChange(parseInt(e.target.value))}
          disabled={!msg.isEditing}
          className={`w-full bg-white/5 border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
            !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
          }`}
        >
          {[50, 100, 250, 500, 750, 1000, 1500, 2000].map((limit) => {
            const effectiveMax = Math.min(getMaxLimit(), maxClients);
            if (limit > effectiveMax) return null;
            
            return (
              <option key={limit} value={limit} className="bg-[#1a1a1a]">
                {limit.toLocaleString()} clients
              </option>
            );
          })}

          <option value={-2} className="bg-[#1a1a1a]">
            Max (
            {Math.min(getMaxLimit(), maxClients).toLocaleString()}{' '}
            {getMaxLimit() < maxClients ? 'credits' : 'clients'}
            )
          </option>

          <option value={-1} className="bg-[#1a1a1a]">
            Custom
          </option>
        </select>

        {showCustomInput && (
          <div className="mt-2">
            <div className="relative">
              <Hash className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#bdbdbd]" />
              <input
                type="number"
                min="0"
                max={getMaxLimit()}
                value={customLimit}
                onChange={(e) => handleCustomLimitChange(e.target.value)}
                onBlur={(e) => {
                  const numValue = parseInt(e.target.value);
                  const maxLimit = getMaxLimit();
                  if (!isNaN(numValue) && numValue > maxLimit) {
                    setCustomLimit(maxLimit.toString());
                    onUpdate(msg.id, { clientLimit: maxLimit });
                  }
                }}
                disabled={!msg.isEditing}
                placeholder={`Enter custom limit (Min: 0, Max: ${getMaxLimit().toLocaleString()})`}
                className={`w-full bg-white/5 border border-white/10 rounded-lg sm:rounded-xl pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 text-sm sm:text-base text-white placeholder-[#bdbdbd]/50 focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all ${
                  !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
                }`}
              />
            </div>
            {previewCount >= 0 && (
              <p className="text-[10px] sm:text-xs text-[#bdbdbd] mt-2">
                {msg.clientLimit === 0 
                  ? 0 
                  : Math.min(previewCount, availableCredits, msg.clientLimit)
                } clients will receive this message.
                <button
                  type="button"
                  onClick={() => setShowLimitModal(true)}
                  className="ml-1.5 text-[10px] sm:text-xs italic text-sky-300/80 hover:text-sky-300 transition-colors"
                >
                  See why
                </button>
              </p>
            )}
          </div>
        )}

        {!showCustomInput && previewCount >= 0 && (
          <p className="text-[10px] sm:text-xs text-[#bdbdbd] mt-2">
            {msg.clientLimit === 0 
              ? 0 
              : Math.min(previewCount, availableCredits, msg.clientLimit)
            } clients will receive this message.
            <button
              type="button"
              onClick={() => setShowLimitModal(true)}
              className="ml-1.5 text-[10px] sm:text-xs italic text-sky-300/80 hover:text-sky-300 transition-colors"
            >
              See why
            </button>
          </p>
        )}

        {msg.clientLimit > availableCredits && (
          <p className="text-[10px] sm:text-xs text-rose-400 mt-2">
            ⚠️ You only have {availableCredits} credits available
          </p>
        )}
      </div>

      {/* Schedule Date */}
      <div>
        <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
          <label className="block text-xs sm:text-sm font-medium text-[#bdbdbd]">
            <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 inline mr-1" />
            Send Date
          </label>
          <div className="relative group">
            <button
              type="button"
              onClick={() => setShowTooltip(!showTooltip)}
              className="flex items-center justify-center"
            >
              <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300/70" />
            </button>

            {/* Tooltip - centered on desktop, offset right on mobile */}
            <div className={`absolute bottom-full mb-2 z-20 w-56 sm:w-64 
              -right-30 sm:left-1/2 sm:-translate-x-1/2
              ${showTooltip ? 'block' : 'hidden group-hover:block'}`}>
              <div className="bg-[#0a0a0a] border border-amber-300/30 rounded-lg px-3 py-2 text-xs text-amber-200 shadow-xl">
                <p className="whitespace-normal break-words">
                  Messages can only be scheduled up to 7 days from now with at least 5 minutes buffer (15-min intervals)
                </p>
                <div className="absolute top-full sm:left-1/2 sm:-translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                </div>
              </div>
            </div>

            {/* Backdrop for mobile - only shows when clicked */}
            {showTooltip && (
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowTooltip(false)}
              />
            )}
          </div>
        </div>
        <input
          type="date"
          value={msg.scheduleDate || minDate}
          min={minDate}
          max={maxDate}
          onChange={(e) => onUpdate(msg.id, { scheduleDate: e.target.value })}
          disabled={!msg.isEditing}
          className={`w-full bg-white/5 border border-white/10 rounded-lg sm:rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
            !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
          }`}
        />
      </div>

      {/* Time - 12hr format with AM/PM */}
      <div>
        <label className="block text-xs sm:text-sm font-medium text-[#bdbdbd] mb-1.5 sm:mb-2">
          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 inline mr-1" />
          Send Time
        </label>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {/* Hour */}
          <select
            value={msg.hour}
            onChange={(e) => {
              const newHour = parseInt(e.target.value);
              onUpdate(msg.id, { hour: newHour });
            }}
            disabled={!msg.isEditing}
            className={`w-full bg-white/5 border border-white/10 rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
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
            className={`w-full bg-white/5 border border-white/10 rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
            }`}
          >
            {MINUTES_15.map((minute) => (
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
            className={`w-full bg-white/5 border border-white/10 rounded-lg sm:rounded-xl px-2 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
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
      {msg.isEditing && (
        <div className="mt-auto">
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
            {/* Save as Draft */}
            <button
              onClick={() => onSave(msg.id, 'draft')}
              disabled={isSaving || msg.message.length < 100}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
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
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  </motion.div>
                  <span className="hidden sm:inline">Saving...</span>
                  <span className="sm:hidden">Save...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Save Draft</span>
                  <span className="sm:hidden">Draft</span>
                </>
              )}
            </button>

            {/* Activate Schedule */}
            <button
              onClick={handleActivate}
              disabled={
                isSaving ||
                msg.message.length < 100 ||
                !msg.isValidated
              }
              className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 ${
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
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  </motion.div>
                  <span className="hidden sm:inline">Activating...</span>
                  <span className="sm:hidden">Act...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Activate</span>
                  <span className="sm:hidden">Active</span>
                </>
              )}
            </button>
          </div>

          {msg.isSaved && (
            <button
              onClick={() => onCancelEdit(msg.id)}
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Client Limit Info Modal */}
      {showLimitModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 rounded-xl sm:rounded-2xl overflow-hidden"
          onClick={() => setShowLimitModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] border border-white/20 rounded-xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-sky-300" />
                Client Limit Explained
              </h3>
              <button
                onClick={() => setShowLimitModal(false)}
                className="text-[#bdbdbd] hover:text-white transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            
            <div className="space-y-3 sm:space-y-4 text-xs sm:text-sm text-[#bdbdbd]">
              <p>
                You might see that your client list is less than what you&apos;re expecting, and that&apos;s normal.
              </p>
              
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 sm:p-4">
                <h4 className="font-semibold text-white mb-2 text-xs sm:text-sm">Here&apos;s how It Works:</h4>
                <ul className="space-y-2">
                  <li className="flex gap-2">
                    <span className="text-white mt-1">•</span>
                    <span>For all lists, anyone with no numbers are automatically disqualified.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-white mt-1">•</span>
                    <span>For campaign lists, anyone who has not visited for more than 8 months are disqualified.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-white mt-1">•</span>
                    <span>For mass messages, the cut-off is at 1 year and 6 months of not visiting.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-white mt-1">•</span>
                    <span>Your Maximum Number of Clients to Message is determined by whichever is higher: your available credits or the total number of eligible clients.</span>
                  </li>
                </ul>
              </div>
                          
              <div className="bg-amber-300/10 border border-amber-300/20 rounded-lg p-3 sm:p-4">
                <h4 className="font-semibold text-amber-300 mb-2 text-xs sm:text-sm">Important Notes:</h4>
                <p className="text-amber-200/80">
                  There are numerous processes that decide which clients are included, but rest assured that you are getting the right people to message.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowLimitModal(false)}
              className="w-full mt-4 sm:mt-6 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold bg-sky-300/20 text-sky-300 border border-sky-300/30 hover:bg-sky-300/30 transition-all"
            >
              Got it!
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}