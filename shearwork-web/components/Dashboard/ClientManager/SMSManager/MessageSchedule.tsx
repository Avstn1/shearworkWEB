import { Users } from 'lucide-react';
import { SMSMessage } from './types';

interface PhoneNumber {
  first_name: string | null;
  last_name: string | null;
  phone_normalized: string | null;
}

interface MessageScheduleProps {
  message: SMSMessage;
  phoneNumbers: PhoneNumber[];
}

export function MessageSchedule({ message: msg, phoneNumbers }: MessageScheduleProps) {
  // Format phone numbers for textarea
  const phoneNumbersText = phoneNumbers
    .map(
      (p) =>
        `${p.first_name || ''} ${p.last_name || ''} - ${p.phone_normalized || ''}`
    )
    .join('\n');

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#bdbdbd] mb-2">
          <Users className="w-3 h-3 inline mr-1" />
          Recipients ({phoneNumbers.length} {msg.visitingType} clients)
        </label>
        <textarea
          value={phoneNumbersText}
          readOnly
          className="w-full h-64 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono resize-none focus:outline-none cursor-not-allowed opacity-70"
          placeholder="No clients selected for this type"
        />
      </div>
    </div>
  );
}