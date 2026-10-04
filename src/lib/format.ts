import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import type { CurrencyDisplay, ISODate, Settings } from '../types/models';

// ---------- Clock (overridable in tests) ----------

let clock: () => Date = () => new Date();
export const now = () => clock();
export const setClock = (fn: () => Date) => {
  clock = fn;
};
export const todayISO = (): ISODate => format(now(), 'yyyy-MM-dd');
export const nowISO = () => now().toISOString();

// ---------- Money ----------

const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const vesFmt = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export function formatUSD(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? usdWhole.format(value) : usdCents.format(value);
}

export function formatVES(usd: number, rate: number): string {
  if (!Number.isFinite(usd) || !Number.isFinite(rate)) return '—';
  return `Bs ${vesFmt.format(usd * rate)}`;
}

export function formatCompactUSD(value: number): string {
  return `$${compactFmt.format(value)}`;
}

/** Primary + optional secondary representation, based on the Settings display mode. */
export function moneyParts(
  usd: number,
  settings: Pick<Settings, 'exchangeRate' | 'currencyDisplay'>,
): { primary: string; secondary?: string } {
  const mode: CurrencyDisplay = settings.currencyDisplay;
  if (mode === 'VES') return { primary: formatVES(usd, settings.exchangeRate) };
  if (mode === 'both') return { primary: formatUSD(usd), secondary: formatVES(usd, settings.exchangeRate) };
  return { primary: formatUSD(usd) };
}

export function formatPercent(ratio: number, digits = 0): string {
  if (!Number.isFinite(ratio)) return '0%';
  return `${(ratio * 100).toFixed(digits)}%`;
}

// ---------- Dates ----------

export function safeParse(value?: string): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

export function formatDate(value?: string, pattern = 'd MMM yyyy'): string {
  const d = safeParse(value);
  return d ? format(d, pattern) : '—';
}

export function formatDateTime(value?: string): string {
  return formatDate(value, 'd MMM yyyy, h:mm a');
}

export function formatTime(hhmm?: string): string {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date(2000, 0, 1, h, m);
  return format(d, 'h:mm a');
}

/** "Today", "Tomorrow", "in 5 days", "3 days ago" relative to the clock. */
export function relativeDay(value?: string): string {
  const d = safeParse(value);
  if (!d) return '—';
  const diff = differenceInCalendarDays(d, now());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1) return diff < 14 ? `In ${diff} days` : format(d, 'd MMM');
  return -diff < 14 ? `${-diff} days ago` : format(d, 'd MMM');
}

export function daysFromToday(value?: string): number | null {
  const d = safeParse(value);
  return d ? differenceInCalendarDays(d, now()) : null;
}

export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Something went wrong.';
}

/** Lowercase and strip accents so "Gutierrez" finds "Gutiérrez". */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
