import { addDays, format } from 'date-fns';
import { Button } from '../../components/ui/Button';
import { Field, Input, MoneyInput, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useForm } from '../../hooks/useForm';
import { EVENT_TYPES, LEAD_SOURCES, LOCATIONS, PIPELINE_STAGES, STAGE_LABEL } from '../../lib/constants';
import { now } from '../../lib/format';
import { suggestedPrice } from '../../lib/selectors';
import { useCrmData } from '../../state/CrmContext';
import type { Contact } from '../../types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  contact?: Contact;
  onSaved?: (contact: Contact) => void;
}

export function LeadFormModal({ open, onClose, contact, onSaved }: Props) {
  const { data, run } = useCrmData();
  const editing = Boolean(contact);
  const services = data.services.filter((s) => s.active || s.id === contact?.serviceId);
  const locations = contact && !LOCATIONS.includes(contact.location) ? [contact.location, ...LOCATIONS] : LOCATIONS;

  const form = useForm({
    fullName: contact?.fullName ?? '',
    phone: contact?.phone ?? '+58 ',
    email: contact?.email ?? '',
    instagram: contact?.instagram ?? '',
    location: contact?.location ?? 'Caracas',
    source: contact?.source ?? 'instagram',
    serviceId: contact?.serviceId ?? '',
    eventType: contact?.eventType ?? 'individual',
    eventDate: contact?.eventDate ?? '',
    groupSize: String(contact?.groupSize ?? 1),
    estimatedValue: String(contact?.estimatedValue ?? ''),
    valueTouched: editing,
    stage: contact?.stage ?? 'new_inquiry',
    notes: contact?.notes ?? '',
    followUpDate: format(addDays(now(), 1), 'yyyy-MM-dd'),
    followUpNote: 'Reply with prices and availability',
  });
  const { values, bind, errors, setValue } = form;

  // Keep the estimate in step with service × people until the user types their own.
  const updateEstimate = (serviceId: string, groupSize: string) => {
    if (values.valueTouched) return;
    const service = data.services.find((s) => s.id === serviceId);
    const price = suggestedPrice(service, Number(groupSize) || 1);
    if (price) setValue('estimatedValue', String(price));
  };

  const save = () =>
    form.submit(async (v) => {
      const payload = {
        fullName: v.fullName,
        phone: v.phone,
        email: v.email,
        instagram: v.instagram,
        location: v.location,
        source: v.source,
        serviceId: v.serviceId,
        eventType: v.eventType,
        eventDate: v.eventDate,
        groupSize: v.groupSize,
        estimatedValue: v.estimatedValue === '' ? 0 : v.estimatedValue,
        stage: v.stage,
        notes: v.notes,
      } as never;
      const saved = await run(
        (s) =>
          contact
            ? s.updateLead(contact.id, payload)
            : s.createLead(payload, v.followUpDate ? { dueDate: v.followUpDate, note: v.followUpNote } : undefined),
        contact ? 'Changes saved' : `${v.fullName.trim()} added as a new lead`,
      );
      onSaved?.(saved);
      onClose();
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={form.submitting}
      size="lg"
      title={editing ? `Edit ${contact!.fullName}` : 'New lead'}
      description={editing ? `${contact!.id}, currently in ${STAGE_LABEL[contact!.stage]}` : 'Someone asked about henna? Capture them here.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={form.submitting}>
            {editing ? 'Save changes' : 'Add lead'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        {form.formError && <div className="form-alert">{form.formError}</div>}
        <div className="form-grid">
          <h3 className="form-section-title">Contact</h3>
          <Field label="Full name" error={errors.fullName} className="span-2">
            {(p) => <Input {...p} {...bind('fullName')} autoComplete="off" placeholder="e.g. María Fernanda López" />}
          </Field>
          <Field label="Phone / WhatsApp" error={errors.phone}>
            {(p) => <Input {...p} {...bind('phone')} type="tel" inputMode="tel" />}
          </Field>
          <Field label="Email" optional error={errors.email}>
            {(p) => <Input {...p} {...bind('email')} type="email" />}
          </Field>
          <Field label="Instagram" optional error={errors.instagram}>
            {(p) => <Input {...p} {...bind('instagram')} placeholder="@handle" />}
          </Field>
          <Field label="Location" error={errors.location}>
            {(p) => <Select {...p} {...bind('location')} options={locations.map((l) => ({ value: l, label: l }))} />}
          </Field>
          <Field label="How did they find you?" error={errors.source}>
            {(p) => <Select {...p} {...bind('source')} options={LEAD_SOURCES} />}
          </Field>

          <h3 className="form-section-title">Event</h3>
          <Field label="Service interested in" optional error={errors.serviceId}>
            {(p) => (
              <Select
                {...p}
                {...bind('serviceId')}
                placeholder="Not sure yet"
                options={services.map((s) => ({ value: s.id, label: s.name }))}
                onChange={(e) => {
                  setValue('serviceId', e.target.value);
                  updateEstimate(e.target.value, values.groupSize);
                }}
              />
            )}
          </Field>
          <Field label="Event type" error={errors.eventType}>
            {(p) => <Select {...p} {...bind('eventType')} options={EVENT_TYPES} />}
          </Field>
          <Field label="Event date" optional error={errors.eventDate}>
            {(p) => <Input {...p} {...bind('eventDate')} type="date" />}
          </Field>
          <Field label="Number of people" error={errors.groupSize}>
            {(p) => (
              <Input
                {...p}
                {...bind('groupSize')}
                type="number"
                min={1}
                inputMode="numeric"
                onChange={(e) => {
                  setValue('groupSize', e.target.value);
                  updateEstimate(values.serviceId, e.target.value);
                }}
              />
            )}
          </Field>
          <Field label="Estimated value (USD)" error={errors.estimatedValue} hint="Filled from the service price; edit if you quoted differently.">
            {(p) => (
              <MoneyInput
                {...p}
                {...bind('estimatedValue')}
                onChange={(e) => {
                  setValue('estimatedValue', e.target.value);
                  setValue('valueTouched', true);
                }}
              />
            )}
          </Field>
          {!editing && (
            <Field label="Pipeline stage" error={errors.stage}>
              {(p) => <Select {...p} {...bind('stage')} options={PIPELINE_STAGES.filter((s) => s.open)} />}
            </Field>
          )}
          <Field label="Notes" optional error={errors.notes} className="span-2">
            {(p) => <Textarea {...p} {...bind('notes')} placeholder="Design ideas, preferences, allergies, budget…" />}
          </Field>

          {!editing && (
            <>
              <h3 className="form-section-title">Next follow-up</h3>
              <Field label="Follow up on" optional error={errors.dueDate} hint="Leave empty to skip">
                {(p) => <Input {...p} {...bind('followUpDate')} type="date" />}
              </Field>
              <Field label="Reminder" optional>
                {(p) => <Input {...p} {...bind('followUpNote')} />}
              </Field>
            </>
          )}
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
