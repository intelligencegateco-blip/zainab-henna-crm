import { createSeedData } from '../data/seed';
import { now, nowISO } from '../lib/format';
import type {
  Booking,
  BookingInput,
  Contact,
  ContactInput,
  CrmSnapshot,
  FollowUp,
  FollowUpInput,
  ID,
  Interaction,
  InteractionInput,
  Service,
  ServiceInput,
  Settings,
} from '../types/models';
import { ConflictError, NotFoundError, type CrmRepository } from './repository';

const STORAGE_KEY = 'zainab-crm:data:v1';

/** Minimal storage interface so tests can run without a browser. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

export interface LocalRepositoryOptions {
  storage?: KeyValueStore;
  latencyMs?: number;
  seed?: () => CrmSnapshot;
}

const clone = <T>(value: T): T => structuredClone(value);

/**
 * Demo data source backed by localStorage. Behaves like a remote API:
 * async, returns copies (never live references), assigns ids/timestamps.
 */
export class LocalRepository implements CrmRepository {
  private readonly storage: KeyValueStore;
  private readonly latencyMs: number;
  private readonly seed: () => CrmSnapshot;
  private cache: CrmSnapshot | null = null;

  constructor(options: LocalRepositoryOptions = {}) {
    this.storage = options.storage ?? window.localStorage;
    this.latencyMs = options.latencyMs ?? 0;
    this.seed = options.seed ?? (() => createSeedData(now()));
  }

  // ---------- internals ----------

  private async delay() {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
  }

  private load(): CrmSnapshot {
    if (this.cache) return this.cache;
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CrmSnapshot;
        if (Array.isArray(parsed.contacts) && Array.isArray(parsed.bookings) && parsed.settings) {
          this.cache = parsed;
          return parsed;
        }
      } catch {
        // Corrupt storage falls through to a fresh seed.
      }
    }
    this.cache = this.seed();
    this.persist();
    return this.cache;
  }

  private persist() {
    if (!this.cache) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch {
      throw new Error('Could not save changes: browser storage is full or blocked.');
    }
  }

  private async mutate<T>(fn: (db: CrmSnapshot) => T): Promise<T> {
    await this.delay();
    // Work on a draft so a throw halfway through leaves stored data untouched.
    const previous = this.load();
    const draft = clone(previous);
    const result = fn(draft);
    this.cache = draft;
    try {
      this.persist();
    } catch (err) {
      this.cache = previous;
      throw err;
    }
    return clone(result);
  }

  private nextId(prefix: string, items: { id: string }[], pad = 4, start = 1) {
    const max = items.reduce((m, i) => {
      const n = Number(i.id.split('-')[1]);
      return Number.isFinite(n) && n > m ? n : m;
    }, start - 1);
    return `${prefix}-${String(max + 1).padStart(pad, '0')}`;
  }

  private find<T extends { id: ID }>(items: T[], id: ID, entity: string): T {
    const item = items.find((i) => i.id === id);
    if (!item) throw new NotFoundError(entity, id);
    return item;
  }

  private remove<T extends { id: ID }>(items: T[], id: ID, entity: string) {
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) throw new NotFoundError(entity, id);
    items.splice(index, 1);
  }

  // ---------- reads ----------

  async getSnapshot(): Promise<CrmSnapshot> {
    await this.delay();
    return clone(this.load());
  }

  // ---------- contacts ----------

  createContact(input: ContactInput): Promise<Contact> {
    return this.mutate((db) => {
      const ts = nowISO();
      const contact: Contact = {
        ...input,
        archived: input.archived ?? false,
        id: this.nextId('C', db.contacts, 4, 1001),
        createdAt: ts,
        updatedAt: ts,
        stageUpdatedAt: ts,
      };
      db.contacts.push(contact);
      return contact;
    });
  }

  updateContact(id: ID, patch: Partial<Contact>): Promise<Contact> {
    return this.mutate((db) => {
      const contact = this.find(db.contacts, id, 'Customer');
      const ts = nowISO();
      if (patch.stage && patch.stage !== contact.stage) contact.stageUpdatedAt = ts;
      Object.assign(contact, { ...patch, id: contact.id, createdAt: contact.createdAt, updatedAt: ts });
      return contact;
    });
  }

  deleteContact(id: ID): Promise<void> {
    return this.mutate((db) => {
      this.remove(db.contacts, id, 'Customer');
      db.bookings = db.bookings.filter((b) => b.contactId !== id);
      db.interactions = db.interactions.filter((i) => i.contactId !== id);
      db.followUps = db.followUps.filter((f) => f.contactId !== id);
    });
  }

  // ---------- bookings ----------

  createBooking(input: BookingInput): Promise<Booking> {
    return this.mutate((db) => {
      this.find(db.contacts, input.contactId, 'Customer');
      this.find(db.services, input.serviceId, 'Service');
      const ts = nowISO();
      const booking: Booking = { ...input, id: this.nextId('B', db.bookings, 4, 2001), createdAt: ts, updatedAt: ts };
      db.bookings.push(booking);
      return booking;
    });
  }

  updateBooking(id: ID, patch: Partial<Booking>): Promise<Booking> {
    return this.mutate((db) => {
      const booking = this.find(db.bookings, id, 'Booking');
      if (patch.contactId) this.find(db.contacts, patch.contactId, 'Customer');
      if (patch.serviceId) this.find(db.services, patch.serviceId, 'Service');
      Object.assign(booking, { ...patch, id: booking.id, createdAt: booking.createdAt, updatedAt: nowISO() });
      return booking;
    });
  }

  deleteBooking(id: ID): Promise<void> {
    return this.mutate((db) => this.remove(db.bookings, id, 'Booking'));
  }

  // ---------- services ----------

  createService(input: ServiceInput): Promise<Service> {
    return this.mutate((db) => {
      const ts = nowISO();
      const service: Service = { ...input, id: this.nextId('S', db.services, 2), createdAt: ts, updatedAt: ts };
      db.services.push(service);
      return service;
    });
  }

  updateService(id: ID, patch: Partial<Service>): Promise<Service> {
    return this.mutate((db) => {
      const service = this.find(db.services, id, 'Service');
      Object.assign(service, { ...patch, id: service.id, createdAt: service.createdAt, updatedAt: nowISO() });
      return service;
    });
  }

  deleteService(id: ID): Promise<void> {
    return this.mutate((db) => {
      if (db.bookings.some((b) => b.serviceId === id)) {
        throw new ConflictError('This service has bookings. Mark it inactive instead of deleting it.');
      }
      this.remove(db.services, id, 'Service');
      db.contacts.forEach((c) => {
        if (c.serviceId === id) c.serviceId = undefined;
      });
    });
  }

  // ---------- interactions ----------

  createInteraction(input: InteractionInput): Promise<Interaction> {
    return this.mutate((db) => {
      this.find(db.contacts, input.contactId, 'Customer');
      const interaction: Interaction = { ...input, id: this.nextId('I', db.interactions) };
      db.interactions.push(interaction);
      return interaction;
    });
  }

  deleteInteraction(id: ID): Promise<void> {
    return this.mutate((db) => this.remove(db.interactions, id, 'Interaction'));
  }

  // ---------- follow-ups ----------

  createFollowUp(input: FollowUpInput): Promise<FollowUp> {
    return this.mutate((db) => {
      this.find(db.contacts, input.contactId, 'Customer');
      const followUp: FollowUp = { ...input, id: this.nextId('F', db.followUps), createdAt: nowISO() };
      db.followUps.push(followUp);
      return followUp;
    });
  }

  updateFollowUp(id: ID, patch: Partial<FollowUp>): Promise<FollowUp> {
    return this.mutate((db) => {
      const followUp = this.find(db.followUps, id, 'Follow-up');
      Object.assign(followUp, { ...patch, id: followUp.id, createdAt: followUp.createdAt });
      return followUp;
    });
  }

  deleteFollowUp(id: ID): Promise<void> {
    return this.mutate((db) => this.remove(db.followUps, id, 'Follow-up'));
  }

  // ---------- settings ----------

  updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return this.mutate((db) => {
      if (patch.exchangeRate !== undefined && patch.exchangeRate !== db.settings.exchangeRate) {
        patch = { ...patch, exchangeRateUpdatedAt: nowISO() };
      }
      db.settings = { ...db.settings, ...patch, baseCurrency: 'USD' };
      return db.settings;
    });
  }

  clearCustomerData(): Promise<void> {
    return this.mutate((db) => {
      db.contacts = [];
      db.bookings = [];
      db.interactions = [];
      db.followUps = [];
    });
  }

  async resetDemoData(): Promise<void> {
    await this.delay();
    this.cache = this.seed();
    this.persist();
  }
}
