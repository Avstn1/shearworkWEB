import { motion } from 'framer-motion';
import { Users, Loader2, FileText, Zap, Clock, AlertCircle, X } from 'lucide-react';
import { SMSMessage, PhoneNumber } from './types';

interface MessageClientListProps {
  message: SMSMessage;
  phoneNumbers: PhoneNumber[];
  isSaving: boolean;
  savingMode: 'draft' | 'activate' | null;
  onSave: (msgId: string, mode: 'draft' | 'activate') => void;
  onCancelEdit: (id: string) => void;
  isFullLock?: boolean;
  isPartialLock?: boolean;
}

export function MessageClientList({
  message: msg,
  phoneNumbers,
  isSaving,
  savingMode,
  onSave,
  onCancelEdit,
  isFullLock = false,
  isPartialLock = false
}: MessageClientListProps) {
  
  // Debug log
  console.log('MessageClientList render:', { 
    messageId: msg.id, 
    isFullLock, 
    isPartialLock,
    isValidated: msg.isValidated,
    messageLength: msg.message.length
  });
  
  // Format client data for textarea with aligned numbers
  const formatClientList = () => {
    if (phoneNumbers.length === 0) {
      return 'No clients selected for this category yet...';
    }
    
    // Find the max number width for alignment
    const maxNumberWidth = phoneNumbers.length.toString().length;
    return phoneNumbers
      .map((client, idx) => {
        const name = client.full_name || 'No name';
        const phone = client.phone_normalized || 'No phone';
        const number = (idx + 1).toString().padStart(maxNumberWidth, ' ');
        return `${number}. ${name}: ${phone}`;
      })
      .join('\n');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-[#bdbdbd] -mb-2">
            <Users className="w-3 h-3 inline mr-1" />
            Recipients ({phoneNumbers.length} clients)
          </label>
        </div>
      </div>

      {/* Client List Textarea */}
      <div className="relative">
        <textarea
          value={formatClientList()}
          readOnly
          disabled
          rows={msg.isEditing ? 15 : 15}
          className="w-full bg-white/5 border border-white/10 rounded-xl pb-4.5 px-4 py-4 text-white/70 text-sm font-mono focus:outline-none resize-none cursor-default scrollbar-hide"
          style={{ 
            caretColor: 'transparent',
            userSelect: 'text',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        />
        
        {/* Count Badge */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-sky-300/20 border border-sky-300/30 rounded-full">
          <span className="text-xs font-semibold text-sky-300">
            {phoneNumbers.length}
          </span>
        </div>
      </div>
      
      {/* Action Buttons */}
      {msg.isEditing && !isFullLock ? (
        <div className="mt-auto">
          {/* Two Choice Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* Save as Draft - Always available during editing (even partial lock) */}
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

            {/* Activate Schedule - Disabled during partial lock with tooltip */}
            <div className="relative group">
              <button
                onClick={() => {
                  if (!isPartialLock) {
                    onSave(msg.id, 'activate');
                  }
                }}
                disabled={
                  isSaving ||
                  msg.message.length < 100 ||
                  !msg.isValidated ||
                  isPartialLock
                }
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-300 ${
                  // Check if button should be disabled
                  isSaving || msg.message.length < 100 || !msg.isValidated || isPartialLock
                    ? 'bg-gray-600/50 text-gray-400 cursor-not-allowed border border-gray-600/50'
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
              {isPartialLock && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
                  <div className="bg-[#0a0a0a] border border-white/20 rounded-lg px-3 py-2 text-xs text-white shadow-xl">
                    Can be activated again next month
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-[#0a0a0a]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cancel Button */}
          {msg.isSaved && (
            <button
              onClick={() => onCancelEdit(msg.id)}
              disabled={isSaving}
              className="w-full px-6 py-3 rounded-xl font-bold bg-white/5 text-[#bdbdbd] hover:bg-white/10 hover:text-white transition-all duration-300 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4 inline mr-2" />
              Cancel
            </button>
          )}
        </div>
      ) : (
        // When NOT editing - show info text
        <div className="flex items-start gap-2 p-3 bg-sky-300/10 border border-sky-300/20 rounded-xl">
          <Users className="w-4 h-4 text-sky-300 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-sky-300">
            These clients are automatically selected based on their visit patterns and will receive your message when activated.
          </p>
        </div>
      )}
    </div>
  );
}