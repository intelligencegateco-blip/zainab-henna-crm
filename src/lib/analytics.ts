import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import type { CrmSnapshot, LeadStatus } from '../types/models';
import { EVENT_LABEL, LEAD_STATUSES, PIPELINE_STAGES, SOURCE_LABEL } from './constants';
import { now, todayISO } from './format';
import { inRange, type ResolvedRange } from './dateRange';
import {
  bookingBalance,
  bookingRevenue,
  buildContactViews,
  groupBy,
  indexById,
  isBookedStatus,
  isUpcomingBooking,
  round2,
  type ContactView,
} from './selectors';

export interface Datum {
  key: string;
  label: string;
  value: number;
}

export interface TimePoint {
  key: string;
  label: string;
  value: number;
}

const toDate = (v: string) => (v.length === 10 ? parseISO(v) : new Date(v));

function countBy<T>(items: T[], key: (i: T) => string, labels: Record<string, string>, order?: string[]): Datum[] {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(key(i), (counts.get(key(i)) ?? 0) + 1);
  const keys = order ?? [...counts.keys()];
  return keys
    .map((k) => ({ key: k, label: labels[k] ?? k, value: counts.get(k) ?? 0 }))
    .filter((d) => (order ? true : d.value > 0));
}

function sumBy<T>(items: T[], key: (i: T) => string, amount: (i: T) => number, labels: Record<string, string>): Datum[] {
  const sums = new Map<string, number>();
  for (const i of items) sums.set(key(i), (sums.get(key(i)) ?? 0) + amount(i));
  return [...sums.entries()]
    .map(([k, v]) => ({ key: k, label: labels[k] ?? k, value: round2(v) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
}

const sortDesc = (d: Datum[]) => [...d].sort((a, b) => b.value - a.value);

/** Choose day / week / month buckets based on how long the range is. */
function buildBuckets(range: ResolvedRange | null, fallbackStart: Date) {
  const from = range ? range.from : startOfMonth(fallbackStart);
  const to = range ? range.to : now();
  const span = differenceInCalendarDays(to, from);
  const unit: 'day' | 'week' | 'month' = span <= 31 ? 'day' : span <= 120 ? 'week' : 'month';
  const buckets: { start: Date; key: string; label: string }[] = [];
  let cursor =
    unit === 'day' ? startOfDay(from) : unit === 'week' ? startOfWeek(from, { weekStartsOn: 1 }) : startOfMonth(from);
  let guard = 0;
  while (cursor <= to && guard++ < 400) {
    buckets.push({
      start: cursor,
      key: format(cursor, 'yyyy-MM-dd'),
      label: unit === 'month' ? format(cursor, 'MMM yy') : format(cursor, 'd MMM'),
    });
    cursor = unit === 'day' ? addDays(cursor, 1) : unit === 'week' ? addWeeks(cursor, 1) : addMonths(cursor, 1);
  }
  const bucketFor = (d: Date) => {
    for (let i = buckets.length - 1; i >= 0; i--) if (d >= buckets[i].start) return buckets[i].key;
    return undefined;
  };
  return { unit, buckets, bucketFor };
}

function series<T>(
  items: T[],
  date: (i: T) => string,
  amount: (i: T) => number,
  range: ResolvedRange | null,
  fallbackStart: Date,
) {
  const { unit, buckets, bucketFor } = buildBuckets(range, fallbackStart);
  const totals = new Map<string, number>(buckets.map((b) => [b.key, 0]));
  for (const i of items) {
    const k = bucketFor(toDate(date(i)));
    if (k && totals.has(k)) totals.set(k, (totals.get(k) ?? 0) + amount(i));
  }
  return {
    unit,
    points: buckets.map((b) => ({ key: b.key, label: b.label, value: round2(totals.get(b.key) ?? 0) })),
  };
}

export function computeAnalytics(snapshot: CrmSnapshot, range: ResolvedRange | null) {
  const views = buildContactViews(snapshot);
  const services = indexById(snapshot.services);
  const serviceLabels = Object.fromEntries(snapshot.services.map((s) => [s.id, s.name]));
  const today = todayISO();

  const earliest = [...snapshot.contacts.map((c) => c.createdAt), ...snapshot.bookings.map((b) => b.date)]
    .map(toDate)
    .reduce((min, d) => (d < min ? d : min), now());

  // ---- Leads (by created date) ----
  const leads = views.filter((c) => !c.archived && inRange(c.createdAt, range));
  const converted = leads.filter((c) => c.status === 'customer');
  const leadsBySource = sortDesc(countBy(leads, (c) => c.source, SOURCE_LABEL));
  const leadsByStatus = countBy(
    leads,
    (c) => c.status,
    Object.fromEntries(LEAD_STATUSES.map((s) => [s.value, s.label])),
    LEAD_STATUSES.filter((s) => s.value !== 'archived').map((s) => s.value),
  );
  const leadsByStage = countBy(
    leads,
    (c) => c.stage,
    Object.fromEntries(PIPELINE_STAGES.map((s) => [s.value, s.label])),
    PIPELINE_STAGES.map((s) => s.value),
  );
  const leadsOverTime = series(leads, (c) => c.createdAt, () => 1, range, earliest);

  // ---- Bookings (by appointment date) ----
  const bookings = snapshot.bookings.filter((b) => inRange(b.date, range));
  const completed = bookings.filter((b) => b.status === 'completed');
  const cancelled = bookings.filter((b) => b.status === 'cancelled' || b.status === 'no_show');
  const upcoming = bookings.filter((b) => isUpcomingBooking(b, today));
  const nonCancelled = bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'no_show');

  const revenue = round2(completed.reduce((s, b) => s + bookingRevenue(b), 0));
  const outstanding = round2(bookings.reduce((s, b) => s + bookingBalance(b), 0));

  // ---- Customers ----
  const customers = views.filter((c) => c.status === 'customer' && !c.archived);
  const firstBookedDate = (c: ContactView) =>
    c.bookings
      .filter(isBookedStatus)
      .map((b) => b.date)
      .sort()[0];
  const newCustomers = customers.filter((c) => inRange(firstBookedDate(c), range));
  const returningCustomers = customers.filter(
    (c) => c.bookings.filter(isBookedStatus).length >= 2 && c.bookings.some((b) => isBookedStatus(b) && inRange(b.date, range)),
  );
  const activeCustomers = customers.filter((c) => c.bookings.some((b) => isBookedStatus(b) && inRange(b.date, range)));

  return {
    leads: {
      total: leads.length,
      converted: converted.length,
      conversionRate: leads.length ? converted.length / leads.length : 0,
      bySource: leadsBySource,
      byStatus: leadsByStatus,
      byStage: leadsByStage,
      overTime: leadsOverTime,
    },
    bookings: {
      total: bookings.length,
      upcoming: upcoming.length,
      completed: completed.length,
      cancelled: cancelled.length,
      byService: sortDesc(countBy(nonCancelled, (b) => b.serviceId, serviceLabels)),
      byEventType: sortDesc(countBy(nonCancelled, (b) => b.eventType, EVENT_LABEL)),
    },
    revenue: {
      total: revenue,
      byPeriod: series(completed, (b) => b.date, bookingRevenue, range, earliest),
      byService: sumBy(completed, (b) => b.serviceId, bookingRevenue, serviceLabels),
      averageBookingValue: completed.length ? round2(revenue / completed.length) : 0,
      outstanding,
      outstandingCount: bookings.filter((b) => bookingBalance(b) > 0).length,
    },
    customers: {
      total: customers.length,
      active: activeCustomers.length,
      new: newCustomers.length,
      returning: returningCustomers.length,
      byLocation: sortDesc(countBy(activeCustomers.length ? activeCustomers : [], (c) => c.location, {})),
      bySource: sortDesc(countBy(activeCustomers, (c) => c.source, SOURCE_LABEL)),
    },
    serviceName: (id: string) => services.get(id)?.name ?? 'Unknown service',
  };
}

export type Analytics = ReturnType<typeof computeAnalytics>;

/** Headline numbers for the dashboard (not range-filtered unless noted). */
export function computeDashboard(snapshot: CrmSnapshot) {
  const views = buildContactViews(snapshot).filter((c) => !c.archived);
  const today = todayISO();
  const monthStart = format(startOfMonth(now()), 'yyyy-MM-dd');
  const thirtyDaysAgo = addDays(startOfDay(now()), -29).toISOString();

  const byStatus = groupBy(views, (c) => c.status);
  const count = (s: LeadStatus) => byStatus.get(s)?.length ?? 0;
  const bookings = snapshot.bookings;
  const completed = bookings.filter((b) => b.status === 'completed');
  const revenue = round2(completed.reduce((s, b) => s + b.price, 0));
  const revenueThisMonth = round2(
    completed.filter((b) => b.date >= monthStart && b.date <= today).reduce((s, b) => s + b.price, 0),
  );
  const last30Start = format(addDays(startOfDay(now()), -29), 'yyyy-MM-dd');
  const revenueLast30 = round2(
    completed.filter((b) => b.date >= last30Start && b.date <= today).reduce((s, b) => s + b.price, 0),
  );
  const upcoming = bookings
    .filter((b) => isUpcomingBooking(b, today))
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  const requested = new Map<string, number>();
  for (const c of views) if (c.serviceId) requested.set(c.serviceId, (requested.get(c.serviceId) ?? 0) + 1);
  for (const b of bookings) requested.set(b.serviceId, (requested.get(b.serviceId) ?? 0) + 1);
  const serviceNames = indexById(snapshot.services);
  const topServices: Datum[] = [...requested.entries()]
    .map(([key, value]) => ({ key, label: serviceNames.get(key)?.name ?? 'Unknown', value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const followUpsDue = snapshot.followUps
    .filter((f) => !f.completedAt && f.dueDate <= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return {
    totalCustomers: count('customer'),
    newLeads: count('new'),
    newLeadsLast30: views.filter((c) => c.createdAt >= thirtyDaysAgo).length,
    activeLeads: count('active'),
    upcomingBookings: upcoming.length,
    completedBookings: completed.length,
    cancelledBookings: bookings.filter((b) => b.status === 'cancelled' || b.status === 'no_show').length,
    revenue,
    revenueThisMonth,
    revenueLast30,
    outstanding: round2(bookings.reduce((s, b) => s + bookingBalance(b), 0)),
    conversionRate: views.length ? count('customer') / views.length : 0,
    pipelineValue: round2(
      views.filter((c) => c.status === 'new' || c.status === 'active').reduce((s, c) => s + c.estimatedValue, 0),
    ),
    topServices,
    upcoming,
    todays: upcoming.filter((b) => b.date === today),
    followUpsDue,
    recentActivity: [...snapshot.interactions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8),
  };
}
