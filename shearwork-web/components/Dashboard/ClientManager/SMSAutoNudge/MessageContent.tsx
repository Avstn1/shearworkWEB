import { motion } from 'framer-motion';
import { Shield, AlertCircle, Send, Sparkles } from 'lucide-react';
import { SMSMessage } from './types';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface MessageContentProps {
  message: SMSMessage;
  validatingId: string | null;
  profile: any;
  onUpdate: (id: string, updates: Partial<SMSMessage>) => void;
  onValidate: (msgId: string) => void;
  onRequestTest: (msgId: string) => void;
  isTrialPreview?: boolean;
  isFullLock?: boolean;
  isPartialLock?: boolean;
}

export function MessageContent({
  profile,
  message: msg,
  validatingId,
  onUpdate,
  onValidate,
  onRequestTest, 
  isTrialPreview = false,
  isFullLock = false,
  isPartialLock = false,
}: MessageContentProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateTemplate = async () => {
    setIsGenerating(true);
    try {
      const bookingLink = `${process.env.NEXT_PUBLIC_SITE_URL}book?profile=${profile.username}`

      const response = await fetch('/api/client-messaging/generate-sms-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: 'Generate a professional barbershop marketing SMS message',
          profile: {
            full_name: profile?.full_name || '',
            email: profile?.email || '',
            phone: profile?.phone || '',
            booking_link: bookingLink
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate template');
      }

      onUpdate(msg.id, { message: data.message });
      toast.success('Template generated successfully!');
    } catch (error: any) {
      console.error('Template generation error:', error);
      toast.error(error.message || 'Failed to generate template');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTestMessage = async () => {
    if (!msg.isSaved) {
      toast.error('Please save the message as a draft before testing');
      return;
    }

    if (!msg.isValidated) {
      toast.error('Message must be validated before testing');
      return;
    }

    if (msg.validationStatus !== 'DRAFT') {
      toast.error('Only draft messages can be tested');
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

      toast.success('Test message sent successfully to your phone!');
    } catch (error: any) {
      console.error('Test message error:', error);
      toast.error(error.message || 'Failed to send test message');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 flex flex-col h-full">
      {/* Validation Reason Alert */}
      {msg.isValidated && msg.validationStatus === 'DENIED' && msg.validationReason && (
        <div className="p-3 bg-[#FF8F7D]/10 border border-[#FF8F7D]/20 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[#FF8F7D] mt-0.5 flex-shrink-0" strokeWidth={1.75} />
          <p className="text-[13px] text-[#FF8F7D]">{msg.validationReason}</p>
        </div>
      )}

      {/* Message Textarea */}
      <div className="flex-1">
        <label className="field-label">
          Message Content (SMS limits: 100-240 characters)
        </label>
        <div className="relative">
          <textarea
            value={msg.message}
            onChange={(e) =>
              onUpdate(msg.id, { message: e.target.value })
            }
            placeholder="Type your marketing message here or generate a template..."
            rows={9}
            disabled={!msg.isEditing || isFullLock}
            className={`field pb-12 sm:pb-15 -mb-3 pr-16 sm:pr-20 resize-none overflow-y-auto ${
              !msg.isEditing || isFullLock ? 'cursor-not-allowed opacity-70' : ''
            }`}
            maxLength={240}
          />
          <span
            className={`absolute top-2.5 right-3 text-[11px] sm:text-xs font-medium tabular-nums ${
              msg.message.length < 100
                ? 'text-amber-300'
                : msg.message.length > 240
                ? 'text-[#FF8F7D]'
                : 'text-sage-bright'
            }`}
          >
            {msg.message.length}/240
          </span>
        </div>
      </div>

      {/* Test Requirements Info */}
      {!msg.isSaved && (
        <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
          <p className="text-[13px] text-gray-300">
            Save and validate this message as a draft before you can test it
          </p>
        </div>
      )}

      {msg.isSaved && !msg.isValidated && (
        <div className="p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
          <p className="text-[13px] text-gray-300">
            Validate this message before you can test it
          </p>
        </div>
      )}

      {/* Test Cost Info - Only show when saved AND validated */}
      {msg.isSaved && msg.isValidated && (
        <div className="p-3 bg-[#9CCBFF]/[0.06] border border-[#9CCBFF]/15 rounded-lg">
          <p className="text-[13px] text-[#9CCBFF]">
            Test messages cost 1 credit each once your free tests are used up.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      {msg.isEditing && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {/* Generate Template Button */}
          <div className="relative group">
            <button
              onClick={handleGenerateTemplate}
              disabled={isGenerating || isFullLock}
              className="btn btn-glass btn-sm w-full px-2 sm:px-3 text-xs sm:text-sm"
            >
              {isGenerating ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="w-4 h-4" strokeWidth={1.75} />
                  </motion.div>
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Generate</span>
                </>
              )}
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
              <div className="bg-raised border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-ivory">
                AI-generate a message template
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-raised" />
                </div>
              </div>
            </div>
          </div>

          {/* Validate Button */}
          <div className="relative group">
            <button
              onClick={() => onValidate(msg.id)}
              disabled={msg.message.length < 100 || validatingId === msg.id || isFullLock}
              className="btn btn-glass btn-sm w-full px-2 sm:px-3 text-xs sm:text-sm"
            >
              {validatingId === msg.id ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Shield className="w-4 h-4" strokeWidth={1.75} />
                  </motion.div>
                  <span className="hidden sm:inline">Validating...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Validate</span>
                </>
              )}
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
              <div className="bg-raised border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-ivory">
                Check message for compliance issues
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-raised" />
                </div>
              </div>
            </div>
          </div>

          {/* Test Message Button */}
          <div className="relative group">
            <button
              onClick={() => {
                if (!msg.isSaved) {
                  toast.error('Please save the message as a draft before testing');
                  return;
                }
                if (!msg.isValidated) {
                  toast.error('Message must be validated before testing');
                  return;
                }
                if (msg.validationStatus !== 'DRAFT') {
                  toast.error('Only draft messages can be tested');
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
                if (isTrialPreview) {
                  toast.error('Auto-Nudge tests are available after upgrading');
                  return;
                }
                onRequestTest(msg.id);
              }}
              disabled={
                isTesting ||
                !msg.isSaved ||
                !msg.isValidated ||
                msg.validationStatus !== 'DRAFT' ||
                !msg.message.trim() ||
                msg.message.length < 100 ||
                isFullLock ||
                isTrialPreview
              }
className="btn btn-glass btn-sm w-full px-2 sm:px-3 text-xs sm:text-sm"
            >
              {isTesting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Send className="w-4 h-4" strokeWidth={1.75} />
                  </motion.div>
                  <span className="hidden sm:inline">Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Test</span>
                </>
              )}
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none whitespace-nowrap">
              <div className="bg-raised border border-white/[0.12] rounded-lg px-3 py-2 text-xs text-ivory">
                Send test to your phone (1 credit)
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-raised" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
