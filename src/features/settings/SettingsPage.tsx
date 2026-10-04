import { Eraser, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { PageHeader, Panel } from '../../components/ui/Misc';
import { env } from '../../config/env';
import { useForm } from '../../hooks/useForm';
import { EVENT_TYPES } from '../../lib/constants';
import { formatDateTime, formatUSD, formatVES } from '../../lib/format';
import { ROLE_LABEL } from '../../lib/permissions';
import type { WebsiteInquiry } from '../../lib/validation';
import { useAuth, usePermissions } from '../../state/AuthContext';
import { useCrmData } from '../../state/CrmContext';
import { ChangePasswordForm } from './ChangePasswordForm';
import { UsersPanel } from './UsersPanel';

type Tab = 'business' | 'users' | 'account' | 'data';

export function SettingsPage() {
  const { can } = usePermissions();
  const [params, setParams] = useSearchParams();
  const tabs: { value: Tab; label: string; show: boolean }[] = [
    { value: 'business', label: 'Business', show: true },
    { value: 'users', label: 'Users', show: can('manageUsers') },
    { value: 'account', label: 'Your account', show: true },
    { value: 'data', label: 'Data', show: can('resetData') },
  ];
  const visible = tabs.filter((t) => t.show);
  const requested = params.get('tab') as Tab | null;
  const tab = visible.find((t) => t.value === requested)?.value ?? 'business';

  return (
    <div className="page settings">
      <PageHeader title="Settings" subtitle="Business details, the people who can sign in, and your own account." />
      <div className="tabs" role="tablist" aria-label="Settings sections" style={{ marginBottom: '1.25rem' }}>
        {visible.map((t) => (
          <button key={t.value} role="tab" aria-selected={tab === t.value} onClick={() => setParams(t.value === 'business' ? {} : { tab: t.value }, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'business' && <BusinessTab />}
      {tab === 'users' && (
        <div className="stack-tight">
          <UsersPanel />
        </div>
      )}
      {tab === 'account' && <AccountTab />}
      {tab === 'data' && <DataTab />}
    </div>
  );
}

function BusinessTab() {
  const { data, run } = useCrmData();
  const { can, canWrite } = usePermissions();
  const navigate = useNavigate();
  const editable = can('settings');
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
    <div className="settings-grid">
      <Panel title="Business & currency" as="h2" subtitle={editable ? undefined : 'Only Admins and Owners can change these.'}>
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
            {(p) => <Input {...p} {...form.bind('businessName')} disabled={!editable} />}
          </Field>
          <Field
            label="Exchange rate (Bs per $1)"
            error={form.errors.exchangeRate}
            hint={`Last updated ${formatDateTime(data.settings.exchangeRateUpdatedAt)}. Use the BCV rate or the one you charge at.`}
          >
            {(p) => <Input {...p} {...form.bind('exchangeRate')} type="number" min={0} step="0.01" inputMode="decimal" disabled={!editable} />}
          </Field>
          <Field label="Show prices in" error={form.errors.currencyDisplay}>
            {(p) => (
              <Select
                {...p}
                {...form.bind('currencyDisplay')}
                disabled={!editable}
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
          {editable && (
            <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="primary" loading={form.submitting}>
                Save settings
              </Button>
            </div>
          )}
        </form>
      </Panel>

      {canWrite && (
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
      )}
    </div>
  );
}

function AccountTab() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="settings-grid">
      <Panel title="Your account" as="h2">
        <dl className="kv">
          <dt>Name</dt>
          <dd>{user.name}</dd>
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Role</dt>
          <dd>{ROLE_LABEL[user.role]}</dd>
          <dt>Last sign-in</dt>
          <dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}</dd>
        </dl>
        <p className="small text-2" style={{ marginTop: 14 }}>
          To change your name, email or role, ask {user.role === 'admin' ? 'another Admin' : 'an Admin or Owner'}.
        </p>
      </Panel>
      <Panel title="Change password" as="h2">
        <ChangePasswordForm />
      </Panel>
    </div>
  );
}

function DataTab() {
  const { data, run, reload } = useCrmData();
  const navigate = useNavigate();
  const [ask, setAsk] = useState<'reset' | 'clear' | null>(null);
  return (
    <div className="settings-grid">
      <Panel title="Data" as="h2">
        <dl className="kv">
          <dt>Stored</dt>
          <dd>{env.dataSource === 'local' ? 'This browser only (demo mode)' : 'On the server, shared by every user'}</dd>
          <dt>Records</dt>
          <dd className="num">
            {data.contacts.length} people, {data.bookings.length} bookings, {data.interactions.length} conversations
          </dd>
        </dl>
        <div className="data-actions">
          <div>
            <h3>Start fresh for real use</h3>
            <p className="small text-2">Removes every customer, booking, conversation and follow-up. Services, prices, settings and users stay.</p>
            <Button variant="danger" icon={<Eraser />} onClick={() => setAsk('clear')}>
              Remove all customer data
            </Button>
          </div>
          <div>
            <h3>Reload the sample data</h3>
            <p className="small text-2">Replaces all records with the demo customers and bookings, dated around today. Users and settings stay.</p>
            <Button variant="secondary" icon={<RotateCcw />} onClick={() => setAsk('reset')}>
              Reset to demo data
            </Button>
          </div>
        </div>
      </Panel>

      <ConfirmDialog
        open={ask === 'clear'}
        title="Remove all customer data?"
        message={`This permanently deletes ${data.contacts.length} people and ${data.bookings.length} bookings for everyone who uses the CRM. This can’t be undone.`}
        confirmLabel="Remove all customer data"
        onConfirm={async () => {
          await run(async (s) => {
            await s.repository.clearCustomerData?.();
          }, 'All customer data removed');
          await reload();
          navigate('/');
        }}
        onClose={() => setAsk(null)}
      />
      <ConfirmDialog
        open={ask === 'reset'}
        title="Reset to demo data?"
        message="Every lead, booking and note will be replaced with the sample data for everyone who uses the CRM. This can’t be undone."
        confirmLabel="Reset to demo data"
        onConfirm={async () => {
          await run(async (s) => {
            await s.repository.resetDemoData?.();
          }, 'Demo data restored');
          await reload();
          navigate('/');
        }}
        onClose={() => setAsk(null)}
      />
    </div>
  );
}
