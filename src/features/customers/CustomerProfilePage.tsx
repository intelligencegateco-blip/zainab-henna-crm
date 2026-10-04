import { addDays, format } from 'date-fns';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  AtSign,
  CalendarPlus,
  Check,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookingStatusBadge, LeadStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { ActionMenu, Avatar, Money, Panel, StatTile } from '../../components/ui/Misc';
import { Nuqta } from '../../components/ui/Ornament';
import { EmptyState } from '../../components/ui/States';
import { useForm } from '../../hooks/useForm';
import {
  EVENT_LABEL,
  INTERACTION_LABEL,
  INTERACTION_TYPES,
  PIPELINE_STAGES,
  SOURCE_LABEL,
} from '../../lib/constants';
import { formatDate, formatDateTime, formatTime, now, relativeDay, todayISO } from '../../lib/format';
import { bookingBalance, indexById, isUpcomingBooking } from '../../lib/selectors';
import { useCrmData } from '../../state/CrmContext';
import type { Booking, PipelineStage } from '../../types/models';
import { BookingFormModal } from '../bookings/BookingFormModal';
import { LeadFormModal } from '../leads/LeadFormModal';
import { useStageMover } from '../pipeline/useStageMover';

type Tab = 'activity' | 'bookings' | 'followups';

export function CustomerProfilePage() {
  const { id = '' } = useParams();
  const { views, data, run } = useCrmData();
  const navigate = useNavigate();
  const contact = views.find((c) => c.id === id);
  const mover = useStageMover();
  const [tab, setTab] = useState<Tab>('activity');
  const [editing, setEditing] = useState(false);
  const [bookingModal, setBookingModal] = useState<{ booking?: Booking } | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!contact) {
    return (
      <div className="page">
        <EmptyState
          title="This customer isn’t here"
          message="They may have been deleted, or the link is wrong."
          action={<Button onClick={() => navigate('/leads')}>Back to leads</Button>}
        />
      </div>
    );
  }

  const today = todayISO();
  const upcoming = contact.bookings.filter((b) => isUpcomingBooking(b, today)).sort((a, b) => a.date.localeCompare(b.date));
  const previous = contact.bookings.filter((b) => !isUpcomingBooking(b, today));
  const completed = contact.bookings.filter((b) => b.status === 'completed');
  const services = indexById(data.services);
  const purchased = [...completed.reduce((m, b) => m.set(b.serviceId, (m.get(b.serviceId) ?? 0) + 1), new Map<string, number>())];
  const whatsapp = contact.phone.replace(/\D/g, '');

  return (
    <div className="page profile">
      <Link to="/leads" className="back-link">
        <ArrowLeft size={16} /> All leads & customers
      </Link>

      <header className="profile-head">
        <Avatar name={contact.fullName} size="lg" />
        <div className="profile-id">
          <h1>{contact.fullName}</h1>
          <div className="profile-meta">
            <LeadStatusBadge status={contact.status} />
            <span className="muted small num">{contact.id}</span>
            <span className="muted small">
              {contact.location}, via {SOURCE_LABEL[contact.source]}
            </span>
          </div>
          <div className="contact-links">
            <a href={`tel:${contact.phone.replace(/\s/g, '')}`}>
              <Phone size={15} /> {contact.phone}
            </a>
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`}>
                <Mail size={15} /> {contact.email}
              </a>
            )}
            {contact.instagram && (
              <a href={`https://instagram.com/${contact.instagram.replace('@', '')}`} target="_blank" rel="noreferrer">
                <AtSign size={15} /> {contact.instagram}
              </a>
            )}
          </div>
        </div>
        <div className="profile-actions">
          <div className="stage-control">
            <label htmlFor="stage-select" className="small text-2">
              Pipeline stage
            </label>
            <Select
              id="stage-select"
              value={contact.stage}
              options={PIPELINE_STAGES.map((s, i) => ({ value: s.value, label: `${i + 1}. ${s.label}` }))}
              onChange={(e) => void mover.move(contact.id, e.target.value as PipelineStage)}
              disabled={contact.archived}
            />
          </div>
          <Button icon={<Pencil />} onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="primary" icon={<CalendarPlus />} onClick={() => setBookingModal({})}>
            Add booking
          </Button>
          <ActionMenu
            trigger={(t) => (
              <Button variant="ghost" iconOnly icon={<MoreHorizontal />} {...t}>
                More actions
              </Button>
            )}
          >
            {(close) => (
              <>
                <button
                  role="menuitem"
                  onClick={() => {
                    close();
                    void run((s) => s.setArchived(contact.id, !contact.archived), contact.archived ? 'Restored' : 'Archived').catch(() => {});
                  }}
                >
                  {contact.archived ? <ArchiveRestore /> : <Archive />} {contact.archived ? 'Restore' : 'Archive'}
                </button>
                <hr />
                <button role="menuitem" className="danger" onClick={() => { close(); setDeleting(true); }}>
                  <Trash2 /> Delete permanently
                </button>
              </>
            )}
          </ActionMenu>
        </div>
      </header>

      {contact.archived && <div className="form-note">This contact is archived. Restore them to move them through the pipeline again.</div>}

      <div className="profile-stats panel">
        <StatTile label="Total spent" value={<Money value={contact.totalSpent} />} foot={`${completed.length} completed booking${completed.length === 1 ? '' : 's'}`} />
        <StatTile
          label="Next appointment"
          value={upcoming[0] ? relativeDay(upcoming[0].date) : 'None'}
          foot={upcoming[0] ? `${formatDate(upcoming[0].date)} at ${formatTime(upcoming[0].startTime)}` : 'Nothing booked yet'}
        />
        <StatTile label="Balance owed" value={<Money value={contact.outstanding} />} foot={contact.outstanding ? 'Across open bookings' : 'All settled'} />
        <StatTile
          label="Next follow-up"
          value={contact.nextFollowUpDate ? relativeDay(contact.nextFollowUpDate) : 'None'}
          foot={contact.openFollowUps[0]?.note ?? 'Schedule one below'}
        />
      </div>

      <div className="profile-grid">
        <div className="profile-main">
          <div className="tabs" role="tablist" aria-label="Customer history">
            {(
              [
                ['activity', `Communication (${data.interactions.filter((i) => i.contactId === contact.id).length})`],
                ['bookings', `Bookings (${contact.bookings.length})`],
                ['followups', `Follow-ups (${data.followUps.filter((f) => f.contactId === contact.id).length})`],
              ] as [Tab, string][]
            ).map(([value, label]) => (
              <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'activity' && <ActivityTab contactId={contact.id} />}
          {tab === 'bookings' && (
            <div className="stack">
              <BookingList title="Upcoming" bookings={upcoming} onOpen={(b) => setBookingModal({ booking: b })} emptyText="No upcoming appointments." />
              <BookingList title="Previous" bookings={previous} onOpen={(b) => setBookingModal({ booking: b })} emptyText="No past bookings yet." />
            </div>
          )}
          {tab === 'followups' && <FollowUpsTab contactId={contact.id} />}
        </div>

        <aside className="profile-side">
          <Panel title="Details" as="h3">
            <dl className="kv">
              <dt>Interested in</dt>
              <dd>{contact.serviceName ?? '—'}</dd>
              <dt>Event</dt>
              <dd>{EVENT_LABEL[contact.eventType]}</dd>
              <dt>Event date</dt>
              <dd>{formatDate(contact.eventDate)}</dd>
              <dt>People</dt>
              <dd className="num">{contact.groupSize}</dd>
              <dt>Estimated value</dt>
              <dd>
                <Money value={contact.estimatedValue} />
              </dd>
              <dt>Lead source</dt>
              <dd>{SOURCE_LABEL[contact.source]}</dd>
              <dt>Added</dt>
              <dd>{formatDate(contact.createdAt)}</dd>
              <dt>Last contact</dt>
              <dd>{contact.lastContactAt ? formatDate(contact.lastContactAt) : '—'}</dd>
            </dl>
          </Panel>
          <NotesPanel contactId={contact.id} notes={contact.notes} />
          <Panel title="Services purchased" as="h3">
            {purchased.length ? (
              <ul className="plain-list">
                {purchased.map(([sid, count]) => (
                  <li key={sid}>
                    <Nuqta size={9} />
                    <span>{services.get(sid)?.name ?? 'Removed service'}</span>
                    <span className="muted num">×{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Nothing completed yet.</p>
            )}
          </Panel>
        </aside>
      </div>

      {mover.dialogs}
      {editing && <LeadFormModal open contact={contact} onClose={() => setEditing(false)} />}
      {bookingModal && (
        <BookingFormModal open booking={bookingModal.booking} contactId={contact.id} onClose={() => setBookingModal(null)} />
      )}
      <ConfirmDialog
        open={deleting}
        title={`Delete ${contact.fullName}?`}
        message={`This permanently removes ${contact.fullName}, their ${contact.bookings.length} booking(s), notes and history. Archive instead if you might need them later.`}
        confirmLabel="Delete permanently"
        onConfirm={async () => {
          await run((s) => s.deleteLead(contact.id), `${contact.fullName} deleted`);
          navigate('/leads');
        }}
        onClose={() => setDeleting(false)}
      />
    </div>
  );
}

function BookingList({ title, bookings, onOpen, emptyText }: { title: string; bookings: Booking[]; onOpen: (b: Booking) => void; emptyText: string }) {
  const { data } = useCrmData();
  const services = indexById(data.services);
  return (
    <Panel title={title} as="h3" flush>
      {bookings.length === 0 ? (
        <p className="muted small" style={{ padding: '0 1.25rem 1.25rem' }}>
          {emptyText}
        </p>
      ) : (
        <ul className="booking-rows">
          {bookings.map((b) => (
            <li key={b.id}>
              <button onClick={() => onOpen(b)}>
                <span className="booking-date">
                  <span className="d">{formatDate(b.date, 'd')}</span>
                  <span className="m">{formatDate(b.date, 'MMM yy')}</span>
                </span>
                <span className="booking-info">
                  <span className="cell-primary">{services.get(b.serviceId)?.name ?? 'Service'}</span>
                  <span className="cell-sub">
                    {formatTime(b.startTime)}, {b.location}, {b.groupSize} {b.groupSize === 1 ? 'person' : 'people'}
                  </span>
                </span>
                <span className="booking-money">
                  <Money value={b.price} />
                  {bookingBalance(b) > 0 && <span className="owed num">${bookingBalance(b)} due</span>}
                </span>
                <BookingStatusBadge status={b.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ActivityTab({ contactId }: { contactId: string }) {
  const { data, run } = useCrmData();
  const items = useMemo(
    () => data.interactions.filter((i) => i.contactId === contactId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [data.interactions, contactId],
  );
  const form = useForm({ type: 'whatsapp', summary: '', occurredAt: format(now(), "yyyy-MM-dd'T'HH:mm") });

  const save = () =>
    form.submit(async (v) => {
      await run(
        (s) => s.recordInteraction(contactId, { type: v.type, summary: v.summary, occurredAt: new Date(v.occurredAt).toISOString() }),
        'Interaction logged',
      );
      form.setValues({ type: v.type, summary: '', occurredAt: format(now(), "yyyy-MM-dd'T'HH:mm") });
    });

  return (
    <div className="stack">
      <Panel title="Log a conversation" as="h3" subtitle="Calls, messages or visits. Keeps the whole story in one place.">
        <form
          className="log-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Channel">{(p) => <Select {...p} {...form.bind('type')} options={INTERACTION_TYPES} />}</Field>
          <Field label="When">{(p) => <Input {...p} {...form.bind('occurredAt')} type="datetime-local" />}</Field>
          <Field label="What happened" error={form.errors.summary} className="span-all">
            {(p) => <Textarea {...p} {...form.bind('summary')} rows={2} placeholder="e.g. Sent 3 design options; she prefers the floral one." />}
          </Field>
          <div className="span-all" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="primary" loading={form.submitting}>
              Log interaction
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="History" as="h3">
        {items.length === 0 ? (
          <p className="muted small">No conversations logged yet.</p>
        ) : (
          <ol className="timeline">
            {items.map((i) => (
              <li key={i.id} className={i.type === 'system' ? 'system' : ''}>
                <span className="timeline-dot" aria-hidden>
                  <Nuqta size={10} />
                </span>
                <div>
                  <div className="timeline-head">
                    <span className="timeline-type">{INTERACTION_LABEL[i.type]}</span>
                    <time className="muted small" dateTime={i.occurredAt}>
                      {formatDateTime(i.occurredAt)}
                    </time>
                  </div>
                  <p>{i.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}

function FollowUpsTab({ contactId }: { contactId: string }) {
  const { data, run } = useCrmData();
  const all = data.followUps.filter((f) => f.contactId === contactId);
  const open = all.filter((f) => !f.completedAt).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const done = all.filter((f) => f.completedAt).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const form = useForm({ dueDate: format(addDays(now(), 2), 'yyyy-MM-dd'), note: '' });
  const today = todayISO();

  const save = () =>
    form.submit(async (v) => {
      await run((s) => s.scheduleFollowUp(contactId, v.dueDate, v.note || 'Follow up'), `Follow-up set for ${formatDate(v.dueDate)}`);
      form.setValues({ dueDate: format(addDays(now(), 2), 'yyyy-MM-dd'), note: '' });
    });

  return (
    <div className="stack">
      <Panel title="Schedule a follow-up" as="h3">
        <form
          className="log-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Date" error={form.errors.dueDate}>
            {(p) => <Input {...p} {...form.bind('dueDate')} type="date" />}
          </Field>
          <Field label="Reminder" optional error={form.errors.note}>
            {(p) => <Input {...p} {...form.bind('note')} placeholder="e.g. Ask about the deposit" />}
          </Field>
          <div className="span-all" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="primary" loading={form.submitting}>
              Schedule follow-up
            </Button>
          </div>
        </form>
      </Panel>

      <Panel title="To do" as="h3">
        {open.length === 0 ? (
          <p className="muted small">No open follow-ups.</p>
        ) : (
          <ul className="followup-list">
            {open.map((f) => (
              <li key={f.id} className={f.dueDate < today ? 'overdue' : f.dueDate === today ? 'today' : ''}>
                <Button
                  size="sm"
                  variant="secondary"
                  iconOnly
                  icon={<Check />}
                  onClick={() => void run((s) => s.completeFollowUp(f.id), 'Follow-up done').catch(() => {})}
                >
                  Mark done
                </Button>
                <div>
                  <div className="cell-primary">{f.note || 'Follow up'}</div>
                  <div className="cell-sub">
                    {f.dueDate < today ? <span className="due overdue">Overdue since {formatDate(f.dueDate)}</span> : `Due ${formatDate(f.dueDate)}`}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={<Trash2 />}
                  onClick={() => void run((s) => s.deleteFollowUp(f.id), 'Follow-up removed').catch(() => {})}
                >
                  Remove follow-up
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Follow-up history" as="h3">
        {done.length === 0 ? (
          <p className="muted small">Completed follow-ups will appear here.</p>
        ) : (
          <ul className="followup-list done">
            {done.map((f) => (
              <li key={f.id}>
                <Check size={14} className="muted" aria-hidden />
                <div>
                  <div>{f.note || 'Follow up'}</div>
                  <div className="cell-sub">
                    Due {formatDate(f.dueDate)}, done {formatDate(f.completedAt)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  icon={<RotateCcw />}
                  onClick={() => void run((s) => s.completeFollowUp(f.id, false), 'Follow-up reopened').catch(() => {})}
                >
                  Reopen follow-up
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function NotesPanel({ contactId, notes }: { contactId: string; notes: string }) {
  const { run } = useCrmData();
  const [value, setValue] = useState(notes);
  const [saving, setSaving] = useState(false);
  const dirty = value !== notes;
  return (
    <Panel title="Notes" as="h3">
      <Textarea aria-label="Notes" value={value} onChange={(e) => setValue(e.target.value)} rows={5} placeholder="Preferences, allergies, design ideas…" />
      {dirty && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
          <Button size="sm" variant="ghost" onClick={() => setValue(notes)} disabled={saving}>
            Discard
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await run((s) => s.updateNotes(contactId, value), 'Notes saved');
              } catch {
                // toast shown
              } finally {
                setSaving(false);
              }
            }}
          >
            Save notes
          </Button>
        </div>
      )}
    </Panel>
  );
}
