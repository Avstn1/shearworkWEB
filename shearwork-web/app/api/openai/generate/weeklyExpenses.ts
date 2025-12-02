export interface RecurringExpense {
  id: number;
  user_id: string;
  label: string;
  amount: number;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  start_date: string; // ISO date string
  end_date?: string;  // ISO date string or null
  weekly_days?: string[]; // ["Sun", "Mon", "Tue", ...]
  monthly_day?: number;
  yearly_month?: number;
  yearly_day?: number;
}

export interface WeeklyExpenseDetail {
  label: string;
  frequency: string;
  date: Date;
  amount: number;
}

export interface WeeklyBreakdown {
  expenses: WeeklyExpenseDetail[];
  total: number;
}

export type WeeklyData = {
  [weekNumber: number]: WeeklyBreakdown;
};

// Map string day to JS number
const DAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Get week number for a specific date according to first Monday rule
 * Returns 0 if date is before the first Monday of the month
 */
export function getWeekNumberForDate(date: Date, year: number, month: number): number {
  const firstOfMonth = new Date(year, month - 1, 1);
  const day = firstOfMonth.getDay();
  const offset = (8 - day) % 7; // distance to first Monday
  const firstMonday = new Date(firstOfMonth);
  firstMonday.setDate(firstOfMonth.getDate() + offset);

  if (date < firstMonday) return 0;

  const diffDays = Math.floor((date.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Get all dates in a month that match a weekday number
 */
export function getAllWeekdayDates(year: number, month: number, weekdayNum: number): Date[] {
  const dates: Date[] = [];
  const d = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();

  for (let i = 1; i <= lastDay; i++) {
    d.setDate(i);
    if (d.getDay() === weekdayNum) {
      dates.push(new Date(d));
    }
  }

  return dates;
}

/**
 * Get weekly breakdown for all expenses in a month
 */
export function getWeeklyBreakdown(expenses: RecurringExpense[], year: number, month: number): WeeklyData {
  const weeklyData: WeeklyData = {
    1: { expenses: [], total: 0 },
    2: { expenses: [], total: 0 },
    3: { expenses: [], total: 0 },
    4: { expenses: [], total: 0 },
    5: { expenses: [], total: 0 },
  };

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  for (const e of expenses) {
    const startDate = new Date(e.start_date);
    const endDate = e.end_date ? new Date(e.end_date) : null;

    if (startDate > monthEnd) continue;
    if (endDate && endDate < monthStart) continue;

    switch (e.frequency) {
      case "daily":
        for (let d = new Date(Math.max(startDate.getTime(), monthStart.getTime())); d <= monthEnd; d.setDate(d.getDate() + 1)) {
          const w = getWeekNumberForDate(d, year, month);
          if (w > 0) {
            weeklyData[w].expenses.push({
              label: e.label,
              frequency: e.frequency,
              date: new Date(d),
              amount: Number(e.amount),
            });
            weeklyData[w].total += Number(e.amount);
          }
        }
        break;

      case "weekly":
        if (e.weekly_days?.length) {
          for (const dayStr of e.weekly_days) {
            const weekdayNum = DAY_MAP[dayStr];
            if (weekdayNum === undefined) continue;

            const dates = getAllWeekdayDates(year, month, weekdayNum);
            for (const d of dates) {
              if (d < startDate) continue;
              if (endDate && d > endDate) continue;

              const w = getWeekNumberForDate(d, year, month);
              if (w > 0) {
                weeklyData[w].expenses.push({
                  label: e.label,
                  frequency: e.frequency,
                  date: new Date(d),
                  amount: Number(e.amount),
                });
                weeklyData[w].total += Number(e.amount);
              }
            }
          }
        }
        break;

      case "monthly":
        if (e.monthly_day) {
          const date = new Date(year, month - 1, e.monthly_day);
          if (date >= startDate && (!endDate || date <= endDate)) {
            const w = getWeekNumberForDate(date, year, month);
            if (w > 0) {
              weeklyData[w].expenses.push({
                label: e.label,
                frequency: e.frequency,
                date,
                amount: Number(e.amount),
              });
              weeklyData[w].total += Number(e.amount);
            }
          }
        }
        break;

      case "yearly":
        if ((e.yearly_month ?? -1) + 1 === month && e.yearly_day) {
          const date = new Date(year, month - 1, e.yearly_day);
          if (date >= startDate && (!endDate || date <= endDate)) {
            const w = getWeekNumberForDate(date, year, month);
            if (w > 0) {
              weeklyData[w].expenses.push({
                label: e.label,
                frequency: e.frequency,
                date,
                amount: Number(e.amount),
              });
              weeklyData[w].total += Number(e.amount);
            }
          }
        }
        break;
    }
  }

  return weeklyData;
}
