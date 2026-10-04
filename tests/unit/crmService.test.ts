import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedData } from '../../src/data/seed';
import { computeAnalytics, computeDashboard } from '../../src/lib/analytics';
import { resolveRange } from '../../src/lib/dateRange';
import { setClock } from '../../src/lib/format';
import { bookingBalance, buildContactViews, deriveStatus } from '../../src/lib/selectors';
import { ValidationError } from '../../src/lib/validation';
import { CrmService } from '../../src/services/crmService';
import { LocalRepository, MemoryStore } from '../../src/services/localRepository';
import { ConflictError } from '../../src/services/repository';

const NOW = new Date('2026-10-04T12:00:00');

const lead = {
  fullName: 'Test Cliente',
  phone: '+58 412-555-0000',
  email: '',
  instagram: 'test.cliente',
  location: 'Caracas',
  source: 'instagram' as const,
  serviceId: 'S-01',
  eventType: 'wedding' as const,
  eventDate: '2026-11-20',
  groupSize: 1,
  estimatedValue: 180,
  stage: 'new_inquiry' as const,
  notes: '',
};

const bookingValues = (contactId: string) => ({
  contactId,
  serviceId: 'S-01',
  eventType: 'wedding',
  date: '2026-11-20',
  startTime: '10:00',
  durationMinutes: 240,
  location: 'Altamira, Caracas',
  groupSize: 1,
  price: 180,
  deposit: 54,
  balancePaid: false,
  status: 'confirmed',
  notes: '',
});

let service: CrmService;
let repo: LocalRepository;

beforeEach(() => {
  setClock(() => NOW);
  repo = new LocalRepository({ storage: new MemoryStore(), seed: () => createSeedData(NOW) });
  service = new CrmService(repo);
});

describe('seed data', () => {
  it('has enough realistic records to demo every screen', async () => {
    const snap = await repo.getSnapshot();
    expect(snap.contacts.length).toBeGreaterThanOrEqual(20);
    expect(snap.contacts.length).toBeLessThanOrEqual(30);
    const statuses = new Set(snap.bookings.map((b) => b.status));
    for (const s of ['pending', 'confirmed', 'completed', 'cancelled', 'no_show']) expect(statuses.has(s as never)).toBe(true);
    expect(new Set(snap.contacts.map((c) => c.source)).size).toBe(7);
    expect(new Set(snap.contacts.map((c) => c.stage)).size).toBe(10);
    // no timestamps in the future
    for (const i of snap.interactions) expect(new Date(i.occurredAt) <= NOW).toBe(true);
    // every booking points at a real contact and service
    const ids = new Set(snap.contacts.map((c) => c.id));
    const sids = new Set(snap.services.map((s) => s.id));
    for (const b of snap.bookings) {
      expect(ids.has(b.contactId)).toBe(true);
      expect(sids.has(b.serviceId)).toBe(true);
      expect(b.deposit).toBeLessThanOrEqual(b.price);
    }
  });
});

describe('leads', () => {
  it('creates a lead with a follow-up and a log entry', async () => {
    const c = await service.createLead(lead, { dueDate: '2026-10-05', note: 'Call her' });
    const snap = await repo.getSnapshot();
    expect(c.id).toMatch(/^C-\d+$/);
    expect(c.instagram).toBe('@test.cliente');
    expect(snap.followUps.some((f) => f.contactId === c.id && f.dueDate === '2026-10-05')).toBe(true);
    expect(snap.interactions.some((i) => i.contactId === c.id && i.type === 'system')).toBe(true);
    expect(deriveStatus(c, [])).toBe('new');
  });

  it('rejects invalid input with field messages', async () => {
    await expect(service.createLead({ ...lead, fullName: 'A', phone: 'abc', email: 'nope' })).rejects.toBeInstanceOf(
      ValidationError,
    );
    try {
      await service.createLead({ ...lead, fullName: 'A', phone: 'abc', email: 'nope' });
    } catch (e) {
      const fields = (e as ValidationError).fields;
      expect(Object.keys(fields)).toEqual(expect.arrayContaining(['fullName', 'phone', 'email']));
    }
  });

  it('does not change the stage through a normal edit', async () => {
    const c = await service.createLead(lead);
    const updated = await service.updateLead(c.id, { ...lead, fullName: 'Renamed', stage: 'completed' });
    expect(updated.fullName).toBe('Renamed');
    expect(updated.stage).toBe('new_inquiry');
  });
});

describe('pipeline', () => {
  it('requires booking details before Booking confirmed', async () => {
    const c = await service.createLead(lead);
    await service.moveStage(c.id, 'contacted');
    await expect(service.moveStage(c.id, 'booking_confirmed')).rejects.toBeInstanceOf(ConflictError);
  });

  it('converts a lead into a confirmed booking and customer', async () => {
    const c = await service.createLead(lead);
    const b = await service.convertToBooking(c.id, bookingValues(c.id));
    const snap = await repo.getSnapshot();
    const contact = snap.contacts.find((x) => x.id === c.id)!;
    expect(contact.stage).toBe('booking_confirmed');
    expect(b.status).toBe('confirmed');
    expect(bookingBalance(b)).toBe(126);
    const view = buildContactViews(snap).find((v) => v.id === c.id)!;
    expect(view.status).toBe('customer');
    expect(view.nextBooking?.id).toBe(b.id);
  });

  it('moving to Completed completes the booking and counts revenue', async () => {
    const c = await service.createLead(lead);
    const b = await service.convertToBooking(c.id, bookingValues(c.id));
    const before = computeDashboard(await repo.getSnapshot());
    await service.moveStage(c.id, 'completed');
    const snap = await repo.getSnapshot();
    expect(snap.bookings.find((x) => x.id === b.id)!.status).toBe('completed');
    const after = computeDashboard(snap);
    expect(after.revenue).toBe(before.revenue + 180);
    expect(after.completedBookings).toBe(before.completedBookings + 1);
  });

  it('cancelling a booking moves the lead to Cancelled', async () => {
    const c = await service.createLead(lead);
    const b = await service.convertToBooking(c.id, bookingValues(c.id));
    await service.setBookingStatus(b.id, 'cancelled');
    const snap = await repo.getSnapshot();
    expect(snap.contacts.find((x) => x.id === c.id)!.stage).toBe('cancelled');
    expect(bookingBalance(snap.bookings.find((x) => x.id === b.id)!)).toBe(0);
  });

  it('promotes a pending booking when the lead is confirmed', async () => {
    const snap = await repo.getSnapshot();
    const pendingContact = snap.contacts.find((c) => c.stage === 'deposit_pending')!;
    await service.moveStage(pendingContact.id, 'booking_confirmed');
    const after = await repo.getSnapshot();
    const booking = after.bookings.find((b) => b.contactId === pendingContact.id && b.status === 'confirmed');
    expect(booking).toBeDefined();
  });
});

describe('bookings', () => {
  it('rejects a deposit larger than the price', async () => {
    const c = await service.createLead(lead);
    await expect(service.createBooking({ ...bookingValues(c.id), deposit: 500 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('manual confirmed booking moves an open lead forward', async () => {
    const c = await service.createLead(lead);
    await service.createBooking({ ...bookingValues(c.id), origin: 'manual' });
    const snap = await repo.getSnapshot();
    expect(snap.contacts.find((x) => x.id === c.id)!.stage).toBe('booking_confirmed');
  });
});

describe('website intake', () => {
  it('creates a new website lead with a follow-up for today', async () => {
    const c = await service.submitWebsiteInquiry({
      fullName: 'Web Visitor',
      phone: '+58 414 555 0001',
      serviceId: 'S-03',
      eventType: 'party',
      groupSize: 10,
      message: 'Henna for 10 friends?',
    });
    expect(c.source).toBe('website');
    expect(c.stage).toBe('new_inquiry');
    expect(c.estimatedValue).toBe(150);
    const snap = await repo.getSnapshot();
    expect(snap.followUps.some((f) => f.contactId === c.id && f.dueDate === '2026-10-04')).toBe(true);
  });
});

describe('analytics', () => {
  it('filters by date range and stays internally consistent', async () => {
    const snap = await repo.getSnapshot();
    const all = computeAnalytics(snap, null);
    const month = computeAnalytics(snap, resolveRange({ preset: 'last30' }));
    expect(all.leads.total).toBe(snap.contacts.length);
    expect(month.leads.total).toBeLessThan(all.leads.total);
    expect(all.leads.bySource.reduce((s, d) => s + d.value, 0)).toBe(all.leads.total);
    expect(all.revenue.byService.reduce((s, d) => s + d.value, 0)).toBeCloseTo(all.revenue.total);
    expect(all.revenue.byPeriod.points.reduce((s, d) => s + d.value, 0)).toBeCloseTo(all.revenue.total);
    expect(all.customers.returning).toBeGreaterThan(0);
  });

  it('custom ranges accept reversed dates', () => {
    const r = resolveRange({ preset: 'custom', from: '2026-10-10', to: '2026-10-01' })!;
    expect(r.from < r.to).toBe(true);
  });
});
