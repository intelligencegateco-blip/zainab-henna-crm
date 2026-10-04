import { createSeedData } from '../data/seed';
import { now } from '../lib/format';
import { ValidationError } from '../lib/validation';
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

/** Fired when the server says the session is gone; AuthContext signs the user out. */
export const UNAUTHORIZED_EVENT = 'crm:unauthorized';

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * JSON request to the PHP API (api/index.php).
 * - Session cookie is sent automatically (same origin).
 * - Writes carry X-Requested-With, which the server requires (CSRF protection).
 * - `undefined` values are sent as null so a PATCH can clear optional fields.
 *
 * Error contract: 400/422 -> `{ fields }`, 401 -> signed out, 403 -> not allowed,
 * 404 -> not found, 409 -> conflict, 429 -> too many attempts.
 */
export async function request<T>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
  options: { skipAuthEvent?: boolean } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-Requested-With': 'zainab-crm' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body, (_k, v) => (v === undefined ? null : v)),
    });
  } catch {
    throw new Error('Could not reach the server. Check your internet connection and try again.');
  }

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload as T;

  const message: string = payload?.message ?? `The server returned an error (${response.status}).`;
  // Any error that names fields (422 invalid, 409 duplicate, 403 role) is shown next to those fields.
  if (payload?.fields && response.status !== 401) {
    throw new ValidationError({ _form: message, ...payload.fields });
  }
  if (response.status === 400 || response.status === 422) {
    throw new ValidationError({ _form: message });
  }
  if (response.status === 401) {
    if (!options.skipAuthEvent) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new Error(message);
  }
  if (response.status === 403) throw new ForbiddenError(message);
  if (response.status === 404) throw new NotFoundError('Record', path.split('/').pop() ?? '');
  if (response.status === 409) throw new ConflictError(message);
  throw new Error(message);
}

/** REST implementation of the repository. Enable with VITE_DATA_SOURCE=api. */
export class HttpRepository implements CrmRepository {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private request<T>(method: string, path: string, body?: unknown): Promise<T> {
    return request<T>(this.baseUrl, method, path, body);
  }

  getSnapshot() {
    return this.request<CrmSnapshot>('GET', '/snapshot');
  }

  createContact(input: ContactInput) {
    return this.request<Contact>('POST', '/contacts', input);
  }
  updateContact(id: ID, patch: Partial<Contact>) {
    return this.request<Contact>('PATCH', `/contacts/${encodeURIComponent(id)}`, patch);
  }
  deleteContact(id: ID) {
    return this.request<void>('DELETE', `/contacts/${encodeURIComponent(id)}`);
  }

  createBooking(input: BookingInput) {
    return this.request<Booking>('POST', '/bookings', input);
  }
  updateBooking(id: ID, patch: Partial<Booking>) {
    return this.request<Booking>('PATCH', `/bookings/${encodeURIComponent(id)}`, patch);
  }
  deleteBooking(id: ID) {
    return this.request<void>('DELETE', `/bookings/${encodeURIComponent(id)}`);
  }

  createService(input: ServiceInput) {
    return this.request<Service>('POST', '/services', input);
  }
  updateService(id: ID, patch: Partial<Service>) {
    return this.request<Service>('PATCH', `/services/${encodeURIComponent(id)}`, patch);
  }
  deleteService(id: ID) {
    return this.request<void>('DELETE', `/services/${encodeURIComponent(id)}`);
  }

  createInteraction(input: InteractionInput) {
    return this.request<Interaction>('POST', '/interactions', input);
  }
  deleteInteraction(id: ID) {
    return this.request<void>('DELETE', `/interactions/${encodeURIComponent(id)}`);
  }

  createFollowUp(input: FollowUpInput) {
    return this.request<FollowUp>('POST', '/follow-ups', input);
  }
  updateFollowUp(id: ID, patch: Partial<FollowUp>) {
    return this.request<FollowUp>('PATCH', `/follow-ups/${encodeURIComponent(id)}`, patch);
  }
  deleteFollowUp(id: ID) {
    return this.request<void>('DELETE', `/follow-ups/${encodeURIComponent(id)}`);
  }

  updateSettings(patch: Partial<Settings>) {
    return this.request<Settings>('PATCH', '/settings', patch);
  }

  /** Replaces all CRM records on the server with fresh demo data (Admin/Owner). */
  async resetDemoData() {
    const seed = createSeedData(now());
    const current = await this.getSnapshot();
    await this.request<void>('POST', '/admin/replace-data', { ...seed, settings: current.settings });
  }

  /** Removes all customers, bookings, conversations and follow-ups; keeps services and settings. */
  async clearCustomerData() {
    const current = await this.getSnapshot();
    await this.request<void>('POST', '/admin/replace-data', { services: current.services });
  }
}
