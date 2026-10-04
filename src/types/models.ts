/**
 * Domain model for the CRM. These shapes are the contract between the UI and
 * any data source (local demo storage today, a REST/DB backend later).
 *
 * Conventions
 * - Calendar dates (event day, appointment day, follow-up due day) are stored as
 *   `YYYY-MM-DD` strings so they never shift across time zones.
 * - Timestamps (created/updated/occurred) are full ISO-8601 strings.
 * - Money is stored as a number in the base currency (USD). Bolívar amounts are
 *   derived for display from the exchange rate in Settings.
 */

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO-8601

export type LeadSource =
  | 'instagram'
  | 'whatsapp'
  | 'website'
  | 'facebook'
  | 'referral'
  | 'walk_in'
  | 'other';

export type EventType =
  | 'wedding'
  | 'bridal'
  | 'birthday'
  | 'party'
  | 'baby_shower'
  | 'graduation'
  | 'photoshoot'
  | 'festival'
  | 'individual'
  | 'other';

export type PipelineStage =
  | 'new_inquiry'
  | 'contacted'
  | 'consultation'
  | 'quote_sent'
  | 'awaiting_response'
  | 'deposit_pending'
  | 'booking_confirmed'
  | 'completed'
  | 'cancelled'
  | 'lost';

/** Derived from stage + bookings; never stored. See lib/selectors.ts. */
export type LeadStatus = 'new' | 'active' | 'customer' | 'lost' | 'archived';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export type InteractionType =
  | 'whatsapp'
  | 'instagram'
  | 'call'
  | 'email'
  | 'in_person'
  | 'note'
  | 'system';

export type PriceUnit = 'flat' | 'per_person';

export type CurrencyDisplay = 'USD' | 'VES' | 'both';

/** A person who contacted the business. Becomes a "customer" once booked. */
export interface Contact {
  id: ID;
  fullName: string;
  phone: string;
  email?: string;
  instagram?: string;
  location: string;
  source: LeadSource;
  serviceId?: ID;
  eventType: EventType;
  eventDate?: ISODate;
  groupSize: number;
  estimatedValue: number;
  stage: PipelineStage;
  stageUpdatedAt: ISODateTime;
  notes: string;
  archived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastContactAt?: ISODateTime;
}

export interface Booking {
  id: ID;
  contactId: ID;
  serviceId: ID;
  eventType: EventType;
  date: ISODate;
  startTime: string; // HH:mm, 24h
  durationMinutes: number;
  location: string;
  groupSize: number;
  price: number;
  deposit: number;
  balancePaid: boolean;
  status: BookingStatus;
  notes: string;
  origin: 'pipeline' | 'manual' | 'website';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Service {
  id: ID;
  name: string;
  description: string;
  basePrice: number;
  priceUnit: PriceUnit;
  durationMinutes: number;
  active: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Interaction {
  id: ID;
  contactId: ID;
  type: InteractionType;
  summary: string;
  occurredAt: ISODateTime;
}

export interface FollowUp {
  id: ID;
  contactId: ID;
  dueDate: ISODate;
  note: string;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface Settings {
  businessName: string;
  baseCurrency: 'USD';
  /** Bolívares (VES) per 1 USD. */
  exchangeRate: number;
  exchangeRateUpdatedAt: ISODateTime;
  currencyDisplay: CurrencyDisplay;
}

/** Everything the UI needs, loaded in one call. */
export interface CrmSnapshot {
  contacts: Contact[];
  bookings: Booking[];
  services: Service[];
  interactions: Interaction[];
  followUps: FollowUp[];
  settings: Settings;
}

// ---- Inputs (what the UI sends; the data source assigns ids & timestamps) ----

export type ContactInput = Omit<
  Contact,
  'id' | 'createdAt' | 'updatedAt' | 'stageUpdatedAt' | 'archived' | 'lastContactAt'
> & { archived?: boolean };

export type BookingInput = Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>;
export type ServiceInput = Omit<Service, 'id' | 'createdAt' | 'updatedAt'>;
export type InteractionInput = Omit<Interaction, 'id'>;
export type FollowUpInput = Omit<FollowUp, 'id' | 'createdAt' | 'completedAt'>;
