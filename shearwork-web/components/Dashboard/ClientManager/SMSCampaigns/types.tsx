export interface SMSMessage {
  id: string;
  title: string;
  message: string;
  // ONE-TIME SCHEDULE FIELDS
  scheduleDate?: string; // YYYY-MM-DD format
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  clientLimit: number; // Number of clients to target
  enabled: boolean;
  isSaved: boolean;
  isValidated?: boolean;
  validationStatus?: 'ACCEPTED' | 'DENIED' | 'DRAFT' | null;
  validationReason?: string;
  isEditing?: boolean;
  purpose: 'campaign' | 'mass' | 'marketing';
}

export const HOURS_12 = Array.from({ length: 12 }, (_, i) => ({
  value: i === 0 ? 12 : i,
  label: (i === 0 ? 12 : i).toString().padStart(2, '0'),
}));

export const MINUTES = Array.from({ length: 60 }, (_, i) => ({
  value: i,
  label: i.toString().padStart(2, '0'),
}));

export const PERIODS = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

export const CLIENT_LIMITS = [
  { value: 100, label: '100 clients' },
  { value: 250, label: '250 clients' },
  { value: 500, label: '500 clients' },
  { value: 750, label: '750 clients' },
  { value: 1000, label: '1,000 clients' },
  { value: -1, label: 'Custom' },
  { value: -2, label: 'Max (All available credits)' },
];

export const CAMPAIGN_TYPES = [
  { 
    value: 'campaign' as const, 
    label: 'Campaign',
    description: 'Uses an algorithm that carefully selects clients who has the most need for a message. Good for call-to-action campaigns.'
  },
  { 
    value: 'mass' as const, 
    label: 'Mass',
    description: 'Selects your clients sorted by most recent visit - the more recent their visit, the more likely they\'ll be included. Good for absence messages'
  },
];

export interface PhoneNumber {
  full_name: string;
  phone_normalized: string;
}