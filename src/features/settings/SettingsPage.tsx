import { RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { PageHeader, Panel } from '../../components/ui/Misc';
import { env } from '../../config/env';
import { useForm } from '../../hooks/useForm';
import { EVENT_TYPES } from '../../lib/constants';
import type { WebsiteInquiry } from '../../lib/validation';
import { formatDateTime, formatUSD, formatVES } from '../../lib/format';
import { useCrmData } from '../../state/CrmContext';

export function SettingsPage() {
  const { data, run, reload } = useCrmData();
  const navigate = useNavigate();
  const [resetOpen, setResetOpen] = useState(false);
  const form = useForm({
    businessName: data.settings.businessName,
    exchangeRate: String(data.settings.exchangeRate),
    currencyDisplay: data.settings.currencyDisplay,
  });
  const rate = Number(form.values.exchangeRate) || 0;

  const save = () =>
    form.submit(async (v) => {
      await run((s) => s.updateSettings(v), 'Settings saved');
    });

  const inquiry = useForm({
    fullName: '',
    phone: '+58 ',
    email: '',
    serviceId: data.services.find((s) => s.active)?.id ?? '',
    eventType: 'party',
    eventDate: '',
    groupSize: '1',
    message: '',
  });

  const sendInquiry = () =>
    inquiry.submit(async (v) => {
      const contact = await run((s) => s.submitWebsiteInquiry(v as WebsiteInquiry), 'Inquiry received as a new lead');
      navigate(`/leads/${contact.id}`);
    });

  return (
    <div className="page settings">
      <PageHeader title="Settings" subtitle="Business details, currency, and tools for connecting the website later." />

      <div className="settings-grid">
        <Panel title="Business & currency" as="h2">
          <form
            noValidate
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {form.formError && <div className="form-alert span-2">{form.formError}</div>}
            <Field label="Business name" error={form.errors.businessName} className="span-2">
              {(p) => <Input {...p} {...form.bind('businessName')} />}
            </Field>
            <Field
              label="Exchange rate (Bs per $1)"
              error={form.errors.exchangeRate}
              hint={`Last updated ${formatDateTime(data.settings.exchangeRateUpdatedAt)}. Use the BCV rate or the one you charge at.`}
            >
              {(p) => <Input {...p} {...form.bind('exchangeRate')} type="number" min={0} step="0.01" inputMode="decimal" />}
            </Field>
            <Field label="Show prices in" error={form.errors.currencyDisplay}>
              {(p) => (
                <Select
                  {...p}
                  {...form.bind('currencyDisplay')}
                  options={[
                    { value: 'both', label: 'USD with bolívares underneath' },
                    { value: 'USD', label: 'USD only' },
                    { value: 'VES', label: 'Bolívares only' },
                  ]}
                />
              )}
            </Field>
            <p className="span-2 small text-2">
              Example: a {formatUSD(180)} bridal booking is {rate > 0 ? formatVES(180, rate) : 'not convertible until a rate is set'}. Amounts are stored in USD so
              changing the rate never rewrites past bookings.
            </p>
            <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="primary" loading={form.submitting}>
                Save settings
              </Button>
            </div>
          </form>
        </Panel>

        <Panel
          title="Test a website inquiry"
          as="h2"
          subtitle="This sends a form exactly as the future website will. It arrives as a New inquiry with a follow-up for today."
        >
          <form
            noValidate
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              void sendInquiry();
            }}
          >
            {inquiry.formError && <div className="form-alert span-2">{inquiry.formError}</div>}
            <Field label="Name" error={inquiry.errors.fullName}>
              {(p) => <Input {...p} {...inquiry.bind('fullName')} />}
            </Field>
            <Field label="Phone / WhatsApp" error={inquiry.errors.phone}>
              {(p) => <Input {...p} {...inquiry.bind('phone')} type="tel" />}
            </Field>
            <Field label="Service" error={inquiry.errors.serviceId}>
              {(p) => (
                <Select
                  {...p}
                  {...inquiry.bind('serviceId')}
                  placeholder="Not sure"
                  options={data.services.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))}
                />
              )}
            </Field>
            <Field label="Event type" error={inquiry.errors.eventType}>
              {(p) => <Select {...p} {...inquiry.bind('eventType')} options={EVENT_TYPES} />}
            </Field>
            <Field label="Event date" optional error={inquiry.errors.eventDate}>
              {(p) => <Input {...p} {...inquiry.bind('eventDate')} type="date" />}
            </Field>
            <Field label="Number of people" error={inquiry.errors.groupSize}>
              {(p) => <Input {...p} {...inquiry.bind('groupSize')} type="number" min={1} />}
            </Field>
            <Field label="Message" optional className="span-2" error={inquiry.errors.message}>
              {(p) => <Textarea {...p} {...inquiry.bind('message')} rows={2} />}
            </Field>
            <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" icon={<Send />} loading={inquiry.submitting}>
                Send test inquiry
              </Button>
            </div>
          </form>
        </Panel>

        <Panel title="Data" as="h2">
          <dl className="kv">
            <dt>Data source</dt>
            <dd>{env.dataSource === 'local' ? 'This browser (demo data)' : `API at ${env.apiBaseUrl}`}</dd>
            <dt>Records</dt>
            <dd className="num">
              {data.contacts.length} people, {data.bookings.length} bookings, {data.interactions.length} conversations
            </dd>
          </dl>
          {env.dataSource === 'local' && (
            <>
              <p className="small text-2" style={{ marginTop: 14 }}>
                Demo data lives only in this browser. Resetting replaces everything with fresh sample data dated around today.
              </p>
              <div style={{ marginTop: 12 }}>
                <Button variant="secondary" icon={<RotateCcw />} onClick={() => setResetOpen(true)}>
                  Reset demo data
                </Button>
              </div>
            </>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Reset all demo data?"
        message="Every lead, booking, note and setting you changed in this browser will be replaced with the sample data. This can’t be undone."
        confirmLabel="Reset demo data"
        onConfirm={async () => {
          await run(async (s) => {
            await s.repository.resetDemoData?.();
          }, 'Demo data restored');
          await reload();
          navigate('/');
        }}
        onClose={() => setResetOpen(false)}
      />
    </div>
  );
}
