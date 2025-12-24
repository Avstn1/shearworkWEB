import { motion } from 'framer-motion';
import { Calendar, Clock, FileText, Zap, Users, Hash, Info } from 'lucide-react';
import { SMSMessage, HOURS_12, MINUTES, PERIODS, CLIENT_LIMITS, CAMPAIGN_TYPES } from './types';
import { useState } from 'react';

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

// Right side of the MessageCard
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

  const [customLimit, setCustomLimit] = useState<string>(
    msg.clientLimit > 1000 ? msg.clientLimit.toString() : ''
  );
  
  // Check if it's a predefined limit or special case
  const isPredefinedLimit = [100, 250, 500, 750, 1000].includes(msg.clientLimit) || msg.clientLimit === availableCredits;
  const [showCustomInput, setShowCustomInput] = useState(!isPredefinedLimit);

  // Get minimum date (today)
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Get max limit based on campaign type
  const getMaxLimit = () => {
    return Math.min(availableCredits, maxClients);
  };

const handleLimitChange = (value: number) => {
  const maxLimit = getMaxLimit();
  
  if (value === -1) {
    // Custom selected
    setShowCustomInput(true);
    const newLimit = customLimit && parseInt(customLimit) >= 100 ? parseInt(customLimit) : 100;
    setCustomLimit(newLimit.toString());
    onUpdate(msg.id, { clientLimit: Math.min(newLimit, maxLimit) });
  } else if (value === -2) {
    // Max selected - use all available credits (or max for mass)
    setShowCustomInput(false);
    setCustomLimit('');
    onUpdate(msg.id, { clientLimit: maxLimit });
  } else {
    // Predefined limit selected - just use the value directly
    setShowCustomInput(false);
    setCustomLimit('');
    onUpdate(msg.id, { clientLimit: value }); // Remove Math.min here
  }
};

  const handleCustomLimitChange = (value: string) => {
    setCustomLimit(value);
    const numValue = parseInt(value);
    const maxLimit = getMaxLimit();
    
    if (!isNaN(numValue) && numValue >= 100) {
      onUpdate(msg.id, { clientLimit: Math.min(numValue, maxLimit) });
    }
  };

  const handlepurposeChange = (type: 'mass' | 'campaign') => {
    // Both use available credits as max
    const maxLimit = availableCredits;
    
    // Adjust client limit if it exceeds new max
    const newLimit = Math.min(msg.clientLimit, maxLimit);

    setAlgorithmType(type);
    
    onUpdate(msg.id, { 
      purpose: type,
      clientLimit: newLimit
    });
  };

  return (
    <div className="space-y-4">
      {/* Campaign Type Selection */}
      <div>
        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
          <Zap className="w-3 h-3 inline mr-1" />
          Algorithm Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CAMPAIGN_TYPES.map((type) => (
            <div key={type.value} className="relative group">
              <button
                type="button"
                onClick={() => handlepurposeChange(type.value)}
                disabled={!msg.isEditing}
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                  msg.purpose === type.value
                    ? 'bg-sky-300/20 text-sky-300 border-2 border-sky-300/50 shadow-[0_0_12px_rgba(125,211,252,0.3)]'
                    : 'bg-white/5 text-[#bdbdbd] border-2 border-white/10 hover:border-white/20'
                } ${!msg.isEditing ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {type.label}
                <div className="relative">
                  <Info className="w-3 h-3" />
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none w-72">
                    <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                      <p className="whitespace-normal break-words">{type.description}</p>
                      <div className="mt-1 text-amber-300 font-semibold">
                        Max: {availableCredits.toLocaleString()} clients (your available credits)
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                        <div className="border-4 border-transparent border-t-[#0a0a0a]" />
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
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-[#bdbdbd]">
            <Users className="w-3 h-3 inline mr-1" />
            Maximum Number of Clients to Message.
          </label>
        </div>
        <select
          value={showCustomInput ? -1 : msg.clientLimit === getMaxLimit() && getMaxLimit() > 1000 ? -2 : msg.clientLimit}
          onChange={(e) => handleLimitChange(parseInt(e.target.value))}
          disabled={!msg.isEditing}
          className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
            !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
          }`}
        >
          {/* Dynamic predefined limits */}
          {[100, 250, 500, 750, 1000].map((limit) => {
            const effectiveMax = Math.min(getMaxLimit(), maxClients);
            
            // Only show limits that are less than effective max
            if (limit > effectiveMax) return null;
            
            return (
              <option key={limit} value={limit} className="bg-[#1a1a1a]">
                {limit.toLocaleString()} clients
              </option>
            );
          })}

          {/* Max option - show credits or max clients, whichever is lower */}
          <option value={-2} className="bg-[#1a1a1a]">
            Max ({Math.min(getMaxLimit(), maxClients).toLocaleString()} {Math.min(getMaxLimit(), maxClients) === maxClients ? 'clients' : 'credits'})
          </option>

          {/* Custom option - always show last */}
          <option value={-1} className="bg-[#1a1a1a]">
            Custom
          </option>
        </select>

        {/* Custom Input */}
        {showCustomInput && (
          <div className="mt-2">
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#bdbdbd]" />
              <input
                type="number"
                min="1"
                max={getMaxLimit()}
                value={customLimit}
                onChange={(e) => handleCustomLimitChange(e.target.value)}
                disabled={!msg.isEditing}
                placeholder={`Enter custom limit (min 100, max ${getMaxLimit().toLocaleString()})`}
                className={`w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-[#bdbdbd]/50 focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all ${
                  !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
                }`}
              />
            </div>
            {previewCount > 0 && (
              <p className="text-xs text-[#bdbdbd] mt-1">
                {previewCount} clients will receive this message
              </p>
            )}
          </div>
        )}
        
        {!showCustomInput && previewCount > 0 && (
          <p className="text-xs text-[#bdbdbd] mt-2">
            {previewCount} clients will receive this message.
            <button
              type="button"
              onClick={() => setShowLimitModal(true)}
              className="ml-1.5 text-xs italic text-sky-300/80 hover:text-sky-300 transition-colors"
            >
              See why
            </button>
          </p>
        )}

        {/* Credit/Limit warnings */}
        {msg.clientLimit > availableCredits && (
          <p className="text-xs text-rose-400 mt-2">
            ⚠️ You only have {availableCredits} credits available
          </p>
        )}
      </div>

      {/* Schedule Date */}
      <div>
        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
          <Calendar className="w-3 h-3 inline mr-1" />
          Send Date
        </label>
        <input
          type="date"
          value={msg.scheduleDate || today}
          min={today}
          onChange={(e) => onUpdate(msg.id, { scheduleDate: e.target.value })}
          disabled={!msg.isEditing}
          className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all appearance-none cursor-pointer ${
            !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
          }`}
        />
      </div>

      {/* Time - 12hr format with AM/PM */}
      <div>
        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
          <Clock className="w-3 h-3 inline mr-1" />
          Send Time
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
      {msg.isEditing && (
        <div className="mt-auto">
          {/* Two Choice Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-2">
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
                !msg.isValidated
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
      )}

      {/* Client Limit Info Modal */}
      {showLimitModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 rounded-2xl overflow-hidden"
          onClick={() => setShowLimitModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] border border-white/20 rounded-2xl max-w-lg w-full p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-300" />
                Client Limit Explained
              </h3>
              <button
                onClick={() => setShowLimitModal(false)}
                className="text-[#bdbdbd] hover:text-white transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            
            <div className="space-y-4 text-sm text-[#bdbdbd]">
              <p>
                You might see that your client list is less than what you&apos;re expecting, and that&apos;s normal.
              </p>
              
            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h4 className="font-semibold text-white mb-2">Here&apos;s how It Works:</h4>
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
              </ul>
            </div>
                          
              <div className="bg-amber-300/10 border border-amber-300/20 rounded-lg p-4">
                <h4 className="font-semibold text-amber-300 mb-2">Important Notes:</h4>
                <p className="text-amber-200/80">
                  There are numerous processes that decide which clients are included, but rest assured that you are getting the right people to message.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setShowLimitModal(false)}
              className="w-full mt-6 px-6 py-3 rounded-xl font-bold bg-sky-300/20 text-sky-300 border border-sky-300/30 hover:bg-sky-300/30 transition-all"
            >
              Got it!
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}