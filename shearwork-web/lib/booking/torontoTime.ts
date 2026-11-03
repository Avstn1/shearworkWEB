// /lib/booking/torontoTime.ts

/**
 * Business-time helpers. Barbers' calendars run in Toronto time, but the server runs in
 * UTC, so anything like "8am", "today" or "this week" must be computed in this zone
 * explicitly rather than with server-local Date methods.
 */
export const BUSINESS_TIME_ZONE = 'America/Toronto'

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

function zonedParts(ms: number, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

/** Offset of `timeZone` from UTC at instant `ms`, in ms (e.g. -5h for Toronto in winter). */
function zoneOffsetMs(ms: number, timeZone: string): number {
  const p = zonedParts(ms, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Today's date (YYYY-MM-DD) and minutes since midnight in business time. */
export function businessNow(now: Date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const p = zonedParts(now.getTime(), timeZone)
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    minutes: p.hour * 60 + p.minute,
  }
}

/** UTC epoch ms for a wall-clock time on `day` (YYYY-MM-DD) in business time. */
export function businessTimeToUtcMs(day: string, minutesOfDay: number, timeZone = BUSINESS_TIME_ZONE): number {
  const [y, m, d] = day.split('-').map(Number)
  const asUtc = Date.UTC(y, m - 1, d, 0, minutesOfDay)
  const firstGuess = asUtc - zoneOffsetMs(asUtc, timeZone)
  // Re-check once in case the guess crossed a DST change
  return asUtc - zoneOffsetMs(firstGuess, timeZone)
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Monday..Sunday (YYYY-MM-DD) of the business-time week containing `now`, shifted by `weekOffset` weeks. */
export function businessWeekRange(now: Date = new Date(), weekOffset = 0, timeZone = BUSINESS_TIME_ZONE) {
  const today = businessNow(now, timeZone).date
  const [y, m, d] = today.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  const start = addDays(today, (weekday === 0 ? -6 : 1 - weekday) + weekOffset * 7)
  return { startDate: start, endDate: addDays(start, 6) }
}

/** Every date from `start` to `end` inclusive (YYYY-MM-DD). */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = []
  for (let day = start; day <= end; day = addDays(day, 1)) out.push(day)
  return out
}
