import { STAGE_INDEX, STAGE_LABEL, BOOKING_STATUS_LABEL, SOURCE_LABEL } from '../lib/constants';
import { formatDate, nowISO, todayISO } from '../lib/format';
import { isOpenBooking, openBookingFor } from '../lib/selectors';
import {
  bookingSchema,
  contactSchema,
  followUpSchema,
  interactionSchema,
  parseOrThrow,
  serviceSchema,
  settingsSchema,
  websiteInquirySchema,
  type ContactFormValues,
  type WebsiteInquiry,
} from '../lib/validation';
import type {
  Booking,
  BookingStatus,
  Contact,
  FollowUp,
  ID,
  Interaction,
  PipelineStage,
  Service,
  Settings,
} from '../types/models';
import { ConflictError, NotFoundError, type CrmRepository } from './repository';

/** Stages that only make sense once a booking record exists. */
export const STAGES_REQUIRING_BOOKING: PipelineStage[] = ['booking_confirmed', 'completed'];

export type BookingFormValues = Record<string, unknown>;

/**
 * Business rules on top of the repository. The UI calls this, never the
 * repository directly, so a backend can later take over these rules without
 * the screens changing.
 */
export class CrmService {
  private readonly repo: CrmRepository;

  constructor(repo: CrmRepository) {
    this.repo = repo;
  }

  get repository() {
    return this.repo;
  }

  private async contact(id: ID): Promise<Contact> {
    const snap = await this.repo.getSnapshot();
    const contact = snap.contacts.find((c) => c.id === id);
    if (!contact) throw new NotFoundError('Customer', id);
    return contact;
  }

  private log(contactId: ID, summary: string): Promise<Interaction> {
    return this.repo.createInteraction({ contactId, type: 'system', summary, occurredAt: nowISO() });
  }

  // ---------------- Leads / customers ----------------

  async createLead(values: ContactFormValues, followUp?: { dueDate: string; note?: string }): Promise<Contact> {
    const data = parseOrThrow(contactSchema, values);
    if (STAGE_INDEX[data.stage] > STAGE_INDEX.deposit_pending) {
      throw new ConflictError('New leads start in an open stage. Add a booking to confirm them.');
    }
    const contact = await this.repo.createContact({ ...data, notes: data.notes ?? '' });
    await this.log(contact.id, `Lead added from ${SOURCE_LABEL[contact.source]}.`);
    if (followUp?.dueDate) await this.scheduleFollowUp(contact.id, followUp.dueDate, followUp.note ?? 'First follow-up');
    return contact;
  }

  /** Edits contact details. Stage changes go through `moveStage` so bookings stay in sync. */
  async updateLead(id: ID, values: ContactFormValues): Promise<Contact> {
    const current = await this.contact(id);
    const data = parseOrThrow(contactSchema, { ...values, stage: current.stage });
    return this.repo.updateContact(id, { ...data, stage: current.stage });
  }

  async setArchived(id: ID, archived: boolean): Promise<Contact> {
    const contact = await this.repo.updateContact(id, { archived });
    await this.log(id, archived ? 'Archived.' : 'Restored from archive.');
    return contact;
  }

  deleteLead(id: ID): Promise<void> {
    return this.repo.deleteContact(id);
  }

  async updateNotes(id: ID, notes: string): Promise<Contact> {
    return this.repo.updateContact(id, { notes: notes.slice(0, 4000) });
  }

  /**
   * Move a lead to another pipeline stage and keep its booking in step.
   * Moving to Booking confirmed / Completed needs a booking: if a pending one
   * exists it is promoted, otherwise call `convertToBooking` with details.
   */
  async moveStage(contactId: ID, stage: PipelineStage): Promise<Contact> {
    const snap = await this.repo.getSnapshot();
    const contact = snap.contacts.find((c) => c.id === contactId);
    if (!contact) throw new NotFoundError('Customer', contactId);
    if (contact.stage === stage) return contact;
    const open = openBookingFor(contactId, snap.bookings);

    if (STAGES_REQUIRING_BOOKING.includes(stage) && !open) {
      throw new ConflictError('Add the booking details first so the appointment appears in Bookings.');
    }
    if (open) {
      const nextStatus: BookingStatus | null =
        stage === 'booking_confirmed'
          ? 'confirmed'
          : stage === 'completed'
            ? 'completed'
            : stage === 'cancelled' || stage === 'lost'
              ? 'cancelled'
              : stage === 'deposit_pending'
                ? 'pending'
                : null;
      if (nextStatus && nextStatus !== open.status) {
        await this.repo.updateBooking(open.id, {
          status: nextStatus,
          ...(nextStatus === 'completed' ? { balancePaid: true } : {}),
        });
      }
    }

    const updated = await this.repo.updateContact(contactId, { stage });
    await this.log(contactId, `Moved from ${STAGE_LABEL[contact.stage]} to ${STAGE_LABEL[stage]}.`);
    return updated;
  }

  /**
   * Convert a lead into a booking: creates (or updates the pending) booking
   * and moves the lead to Booking confirmed (or Completed).
   */
  async convertToBooking(
    contactId: ID,
    values: BookingFormValues,
    options: { existingBookingId?: ID } = {},
  ): Promise<Booking> {
    const contact = await this.contact(contactId);
    const data = parseOrThrow(bookingSchema, { ...values, contactId, origin: values.origin ?? 'pipeline' });
    if (data.status !== 'confirmed' && data.status !== 'completed') {
      throw new ConflictError('A converted booking must be confirmed or completed.');
    }
    const booking = options.existingBookingId
      ? await this.repo.updateBooking(options.existingBookingId, data)
      : await this.repo.createBooking(data);
    const stage: PipelineStage = data.status === 'completed' ? 'completed' : 'booking_confirmed';
    if (contact.stage !== stage) await this.repo.updateContact(contactId, { stage });
    await this.log(
      contactId,
      `Booking ${booking.id} ${data.status === 'completed' ? 'recorded as completed' : 'confirmed'} for ${formatDate(booking.date)}.`,
    );
    return booking;
  }

  // ---------------- Bookings ----------------

  async createBooking(values: BookingFormValues): Promise<Booking> {
    const data = parseOrThrow(bookingSchema, values);
    const booking = await this.repo.createBooking(data);
    await this.log(booking.contactId, `Booking ${booking.id} added for ${formatDate(booking.date)} (${BOOKING_STATUS_LABEL[booking.status]}).`);
    await this.syncStageFromBooking(booking);
    return booking;
  }

  async updateBooking(id: ID, values: BookingFormValues): Promise<Booking> {
    const snap = await this.repo.getSnapshot();
    const before = snap.bookings.find((b) => b.id === id);
    if (!before) throw new NotFoundError('Booking', id);
    const data = parseOrThrow(bookingSchema, values);
    const booking = await this.repo.updateBooking(id, data);
    if (before.status !== booking.status) {
      await this.log(booking.contactId, `Booking ${id} marked ${BOOKING_STATUS_LABEL[booking.status].toLowerCase()}.`);
      await this.syncStageFromBooking(booking);
    }
    return booking;
  }

  async setBookingStatus(id: ID, status: BookingStatus): Promise<Booking> {
    const booking = await this.repo.updateBooking(id, {
      status,
      ...(status === 'completed' ? { balancePaid: true } : {}),
    });
    await this.log(booking.contactId, `Booking ${id} marked ${BOOKING_STATUS_LABEL[status].toLowerCase()}.`);
    await this.syncStageFromBooking(booking);
    return booking;
  }

  async recordPayment(id: ID, paidInFull: boolean): Promise<Booking> {
    const booking = await this.repo.updateBooking(id, { balancePaid: paidInFull });
    if (paidInFull) await this.log(booking.contactId, `Balance for booking ${id} paid in full.`);
    return booking;
  }

  deleteBooking(id: ID): Promise<void> {
    return this.repo.deleteBooking(id);
  }

  /** Keep the lead's pipeline stage consistent with what happened to its booking. */
  private async syncStageFromBooking(booking: Booking) {
    const snap = await this.repo.getSnapshot();
    const contact = snap.contacts.find((c) => c.id === booking.contactId);
    if (!contact) return;
    const idx = STAGE_INDEX[contact.stage];
    let target: PipelineStage | null = null;

    if (booking.status === 'confirmed' && (idx < STAGE_INDEX.booking_confirmed || contact.stage === 'cancelled' || contact.stage === 'lost')) {
      target = 'booking_confirmed';
    } else if (booking.status === 'completed' && contact.stage !== 'completed') {
      target = 'completed';
    } else if (booking.status === 'pending' && idx < STAGE_INDEX.deposit_pending) {
      target = 'deposit_pending';
    } else if (
      (booking.status === 'cancelled' || booking.status === 'no_show') &&
      (contact.stage === 'booking_confirmed' || contact.stage === 'deposit_pending') &&
      !snap.bookings.some((b) => b.contactId === contact.id && b.id !== booking.id && isOpenBooking(b))
    ) {
      target = 'cancelled';
    }

    if (target && target !== contact.stage) {
      await this.repo.updateContact(contact.id, { stage: target });
      await this.log(contact.id, `Moved from ${STAGE_LABEL[contact.stage]} to ${STAGE_LABEL[target]}.`);
    }
  }

  // ---------------- Interactions & follow-ups ----------------

  async recordInteraction(contactId: ID, values: { type: string; summary: string; occurredAt?: string }) {
    const data = parseOrThrow(interactionSchema, {
      contactId,
      type: values.type,
      summary: values.summary,
      occurredAt: values.occurredAt || nowISO(),
    });
    const interaction = await this.repo.createInteraction(data);
    const contact = await this.contact(contactId);
    if (!contact.lastContactAt || interaction.occurredAt > contact.lastContactAt) {
      await this.repo.updateContact(contactId, { lastContactAt: interaction.occurredAt });
    }
    return interaction;
  }

  deleteInteraction(id: ID) {
    return this.repo.deleteInteraction(id);
  }

  async scheduleFollowUp(contactId: ID, dueDate: string, note: string): Promise<FollowUp> {
    const data = parseOrThrow(followUpSchema, { contactId, dueDate, note });
    return this.repo.createFollowUp({ ...data, note: data.note ?? '' });
  }

  async completeFollowUp(id: ID, done = true): Promise<FollowUp> {
    return this.repo.updateFollowUp(id, { completedAt: done ? nowISO() : undefined });
  }

  deleteFollowUp(id: ID) {
    return this.repo.deleteFollowUp(id);
  }

  // ---------------- Services ----------------

  async createService(values: Record<string, unknown>): Promise<Service> {
    const data = parseOrThrow(serviceSchema, values);
    return this.repo.createService({ ...data, description: data.description ?? '' });
  }

  async updateService(id: ID, values: Record<string, unknown>): Promise<Service> {
    const data = parseOrThrow(serviceSchema, values);
    return this.repo.updateService(id, data);
  }

  setServiceActive(id: ID, active: boolean) {
    return this.repo.updateService(id, { active });
  }

  deleteService(id: ID) {
    return this.repo.deleteService(id);
  }

  // ---------------- Settings ----------------

  async updateSettings(values: Record<string, unknown>): Promise<Settings> {
    const data = parseOrThrow(settingsSchema, values);
    return this.repo.updateSettings(data);
  }

  // ---------------- Website intake ----------------

  /**
   * Entry point for inquiries from the public website (future `POST /api/inquiries`).
   * Creates a New inquiry lead, logs the message and schedules a same-day follow-up.
   */
  async submitWebsiteInquiry(payload: WebsiteInquiry): Promise<Contact> {
    const data = parseOrThrow(websiteInquirySchema, payload);
    const snap = await this.repo.getSnapshot();
    const service = data.serviceId ? snap.services.find((s) => s.id === data.serviceId) : undefined;
    const estimate = service
      ? service.priceUnit === 'per_person'
        ? service.basePrice * data.groupSize
        : service.basePrice
      : 0;
    const contact = await this.repo.createContact({
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      instagram: data.instagram,
      location: data.location ?? 'Other',
      source: 'website',
      serviceId: service?.id,
      eventType: data.eventType ?? 'other',
      eventDate: data.eventDate,
      groupSize: data.groupSize ?? 1,
      estimatedValue: estimate,
      stage: 'new_inquiry',
      notes: '',
    });
    await this.repo.createInteraction({
      contactId: contact.id,
      type: 'email',
      summary: data.message ? `Website inquiry: ${data.message}` : 'Website inquiry received.',
      occurredAt: nowISO(),
    });
    await this.repo.createFollowUp({ contactId: contact.id, dueDate: todayISO(), note: 'Reply to website inquiry' });
    return contact;
  }
}
