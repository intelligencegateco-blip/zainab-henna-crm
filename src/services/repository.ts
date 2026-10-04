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

/**
 * The only boundary between the app and its data.
 *
 * `LocalRepository` implements it with browser storage for the demo;
 * `HttpRepository` implements it against a REST API. Swapping the backend means
 * writing (or finishing) one class — no UI changes.
 *
 * Implementations assign ids and timestamps, and reject invalid input by
 * throwing (ValidationError for field problems, NotFoundError for missing ids).
 */
export interface CrmRepository {
  getSnapshot(): Promise<CrmSnapshot>;

  createContact(input: ContactInput): Promise<Contact>;
  updateContact(id: ID, patch: Partial<Omit<Contact, 'id' | 'createdAt'>>): Promise<Contact>;
  /** Permanently deletes a contact and everything attached to it. */
  deleteContact(id: ID): Promise<void>;

  createBooking(input: BookingInput): Promise<Booking>;
  updateBooking(id: ID, patch: Partial<Omit<Booking, 'id' | 'createdAt'>>): Promise<Booking>;
  deleteBooking(id: ID): Promise<void>;

  createService(input: ServiceInput): Promise<Service>;
  updateService(id: ID, patch: Partial<Omit<Service, 'id' | 'createdAt'>>): Promise<Service>;
  deleteService(id: ID): Promise<void>;

  createInteraction(input: InteractionInput): Promise<Interaction>;
  deleteInteraction(id: ID): Promise<void>;

  createFollowUp(input: FollowUpInput): Promise<FollowUp>;
  updateFollowUp(id: ID, patch: Partial<Omit<FollowUp, 'id' | 'createdAt'>>): Promise<FollowUp>;
  deleteFollowUp(id: ID): Promise<void>;

  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  /** Demo-only: restore the sample data. Backends may omit this. */
  resetDemoData?(): Promise<void>;
}

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} was not found. It may have been deleted.`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
