import { motion } from 'framer-motion';
import { Trash2, Clock, CheckCircle, XCircle, Edit, Pencil, Check, X, Send, Loader2 } from 'lucide-react';
import { SMSMessage, DAYS_OF_WEEK, PhoneNumber } from './types';
import { MessageContent } from './MessageContent';
import { MessageClientList } from './MessageClientList';

interface MessageCardProps {
  message: SMSMessage;
  index: number;
  isSaving: boolean;
  savingMode: 'draft' | 'activate' | null;
  validatingId: string | null;
  editingTitleId: string | null;
  tempTitle: string;
  phoneNumbers: PhoneNumber[];
  testMessagesUsed: number;
  availableCredits: number;
  profile: any;
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onEnableEdit: (id: string) => void;
  onCancelEdit: (id: string) => void;
  onSave: (msgId: string, mode: 'draft' | 'activate') => void;
  onValidate: (msgId: string) => void;
  onRequestTest: (msgId: string) => void;
  onStartEditingTitle: (id: string, currentTitle: string) => void;
  onSaveTitle: (id: string) => void;
  onCancelEditTitle: () => void;
  onRequestDeactivate: (msgId: string) => void; 
  onTempTitleChange: (title: string) => void;
}

export function MessageCard({
  message: msg,
  index,
  isSaving,
  savingMode,
  validatingId,
  editingTitleId,
  tempTitle,
  phoneNumbers,
  testMessagesUsed,
  availableCredits,
  profile,
  onUpdate,
  onEnableEdit,
  onCancelEdit,
  onSave,
  onValidate,
  onRequestTest,
  onRequestDeactivate,
  onStartEditingTitle,
  onSaveTitle,
  onCancelEditTitle,
  onTempTitleChange,
}: MessageCardProps) {
  
  const getSchedulePreview = (msg: SMSMessage) => {
    const minute = msg.minute ?? 0;
    const displayHour = msg.hour === 0 ? 12 : msg.hour > 12 ? msg.hour - 12 : msg.hour;
    const timeStr = `${displayHour}:${minute.toString().padStart(2, '0')} ${msg.period || 'AM'}`;
    
    if (msg.frequency === 'monthly') {
      return `Every month on day ${msg.dayOfMonth} at ${timeStr}`;
    } else if (msg.frequency === 'biweekly') {
      const day = DAYS_OF_WEEK.find((d) => d.value === msg.dayOfWeek)?.label;
      return `Every other ${day} at ${timeStr}`;
    } else {
      const day = DAYS_OF_WEEK.find((d) => d.value === msg.dayOfWeek)?.label;
      return `Every ${day} at ${timeStr}`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl overflow-hidden"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-300/20 rounded-full flex items-center justify-center">
              <span className="text-sky-300 font-bold">{index + 1}</span>
            </div>
            <div>
              {/* Title - Not Editable */}
              <h3 className="text-white font-semibold">
                {msg.title}
              </h3>
              <p className="text-xs text-[#bdbdbd] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {getSchedulePreview(msg)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
             {/* Edit Button - CHANGED: Only show if not editing, saved, and NOT currently active */}
            {!msg.isEditing && msg.isSaved && !(msg.enabled && msg.validationStatus === 'ACCEPTED') && (
              <button
                onClick={() => onEnableEdit(msg.id)}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-[#bdbdbd] border border-white/10 hover:bg-white/10 hover:text-white transition-all duration-300 flex items-center gap-1"
              >
                <Edit className="w-3 h-3" />
                Edit
              </button>
            )}

            {/* Saved/Draft Badge */}
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              msg.isSaved 
                ? 'bg-lime-300/10 text-lime-300 border border-lime-300/20'
                : 'bg-amber-300/10 text-amber-300 border border-amber-300/20'
            }`}>
              {msg.isSaved ? 'Saved' : 'Draft'}
            </span>

            {/* Verified Badge */}
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              msg.isValidated
                ? 'bg-sky-300/10 text-sky-300 border border-sky-300/20'
                : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
            }`}>
              {msg.isValidated ? 'Verified' : 'Unverified'}
            </span>

            {/* Active/Inactive Status - CHANGED: Now clickable when active */}
            {msg.isSaved && msg.validationStatus === 'ACCEPTED' && (
              <>
                {msg.enabled ? (
                  <button
                    onClick={() => onRequestDeactivate(msg.id)}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all bg-lime-300/20 text-lime-300 border border-lime-300/30 hover:bg-lime-300/30 cursor-pointer"
                  >
                    Active - click to toggle
                  </button>
                ) : (
                  <button
                    onClick={() => onEnableEdit(msg.id)}
                    className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-[#bdbdbd] border border-white/10 hover:bg-white/10 hover:text-white transition-all duration-300 flex items-center gap-1"
                  >
                    <Edit className="w-3 h-3" />
                    Edit
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 50/50 Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT: Message Content (50%) */}
          <MessageContent
            message={msg}
            validatingId={validatingId}
            testMessagesUsed={testMessagesUsed}
            profile={profile}
            onUpdate={onUpdate}
            onValidate={onValidate}
            onRequestTest={onRequestTest}
          />

          {/* RIGHT: Recipients List (50%) */}
          <MessageClientList
            message={msg}
            phoneNumbers={phoneNumbers}
            isSaving={isSaving}
            savingMode={savingMode}
            onSave={onSave}
            onCancelEdit={onCancelEdit}
          />
        </div>
      </div>

      {/* Preview Banner */}
      <div className="bg-sky-300/10 border-t border-sky-300/20 px-6 py-3">
        <p className="text-xs text-sky-300 flex items-center gap-2">
          <Send className="w-3 h-3" />
          <span className="font-medium">Will send to:</span>
          <span className="text-sky-200">{phoneNumbers.length} {msg.visitingType} clients</span>
        </p>
      </div>
    </motion.div>
  );
}