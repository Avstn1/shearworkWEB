export type AvailabilityDateRange = {
  startDate: string
  endDate: string
  dates: string[]
}

export type AvailabilitySlotRecord = {
  user_id: string
  source: string
  calendar_id: string
  appointment_type_id: string
  appointment_type_name?: string | null
  slot_date: string
  start_time: string
  start_at?: string | null
  duration_minutes?: number | null
  price?: number | null
  estimated_revenue?: number | null
  timezone?: string | null
  fetched_at?: string
  created_at?: string
  updated_at?: string
}

export type AvailabilityDailySummaryRecord = {
  user_id: string
  source: string
  slot_date: string
  slot_count: number
  estimated_revenue: number
  timezone?: string | null
  fetched_at?: string
  created_at?: string
  updated_at?: string
}

export type AvailabilitySourceResult = {
  slotCount: number
  dayCount: number
  estimatedRevenue: number
  errors?: string[]
}

export type AvailabilityPullResult = {
  success: boolean
  fetchedAt: string
  cacheHit: boolean
  range: AvailabilityDateRange
  totalSlots: number
  totalEstimatedRevenue: number
  slots: AvailabilitySlotRecord[]
  summaries: AvailabilityDailySummaryRecord[]
  sources: Record<string, AvailabilitySourceResult>
  errors?: string[]
}

export type AvailabilityPullOptions = {
  dryRun?: boolean
  forceRefresh?: boolean
}
