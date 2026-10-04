import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Money, PageHeader, Segmented } from '../../components/ui/Misc';
import { EmptyState } from '../../components/ui/States';
import { useForm } from '../../hooks/useForm';
import { formatDateTime, formatDuration } from '../../lib/format';
import { groupBy, round2 } from '../../lib/selectors';
import { useCrmData } from '../../state/CrmContext';
import type { Service } from '../../types/models';

export function ServicesPage() {
  const { data, run } = useCrmData();
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);

  const stats = useMemo(() => {
    const byService = groupBy(data.bookings, (b) => b.serviceId);
    return new Map(
      data.services.map((s) => {
        const list = byService.get(s.id) ?? [];
        const done = list.filter((b) => b.status === 'completed');
        return [s.id, { bookings: list.length, revenue: round2(done.reduce((sum, b) => sum + b.price, 0)) }];
      }),
    );
  }, [data]);

  const list = data.services.filter((s) => filter === 'all' || (filter === 'active' ? s.active : !s.active));
  const { exchangeRate, exchangeRateUpdatedAt } = data.settings;

  return (
    <div className="page">
      <PageHeader
        title="Services"
        subtitle={
          <>
            Your price list. Prices are set in USD; bolívar amounts use the rate of Bs {exchangeRate.toLocaleString('es-VE')} per $1 (updated{' '}
            {formatDateTime(exchangeRateUpdatedAt)}). <Link to="/settings">Change the rate</Link>
          </>
        }
        actions={
          <>
            <Segmented
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
            <Button variant="primary" icon={<Plus />} onClick={() => setEditing('new')}>
              New service
            </Button>
          </>
        }
      />

      <section className="panel price-list">
        {list.length === 0 ? (
          <EmptyState
            title={filter === 'inactive' ? 'No inactive services' : 'No services yet'}
            message="Add the henna services you offer so leads and bookings can use them."
            action={<Button variant="primary" onClick={() => setEditing('new')}>New service</Button>}
          />
        ) : (
          <ul>
            {list.map((s) => {
              const st = stats.get(s.id)!;
              return (
                <li key={s.id} className={s.active ? '' : 'inactive'}>
                  <div className="price-row">
                    <h2>{s.name}</h2>
                    <span className="price-leader" aria-hidden />
                    <div className="price-amount">
                      <Money value={s.basePrice} />
                      <span className="price-unit">{s.priceUnit === 'per_person' ? 'per person' : 'flat'}</span>
                    </div>
                  </div>
                  <p className="price-desc">{s.description || <span className="muted">No description</span>}</p>
                  <div className="price-meta">
                    {s.active ? <Badge tone="ok">Active</Badge> : <Badge>Inactive</Badge>}
                    <span>{formatDuration(s.durationMinutes)}{s.priceUnit === 'per_person' ? ' per person' : ''}</span>
                    <span className="num">
                      {st.bookings} booking{st.bookings === 1 ? '' : 's'}
                    </span>
                    <span>
                      Earned <Money value={st.revenue} inline />
                    </span>
                    <span className="price-actions">
                      <ActiveToggle service={s} />
                      <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setEditing(s)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" iconOnly icon={<Trash2 />} onClick={() => setDeleting(s)}>
                        {`Delete ${s.name}`}
                      </Button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editing && <ServiceFormModal service={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name}?`}
        message={
          deleting && stats.get(deleting.id)!.bookings > 0
            ? 'This service has bookings, so it can’t be deleted. Untick “Offer this service” to hide it from new leads and bookings instead.'
            : 'Leads interested in this service will show “Service not chosen”. This can’t be undone.'
        }
        confirmLabel="Delete service"
        onConfirm={() => (deleting ? run((s) => s.deleteService(deleting.id), 'Service deleted') : undefined)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/** Flips immediately, saves in the background, and rolls back if the save fails. */
function ActiveToggle({ service }: { service: Service }) {
  const { run } = useCrmData();
  const [pending, setPending] = useState<boolean | null>(null);
  const checked = pending ?? service.active;
  return (
    <Checkbox
      label="Offer this service"
      checked={checked}
      disabled={pending !== null}
      onChange={async (e) => {
        const next = e.target.checked;
        setPending(next);
        try {
          await run((x) => x.setServiceActive(service.id, next), next ? `${service.name} is active` : `${service.name} is now inactive`);
        } catch {
          // toast shown; fall back to the saved value
        } finally {
          setPending(null);
        }
      }}
    />
  );
}

function ServiceFormModal({ service, onClose }: { service?: Service; onClose: () => void }) {
  const { data, run } = useCrmData();
  const form = useForm({
    name: service?.name ?? '',
    description: service?.description ?? '',
    basePrice: String(service?.basePrice ?? ''),
    priceUnit: service?.priceUnit ?? 'flat',
    durationMinutes: String(service?.durationMinutes ?? 60),
    active: service?.active ?? true,
  });
  const { bind, bindCheck, errors, values } = form;
  const ves = (Number(values.basePrice) || 0) * data.settings.exchangeRate;

  const save = () =>
    form.submit(async (v) => {
      await run((s) => (service ? s.updateService(service.id, v) : s.createService(v)), service ? 'Service updated' : `${v.name.trim()} added`);
      onClose();
    });

  return (
    <Modal
      open
      onClose={onClose}
      locked={form.submitting}
      title={service ? `Edit ${service.name}` : 'New service'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={form.submitting}>
            {service ? 'Save changes' : 'Add service'}
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
          <Field label="Service name" error={errors.name} className="span-2">
            {(p) => <Input {...p} {...bind('name')} placeholder="e.g. Mehndi Night Package" />}
          </Field>
          <Field label="Description" optional error={errors.description} className="span-2">
            {(p) => <Textarea {...p} {...bind('description')} rows={3} />}
          </Field>
          <Field
            label="Base price (USD)"
            error={errors.basePrice}
            hint={ves ? `About Bs ${ves.toLocaleString('es-VE', { maximumFractionDigits: 2 })} at today’s rate` : undefined}
          >
            {(p) => <MoneyInput {...p} {...bind('basePrice')} />}
          </Field>
          <Field label="Charged" error={errors.priceUnit}>
            {(p) => (
              <Select
                {...p}
                {...bind('priceUnit')}
                options={[
                  { value: 'flat', label: 'Flat price' },
                  { value: 'per_person', label: 'Per person' },
                ]}
              />
            )}
          </Field>
          <Field label="Estimated duration (minutes)" error={errors.durationMinutes} hint={values.priceUnit === 'per_person' ? 'Per person' : undefined}>
            {(p) => <Input {...p} {...bind('durationMinutes')} type="number" min={5} step={5} />}
          </Field>
          <div className="field" style={{ justifyContent: 'flex-end', paddingBottom: 8 }}>
            <Checkbox label="Offer this service" {...bindCheck('active')} />
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
