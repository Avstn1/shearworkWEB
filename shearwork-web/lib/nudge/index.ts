// lib/nudge/index.ts
// Holiday sensitivity layer for the smart nudge engine

export {
  type Holiday,
  HOLIDAYS,
  getActiveHolidayForBoosting,
  isDateInHolidayWindow,
  getPreviousYearHoliday,
  getHolidayDateRange,
} from './holidayCalendar'

export {
  type HolidaySensitivityResult,
  HOLIDAY_BOOST_AMOUNT,
  DEFAULT_BUFFER_DAYS,
  calculateHolidaySensitivity,
  calculateHolidaySensitivityBatch,
} from './calculateHolidaySensitivity'
