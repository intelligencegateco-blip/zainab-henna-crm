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

/**
 * REST implementation of the repository, ready for a future backend.
 * Enable with VITE_DATA_SOURCE=api. The expected endpoints are documented in
 * README.md ("Backend integration") and mirror these methods 1:1.
 *
 * Error contract: 400/422 -> `{ fields: { [field]: message } }`,
 * 404 -> not found, 409 -> `{ message }` conflict.
 */
export class HttpRepository implements CrmRepository {
  private readonly baseUrl: string;
  private readonly getToken: () => string | null;

  constructor(baseUrl: string, getToken: () => string | null = () => null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.getToken = getToken;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.getToken();
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error('Could not reach the server. Check your internet connection and try again.');
    }

    if (response.status === 204) return undefined as T;
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload as T;

    if (response.status === 400 || response.status === 422) {
      throw new ValidationError(payload.fields ?? { _form: payload.message ?? 'Check the highlighted fields.' });
    }
    if (response.status === 404) throw new NotFoundError('Record', path.split('/').pop() ?? '');
    if (response.status === 409) throw new ConflictError(payload.message ?? 'This change conflicts with existing data.');
    if (response.status === 401) throw new Error('Your session has expired. Sign in again.');
    throw new Error(payload.message ?? `The server returned an error (${response.status}).`);
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
}
