import type { SupabaseClient } from '@supabase/supabase-js'
import type { AvailabilityDateRange, AvailabilitySlotRecord } from '@/lib/booking/availability/types'

export interface AvailabilityAdapter {
  readonly name: string
  fetchAvailabilitySlots(
    supabase: SupabaseClient,
    userId: string,
    dateRange: AvailabilityDateRange
  ): Promise<AvailabilitySlotRecord[]>
}
