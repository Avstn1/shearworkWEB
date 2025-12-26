export interface SMSMessage {
  id: string;
  title: string;
  message: string;
  visitingType?: 'consistent' | 'semi-consistent' | 'easy-going' | 'rare' | 'new'; 
  frequency: 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: string;
  dayOfMonth?: number;
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
  enabled: boolean;
  isSaved: boolean;
  isValidated?: boolean;
  validationStatus?: 'ACCEPTED' | 'DENIED' | 'DRAFT' | null;
  validationReason?: string;
  isEditing?: boolean;
}

export const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

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

export const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => ({
  value: i + 1,
  label: (i + 1).toString(),
}));

export type PhoneNumber = {
  phone_normalized: string;
  full_name: string;
};