// lib/nudge/holidayCalendar.ts
// Holiday calendar definitions and utility functions for seasonal nudge boosting

/**
 * Represents a holiday period for nudge sensitivity analysis.
 * Used to identify clients who historically book during seasonal events.
 */
export interface Holiday {
  id: string                    // Unique identifier, e.g., 'march_break_2026'
  name: string                  // Human-readable name, e.g., 'March Break'
  year: number                  // Year of the holiday
  startDate: string             // Start date in YYYY-MM-DD format
  endDate: string               // End date in YYYY-MM-DD format
  activationDaysBefore: number  // Days before holiday to start boosting clients
}

/**
 * Holiday calendar - add new holidays here.
 * Spring Break Season covers both Reading Week (universities) and March Break (K-12).
 * This extended window captures all clients who book during the late Feb - mid March period.
 */
export const HOLIDAYS: Holiday[] = [
  // Spring Break Season 2025 (for lookback comparison)
  // Covers Reading Week + March Break period
  {
    id: 'spring_break_2025',
    name: 'Spring Break Season',
    year: 2025,
    startDate: '2025-02-17',  // Monday, last 2 weeks of Feb
    endDate: '2025-03-14',    // End of March Break 2025
    activationDaysBefore: 0,  // Activates immediately on start date
  },
  // Spring Break Season 2026 (current target)
  // Covers Reading Week + March Break period
  {
    id: 'spring_break_2026',
    name: 'Spring Break Season',
    year: 2026,
    startDate: '2026-02-16',  // Monday, last 2 weeks of Feb
    endDate: '2026-03-20',    // End of March Break 2026
    activationDaysBefore: 0,  // Activates immediately on start date
  },
]

/**
 * Parse a YYYY-MM-DD string to a Date object at midnight Toronto time.
 * Returns the date in local timezone for consistent comparison.
 */
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Check if we're currently in the activation window for any upcoming holiday.
 * The activation window starts `activationDaysBefore` days before the holiday.
 * 
 * @param today - Current date
 * @returns The holiday to boost for, or null if not in any activation window
 * 
 * @example
 * // If today is Feb 20, 2026 and Spring Break Season runs Feb 16 - Mar 20:
 * getActiveHolidayForBoosting(new Date('2026-02-20')) // Returns spring_break_2026
 */
export function getActiveHolidayForBoosting(today: Date): Holiday | null {
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  for (const holiday of HOLIDAYS) {
    const holidayStart = parseDate(holiday.startDate)
    const holidayEnd = parseDate(holiday.endDate)
    
    // Calculate activation window start
    const activationStart = new Date(holidayStart)
    activationStart.setDate(activationStart.getDate() - holiday.activationDaysBefore)
    
    // Check if today falls within [activationStart, holidayEnd]
    if (todayNormalized >= activationStart && todayNormalized <= holidayEnd) {
      return holiday
    }
  }

  return null
}

/**
 * Check if a given date falls within a holiday window (with optional buffer).
 * 
 * @param date - Date to check
 * @param holiday - Holiday to check against
 * @param bufferDays - Number of days to extend the window on each side
 * @returns true if date is within [holiday.startDate - buffer, holiday.endDate + buffer]
 * 
 * @example
 * // Check if March 8, 2025 is within March Break 2025 (March 10-14) with 14-day buffer:
 * isDateInHolidayWindow(new Date('2025-03-08'), marchBreak2025, 14) // true (within buffer)
 */
export function isDateInHolidayWindow(
  date: Date,
  holiday: Holiday,
  bufferDays: number = 0
): boolean {
  const dateNormalized = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  const windowStart = parseDate(holiday.startDate)
  windowStart.setDate(windowStart.getDate() - bufferDays)
  
  const windowEnd = parseDate(holiday.endDate)
  windowEnd.setDate(windowEnd.getDate() + bufferDays)
  
  return dateNormalized >= windowStart && dateNormalized <= windowEnd
}

/**
 * Get the equivalent holiday from the previous year.
 * Used to check if a client booked during the same holiday last year.
 * 
 * @param holiday - Current holiday
 * @returns Previous year's equivalent holiday, or null if not found
 * 
 * @example
 * getPreviousYearHoliday(spring_break_2026) // Returns spring_break_2025
 */
export function getPreviousYearHoliday(holiday: Holiday): Holiday | null {
  const previousYear = holiday.year - 1
  const holidayBaseName = holiday.id.replace(/_\d{4}$/, '') // e.g., 'march_break'
  
  return HOLIDAYS.find(h => 
    h.id === `${holidayBaseName}_${previousYear}`
  ) || null
}

/**
 * Get the date range for querying appointments during a holiday window.
 * Returns ISO date strings suitable for Supabase queries.
 * 
 * @param holiday - Holiday to get range for
 * @param bufferDays - Days to extend on each side
 * @returns Object with startDate and endDate as YYYY-MM-DD strings
 */
export function getHolidayDateRange(
  holiday: Holiday,
  bufferDays: number = 0
): { startDate: string; endDate: string } {
  const start = parseDate(holiday.startDate)
  start.setDate(start.getDate() - bufferDays)
  
  const end = parseDate(holiday.endDate)
  end.setDate(end.getDate() + bufferDays)
  
  const formatDate = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  }
}
