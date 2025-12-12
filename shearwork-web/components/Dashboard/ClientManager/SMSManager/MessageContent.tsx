import { motion } from 'framer-motion';
import { Shield, AlertCircle, Send } from 'lucide-react';
import { SMSMessage } from './types';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface MessageContentProps {
  message: SMSMessage;
  validatingId: string | null;
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onValidate: (msgId: string) => void;
}

export function MessageContent({
  message: msg,
  validatingId,
  onUpdate,
  onValidate,
}: MessageContentProps) {
  const [isTesting, setIsTesting] = useState(false);

  const handleTestMessage = async () => {
    // Check if message is saved
    if (!msg.isSaved) {
      toast.error('Please save the message as a draft before testing');
      return;
    }

    // Check if message is in DRAFT status
    if (msg.validationStatus !== 'DRAFT') {
      toast.error('To test your message, save the message as draft first.');
      return;
    }

    if (!msg.message.trim()) {
      toast.error('Please enter a message first');
      return;
    }

    if (msg.message.length < 100) {
      toast.error('Message must be at least 100 characters');
      return;
    }

    setIsTesting(true);
    try {
      const response = await fetch(`/api/client-messaging/qstash-sms-send?messageId=${msg.id}&action=test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test message');
      }

      toast.success(`Test message sent successfully to your phone!`);
    } catch (error: any) {
      console.error('Test message error:', error);
      toast.error(error.message || 'Failed to send test message');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Validation Reason Alert */}
      {msg.isValidated && msg.validationStatus === 'DENIED' && msg.validationReason && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-rose-300">{msg.validationReason}</p>
        </div>
      )}

      {/* Test Requirements Info */}
      {!msg.isSaved && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            Save this message as a draft before you can test it
          </p>
        </div>
      )}

      {msg.isSaved && msg.validationStatus === 'ACCEPTED' && (
        <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-sky-300">
            This message is active. To test changes, save as draft first.
          </p>
        </div>
      )}

      {/* Message Textarea */}
      <div>
        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
          Message Content (SMS limits: 100-240 characters)
        </label>
        <div className="relative">
          <textarea
            value={msg.message}
            onChange={(e) =>
              onUpdate(msg.id, { message: e.target.value })
            }
            placeholder="Type your marketing message here..."
            rows={8}
            disabled={!msg.isEditing}
            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-20 text-white placeholder-[#bdbdbd]/50 focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300/50 transition-all resize-none ${
              !msg.isEditing ? 'cursor-not-allowed opacity-70' : ''
            }`}
            maxLength={240}
          />
          <span
            className={`absolute top-3 right-3 text-xs font-medium ${
              msg.message.length < 100
                ? 'text-amber-400'
                : msg.message.length > 240
                ? 'text-rose-400'
                : 'text-lime-300'
            }`}
          >
            {msg.message.length}/240
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      {msg.isEditing && (
        <div className="grid grid-cols-2 gap-2">
          {/* Validate Button */}
          <button
            onClick={() => onValidate(msg.id)}
            disabled={msg.message.length < 100 || validatingId === msg.id}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {validatingId === msg.id ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Shield className="w-5 h-5" />
                </motion.div>
                Validating...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Validate
              </>
            )}
          </button>

          {/* Test Message Button */}
          <button
            onClick={handleTestMessage}
            disabled={
              !msg.isSaved || 
              msg.validationStatus !== 'DRAFT' || 
              msg.message.length < 100 || 
              isTesting
            }
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-sky-300/20 border border-sky-300/30 text-sky-300 rounded-xl font-semibold hover:bg-sky-300/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Send className="w-5 h-5" />
                </motion.div>
                Sending...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Test
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}