import type {
  Booking,
  Contact,
  CrmSnapshot,
  FollowUp,
  ID,
  ISODate,
  LeadStatus,
  Service,
} from '../types/models';
import { todayISO } from './format';

/** Bookings that count as "the customer actually booked". */
export const isBookedStatus = (b: Booking) => b.status === 'confirmed' || b.status === 'completed';
export const isOpenBooking = (b: Booking) => b.status === 'pending' || b.status === 'confirmed';

/** Earned revenue: completed services at their agreed price. */
export const bookingRevenue = (b: Booking) => (b.status === 'completed' ? b.price : 0);

/** What the customer still owes. Cancelled and no-show bookings owe nothing further. */
export function bookingBalance(b: Booking): number {
  if (b.status === 'cancelled' || b.status === 'no_show' || b.balancePaid) return 0;
  return Math.max(0, round2(b.price - b.deposit));
}

export const bookingCollected = (b: Booking) => (b.balancePaid ? b.price : Math.min(b.deposit, b.price));

export function isUpcomingBooking(b: Booking, today: ISODate = todayISO()): boolean {
  return isOpenBooking(b) && b.date >= today;
}

/**
 * Lead status is derived so it can never drift out of sync with the pipeline:
 * archived wins, then anyone with a confirmed/completed booking is a customer.
 */
export function deriveStatus(contact: Contact, bookings: Booking[]): LeadStatus {
  if (contact.archived) return 'archived';
  if (bookings.some(isBookedStatus) || contact.stage === 'booking_confirmed' || contact.stage === 'completed') {
    return 'customer';
  }
  if (contact.stage === 'lost' || contact.stage === 'cancelled') return 'lost';
  if (contact.stage === 'new_inquiry') return 'new';
  return 'active';
}

export interface ContactView extends Contact {
  status: LeadStatus;
  serviceName?: string;
  bookings: Booking[];
  openFollowUps: FollowUp[];
  nextFollowUpDate?: ISODate;
  totalSpent: number;
  outstanding: number;
  nextBooking?: Booking;
}

export function indexById<T extends { id: ID }>(items: T[]): Map<ID, T> {
  return new Map(items.map((i) => [i.id, i]));
}

export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export function buildContactViews(snapshot: CrmSnapshot): ContactView[] {
  const services = indexById(snapshot.services);
  const bookingsByContact = groupBy(snapshot.bookings, (b) => b.contactId);
  const followUpsByContact = groupBy(
    snapshot.followUps.filter((f) => !f.completedAt),
    (f) => f.contactId,
  );
  const today = todayISO();

  return snapshot.contacts.map((c) => {
    const bookings = [...(bookingsByContact.get(c.id) ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    const openFollowUps = [...(followUpsByContact.get(c.id) ?? [])].sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate),
    );
    const upcoming = bookings.filter((b) => isUpcomingBooking(b, today)).sort((a, b) => a.date.localeCompare(b.date));
    return {
      ...c,
      status: deriveStatus(c, bookings),
      serviceName: c.serviceId ? services.get(c.serviceId)?.name : undefined,
      bookings,
      openFollowUps,
      nextFollowUpDate: openFollowUps[0]?.dueDate,
      totalSpent: round2(bookings.reduce((sum, b) => sum + bookingRevenue(b), 0)),
      outstanding: round2(bookings.reduce((sum, b) => sum + bookingBalance(b), 0)),
      nextBooking: upcoming[0],
    };
  });
}

/** The pending/confirmed booking most likely tied to the contact's current deal. */
export function openBookingFor(contactId: ID, bookings: Booking[]): Booking | undefined {
  return bookings
    .filter((b) => b.contactId === contactId && isOpenBooking(b))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

export function suggestedPrice(service: Service | undefined, groupSize: number): number {
  if (!service) return 0;
  return service.priceUnit === 'per_person' ? round2(service.basePrice * Math.max(1, groupSize)) : service.basePrice;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
