import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from 'date-fns';
import { now } from './format';

export type RangePreset = 'today' | 'week' | 'month' | 'last30' | 'last90' | 'year' | 'all' | 'custom';

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'last90', label: 'Last 90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

export interface DateRangeValue {
  preset: RangePreset;
  /** YYYY-MM-DD, used when preset is custom */
  from?: string;
  to?: string;
}

/** Inclusive [from, to] range, or null for all time. */
export interface ResolvedRange {
  from: Date;
  to: Date;
}

export function resolveRange(value: DateRangeValue): ResolvedRange | null {
  const today = now();
  switch (value.preset) {
    case 'today':
      return { from: startOfDay(today), to: endOfDay(today) };
    case 'week':
      return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) };
    case 'month':
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case 'last30':
      return { from: startOfDay(subDays(today, 29)), to: endOfDay(today) };
    case 'last90':
      return { from: startOfDay(subDays(today, 89)), to: endOfDay(today) };
    case 'year':
      return { from: startOfYear(today), to: endOfYear(today) };
    case 'custom': {
      const from = value.from ? parseISO(value.from) : null;
      const to = value.to ? parseISO(value.to) : null;
      if (!from || !to || !isValid(from) || !isValid(to)) return null;
      return from <= to
        ? { from: startOfDay(from), to: endOfDay(to) }
        : { from: startOfDay(to), to: endOfDay(from) };
    }
    default:
      return null;
  }
}

/** Works for both YYYY-MM-DD and full ISO strings. */
export function inRange(value: string | undefined, range: ResolvedRange | null): boolean {
  if (!value) return false;
  if (!range) return true;
  const d = value.length === 10 ? parseISO(value) : new Date(value);
  return d >= range.from && d <= range.to;
}

export function describeRange(value: DateRangeValue): string {
  if (value.preset !== 'custom') return RANGE_PRESETS.find((p) => p.value === value.preset)?.label ?? '';
  const r = resolveRange(value);
  if (!r) return 'Custom range';
  return `${format(r.from, 'd MMM yyyy')} to ${format(r.to, 'd MMM yyyy')}`;
}
