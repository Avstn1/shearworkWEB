import { describe, expect, it } from 'vitest'
import { businessNow, businessTimeToUtcMs, businessWeekRange, datesBetween } from '@/lib/booking/torontoTime'

// These hold regardless of the machine's time zone (the server runs in UTC).
describe('business time (America/Toronto)', () => {
  it('turns a Toronto wall-clock time into the right instant (winter, EST)', () => {
    expect(businessTimeToUtcMs('2026-11-03', 8 * 60)).toBe(Date.parse('2026-11-03T13:00:00Z'))
    expect(businessTimeToUtcMs('2026-11-03', 20 * 60)).toBe(Date.parse('2026-11-04T01:00:00Z'))
  })

  it('turns a Toronto wall-clock time into the right instant (summer, EDT)', () => {
    expect(businessTimeToUtcMs('2026-07-03', 8 * 60)).toBe(Date.parse('2026-07-03T12:00:00Z'))
  })

  it('a 4pm Toronto slot falls inside the 8am–8pm working window', () => {
    const slot = Date.parse('2026-11-03T16:00:00-05:00')
    expect(slot).toBeGreaterThanOrEqual(businessTimeToUtcMs('2026-11-03', 8 * 60))
    expect(slot).toBeLessThan(businessTimeToUtcMs('2026-11-03', 20 * 60))
  })

  it('reports Toronto date and minutes, not UTC', () => {
    // 03:30 UTC Monday = 22:30 Sunday in Toronto
    expect(businessNow(new Date('2026-11-09T03:30:00Z'))).toEqual({ date: '2026-11-08', minutes: 22 * 60 + 30 })
  })

  it('weeks run Monday to Sunday in Toronto time', () => {
    const week = { startDate: '2026-11-02', endDate: '2026-11-08' }
    expect(businessWeekRange(new Date('2026-11-04T15:00:00Z'))).toEqual(week) // Wednesday
    expect(businessWeekRange(new Date('2026-11-02T05:30:00Z'))).toEqual(week) // Monday 00:30
    expect(businessWeekRange(new Date('2026-11-09T03:30:00Z'))).toEqual(week) // Sunday 22:30
    expect(businessWeekRange(new Date('2026-11-04T15:00:00Z'), 1)).toEqual({ startDate: '2026-11-09', endDate: '2026-11-15' })
  })

  it('lists the days in a range inclusively', () => {
    expect(datesBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })
})
