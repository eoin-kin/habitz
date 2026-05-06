import { format, subDays, parseISO, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';
import { HabitCompletion } from '../types';

export function calculateCurrentStreak(completions: HabitCompletion[]): number {
  if (!completions.length) return 0;

  const uniqueDates = [...new Set(completions.map((c) => c.completed_at))].sort().reverse();

  // Streak breaks if most recent completion isn't today or yesterday
  const latest = parseISO(uniqueDates[0]);
  if (!isToday(latest) && !isYesterday(latest)) return 0;

  let streak = 0;
  let checkDate = isToday(latest) ? new Date() : subDays(new Date(), 1);

  for (const dateStr of uniqueDates) {
    const expected = format(checkDate, 'yyyy-MM-dd');
    if (dateStr === expected) {
      streak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  return streak;
}

export function calculateLongestStreak(completions: HabitCompletion[]): number {
  if (!completions.length) return 0;

  const uniqueDates = [...new Set(completions.map((c) => c.completed_at))].sort();

  let longest = 1;
  let current = 1;

  for (let i = 1; i < uniqueDates.length; i++) {
    const diff = differenceInCalendarDays(parseISO(uniqueDates[i]), parseISO(uniqueDates[i - 1]));
    if (diff === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }

  return longest;
}

export function isCompletedOnDate(completions: HabitCompletion[], date: Date): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  return completions.some((c) => c.completed_at === dateStr);
}

export function getCompletionRate(completions: HabitCompletion[], days: number): number {
  const start = subDays(new Date(), days - 1);
  const relevant = completions.filter((c) => parseISO(c.completed_at) >= start);
  const uniqueDays = new Set(relevant.map((c) => c.completed_at)).size;
  return Math.round((uniqueDays / days) * 100);
}
