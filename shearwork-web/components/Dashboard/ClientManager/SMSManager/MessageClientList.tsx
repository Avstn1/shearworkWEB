import { Users, Loader2 } from 'lucide-react';
import { SMSMessage, PhoneNumber } from './types';

interface MessageClientListProps {
  message: SMSMessage;
  phoneNumbers: PhoneNumber[];
  isLoading?: boolean;
}

export function MessageClientList({
  message,
  phoneNumbers,
  isLoading = false,
}: MessageClientListProps) {
  
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
          <label className="block text-sm font-medium text-[#bdbdbd] mb-1 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Recipients ({phoneNumbers.length} clients)
          </label>
          <p className="text-xs text-[#bdbdbd]/70">
            Clients who will receive this message
          </p>
        </div>
        
        {isLoading && (
          <Loader2 className="w-4 h-4 text-sky-300 animate-spin" />
        )}
      </div>

      {/* Client List Textarea */}
      <div className="relative">
        <textarea
          value={formatClientList()}
          readOnly
          disabled
          rows={14}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white/70 text-sm font-mono focus:outline-none resize-none cursor-default scrollbar-hide"
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

      {/* Info Text */}
      <div className="flex items-start gap-2 p-2.5 bg-sky-300/10 border border-sky-300/20 rounded-xl">
        <Users className="w-4 h-4 text-sky-300 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-sky-300">
          These clients are automatically selected based on their visit patterns and will receive your message when activated.
        </p>
      </div>
    </div>
  );
}