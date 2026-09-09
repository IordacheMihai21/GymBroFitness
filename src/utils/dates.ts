import type { DayOfWeek } from '@/types';

export const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Mon',
  1: 'Tue',
  2: 'Wed',
  3: 'Thu',
  4: 'Fri',
  5: 'Sat',
  6: 'Sun',
};

export function nowIso(): string {
  return new Date().toISOString();
}

/** Monday-based day index for a date. */
export function dayOfWeek(date: Date): DayOfWeek {
  return ((date.getDay() + 6) % 7) as DayOfWeek;
}

/** ISO date (YYYY-MM-DD) of the Monday starting the week containing `date`. */
export function weekStartIso(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - dayOfWeek(d));
  d.setHours(0, 0, 0, 0);
  return toDateOnly(d);
}

export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysAgoIso(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    return `${h}h ${minutes % 60}m`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Late night session?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
