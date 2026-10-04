import { Button } from '../../components/ui/Button';
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useForm } from '../../hooks/useForm';
import { BOOKING_STATUSES, EVENT_TYPES } from '../../lib/constants';
import { formatUSD, todayISO } from '../../lib/format';
import { openBookingFor, suggestedPrice } from '../../lib/selectors';
import { useCrmData } from '../../state/CrmContext';
import type { Booking, BookingStatus, ID } from '../../types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit an existing booking. */
  booking?: Booking;
  /** Pre-select the customer for a new booking. */
  contactId?: ID;
  /**
   * Convert a lead from the pipeline: prefilled from the lead (or its pending
   * booking) and saved with CrmService.convertToBooking.
   */
  convertTo?: 'booking_confirmed' | 'completed';
  defaultDate?: string;
  onSaved?: (booking: Booking) => void;
}

export function BookingFormModal({ open, onClose, booking, contactId, convertTo, defaultDate, onSaved }: Props) {
  const { data, run } = useCrmData();
  const cid = booking?.contactId ?? contactId ?? '';
  const contact = data.contacts.find((c) => c.id === cid);
  const pending = convertTo && contact ? openBookingFor(contact.id, data.bookings) : undefined;
  const source = booking ?? pending;
  const services = data.services.filter((s) => s.active || s.id === source?.serviceId);
  const firstService = data.services.find((s) => s.id === (source?.serviceId ?? contact?.serviceId)) ?? services[0];
  const groupSize = source?.groupSize ?? contact?.groupSize ?? 1;

  const initialStatus: BookingStatus = convertTo === 'completed' ? 'completed' : convertTo ? 'confirmed' : (booking?.status ?? 'confirmed');
  const price = source?.price ?? (contact?.estimatedValue || suggestedPrice(firstService, groupSize));

  const form = useForm({
    contactId: cid,
    serviceId: firstService?.id ?? '',
    eventType: source?.eventType ?? contact?.eventType ?? 'individual',
    date: source?.date ?? contact?.eventDate ?? defaultDate ?? todayISO(),
    startTime: source?.startTime ?? '10:00',
    durationMinutes: String(source?.durationMinutes ?? firstService?.durationMinutes ?? 60),
    location: source?.location ?? (contact ? contact.location : ''),
    groupSize: String(groupSize),
    price: String(price || ''),
    deposit: String(source?.deposit ?? (price ? Math.round(price * 0.3) : 0)),
    balancePaid: source?.balancePaid ?? convertTo === 'completed',
    status: initialStatus,
    notes: source?.notes ?? '',
  });
  const { values, bind, bindCheck, errors, setValue } = form;

  const remaining = values.balancePaid ? 0 : Math.max(0, (Number(values.price) || 0) - (Number(values.deposit) || 0));
  const customers = data.contacts
    .filter((c) => !c.archived || c.id === cid)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));

  const onServiceChange = (serviceId: string) => {
    setValue('serviceId', serviceId);
    const service = data.services.find((s) => s.id === serviceId);
    if (!service) return;
    const people = Number(values.groupSize) || 1;
    setValue('durationMinutes', String(service.priceUnit === 'per_person' ? Math.min(480, service.durationMinutes * people) : service.durationMinutes));
    if (!booking) setValue('price', String(suggestedPrice(service, people)));
  };

  const save = () =>
    form.submit(async (v) => {
      const payload = { ...v, origin: booking?.origin ?? (convertTo ? 'pipeline' : 'manual') };
      const saved = await run(
        (s) =>
          convertTo
            ? s.convertToBooking(v.contactId, payload, { existingBookingId: pending?.id })
            : booking
              ? s.updateBooking(booking.id, payload)
              : s.createBooking(payload),
        convertTo
          ? `Booking confirmed for ${contact?.fullName ?? 'customer'}`
          : booking
            ? 'Booking updated'
            : 'Booking added',
      );
      onSaved?.(saved);
      onClose();
    });

  const title = convertTo
    ? convertTo === 'completed'
      ? 'Record the completed booking'
      : 'Confirm the booking'
    : booking
      ? `Edit booking ${booking.id}`
      : 'New booking';

  const description = convertTo
    ? `${contact?.fullName}: check the details. Saving adds this appointment to Bookings${pending ? ' (updates the date already on hold)' : ''}.`
    : booking
      ? contact?.fullName
      : 'Add an appointment to the calendar.';

  const statusOptions = convertTo ? BOOKING_STATUSES.filter((s) => s.value === 'confirmed' || s.value === 'completed') : BOOKING_STATUSES;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      locked={form.submitting}
      title={title}
      description={description}
      footer={
        <>
          <span className="left small text-2">
            Balance due: <strong className="num">{formatUSD(remaining)}</strong>
          </span>
          <Button variant="ghost" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={form.submitting}>
            {convertTo ? 'Save booking' : booking ? 'Save changes' : 'Add booking'}
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {form.formError && <div className="form-alert">{form.formError}</div>}
        <div className="form-grid">
          <Field label="Customer" error={errors.contactId} className="span-2">
            {(p) => (
              <Select
                {...p}
                {...bind('contactId')}
                disabled={Boolean(booking || contactId)}
                placeholder="Choose a customer"
                options={customers.map((c) => ({ value: c.id, label: `${c.fullName} (${c.phone})` }))}
                onChange={(e) => {
                  setValue('contactId', e.target.value);
                  const c = data.contacts.find((x) => x.id === e.target.value);
                  if (c && !values.location) setValue('location', c.location);
                }}
              />
            )}
          </Field>
          <Field label="Service" error={errors.serviceId}>
            {(p) => (
              <Select
                {...p}
                {...bind('serviceId')}
                placeholder="Choose a service"
                options={services.map((s) => ({ value: s.id, label: s.name }))}
                onChange={(e) => onServiceChange(e.target.value)}
              />
            )}
          </Field>
          <Field label="Event type" error={errors.eventType}>
            {(p) => <Select {...p} {...bind('eventType')} options={EVENT_TYPES} />}
          </Field>
          <Field label="Date" error={errors.date}>
            {(p) => <Input {...p} {...bind('date')} type="date" />}
          </Field>
          <Field label="Start time" error={errors.startTime}>
            {(p) => <Input {...p} {...bind('startTime')} type="time" step={900} />}
          </Field>
          <Field label="Duration (minutes)" error={errors.durationMinutes}>
            {(p) => <Input {...p} {...bind('durationMinutes')} type="number" min={10} step={5} />}
          </Field>
          <Field label="Number of people" error={errors.groupSize}>
            {(p) => <Input {...p} {...bind('groupSize')} type="number" min={1} />}
          </Field>
          <Field label="Location" error={errors.location} className="span-2" hint="Studio, venue or the client’s address">
            {(p) => <Input {...p} {...bind('location')} />}
          </Field>
          <Field label="Price (USD)" error={errors.price}>
            {(p) => <MoneyInput {...p} {...bind('price')} />}
          </Field>
          <Field label="Deposit received (USD)" error={errors.deposit}>
            {(p) => <MoneyInput {...p} {...bind('deposit')} />}
          </Field>
          <Field label="Status" error={errors.status}>
            {(p) => <Select {...p} {...bind('status')} options={statusOptions} />}
          </Field>
          <div className="field" style={{ justifyContent: 'flex-end', paddingBottom: 8 }}>
            <Checkbox label="Balance paid in full" {...bindCheck('balancePaid')} />
          </div>
          <Field label="Notes" optional error={errors.notes} className="span-2">
            {(p) => <Textarea {...p} {...bind('notes')} placeholder="What to bring, parking, design references…" />}
          </Field>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
