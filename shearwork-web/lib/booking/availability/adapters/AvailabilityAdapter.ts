import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AvailabilityAppointmentType,
  AvailabilityDateRange,
  AvailabilitySlotRecord,
} from '@/lib/booking/availability/types'

export interface AvailabilityAdapter {
  readonly name: string
  fetchAvailabilitySlots(
    supabase: SupabaseClient,
    userId: string,
    dateRange: AvailabilityDateRange
  ): Promise<AvailabilitySlotRecord[]>
  fetchAppointmentTypesForUser?(
    supabase: SupabaseClient,
    userId: string
  ): Promise<AvailabilityAppointmentType[]>
}
