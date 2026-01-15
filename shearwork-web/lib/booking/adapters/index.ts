// lib/booking/adapters/index.ts

import { BookingAdapter } from './BookingAdapter'
import { AcuityAdapter } from './acuity'
import { SquareAdapter } from './square'

const adapters: Record<string, () => BookingAdapter> = {
  acuity: () => new AcuityAdapter(),
  square: () => new SquareAdapter(),
}

export function getBookingAdapter(software: string): BookingAdapter {
  const factory = adapters[software.toLowerCase()]

  if (!factory) {
    const available = Object.keys(adapters).join(', ')
    throw new Error(
      `No adapter found for booking software: "${software}". Available: ${available}`
    )
  }

  return factory()
}

// Use `export type` for interfaces/types
export type { BookingAdapter } from './BookingAdapter'
export { AcuityAdapter } from './acuity'
export { SquareAdapter } from './square'
