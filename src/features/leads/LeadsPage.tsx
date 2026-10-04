import { Archive, ArchiveRestore, Download, Eye, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LeadStatusBadge, StageBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { DateRangeFilter } from '../../components/ui/DateRangeFilter';
import { Input, Select } from '../../components/ui/Field';
import { ActionMenu, Avatar, Money, PageHeader } from '../../components/ui/Misc';
import { EmptyState } from '../../components/ui/States';
import { EVENT_LABEL, EVENT_TYPES, LEAD_SOURCES, PIPELINE_STAGES, SOURCE_LABEL, STAGE_INDEX, STAGE_LABEL, LEAD_STATUS_LABEL } from '../../lib/constants';
import { downloadCsv, toCsv } from '../../lib/csv';
import { inRange, resolveRange, type DateRangeValue } from '../../lib/dateRange';
import { daysFromToday, formatDate, normalize, relativeDay, todayISO } from '../../lib/format';
import type { ContactView } from '../../lib/selectors';
import { useCrmData } from '../../state/CrmContext';
import { LeadFormModal } from './LeadFormModal';

type View = 'all' | 'leads' | 'customers' | 'lost' | 'archived';

const VIEWS: { value: View; label: string; match: (c: ContactView) => boolean }[] = [
  { value: 'all', label: 'All', match: (c) => !c.archived },
  { value: 'leads', label: 'Open leads', match: (c) => c.status === 'new' || c.status === 'active' },
  { value: 'customers', label: 'Customers', match: (c) => c.status === 'customer' },
  { value: 'lost', label: 'Lost', match: (c) => c.status === 'lost' },
  { value: 'archived', label: 'Archived', match: (c) => c.archived },
];

export function FollowUpCell({ date }: { date?: string }) {
  if (!date) return <span className="muted">None</span>;
  const diff = daysFromToday(date) ?? 0;
  const cls = diff < 0 ? 'due overdue' : diff === 0 ? 'due today' : 'due';
  return (
    <span className={cls} title={formatDate(date)}>
      {diff < 0 ? `${-diff} day${diff === -1 ? '' : 's'} overdue` : relativeDay(date)}
    </span>
  );
}

export function LeadsPage() {
  const { views, data, run } = useCrmData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'all';
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState(params.get('stage') ?? '');
  const [source, setSource] = useState(params.get('source') ?? '');
  const [service, setService] = useState(params.get('service') ?? '');
  const [eventType, setEventType] = useState(params.get('eventType') ?? '');
  const [followUp, setFollowUp] = useState(params.get('followup') ?? '');
  const [created, setCreated] = useState<DateRangeValue>({ preset: 'all' });
  const [editing, setEditing] = useState<ContactView | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ContactView | null>(null);

  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    if (v === 'all') next.delete('view');
    else next.set('view', v);
    setParams(next, { replace: true });
  };

  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.value, views.filter(v.match).length])), [views]);

  const filtered = useMemo(() => {
    const match = VIEWS.find((v) => v.value === view)?.match ?? VIEWS[0].match;
    const q = normalize(query.trim());
    const digits = q.replace(/\D/g, '');
    const range = resolveRange(created);
    const today = todayISO();
    return views.filter((c) => {
      if (!match(c)) return false;
      if (stage && c.stage !== stage) return false;
      if (source && c.source !== source) return false;
      if (service && c.serviceId !== service) return false;
      if (eventType && c.eventType !== eventType) return false;
      if (created.preset !== 'all' && !inRange(c.createdAt, range)) return false;
      if (followUp === 'due' && !(c.nextFollowUpDate && c.nextFollowUpDate <= today)) return false;
      if (followUp === 'none' && c.nextFollowUpDate) return false;
      if (q) {
        const hay = normalize([c.fullName, c.email, c.instagram, c.id, c.location, c.notes].filter(Boolean).join(' '));
        const phoneHit = digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits);
        if (!hay.includes(q) && !phoneHit) return false;
      }
      return true;
    });
  }, [views, view, query, stage, source, service, eventType, created, followUp]);

  const activeFilters = [stage, source, service, eventType, followUp, query].filter(Boolean).length + (created.preset !== 'all' ? 1 : 0);
  const clearFilters = () => {
    setQuery('');
    setStage('');
    setSource('');
    setService('');
    setEventType('');
    setFollowUp('');
    setCreated({ preset: 'all' });
  };

  const columns: Column<ContactView>[] = [
    {
      key: 'name',
      header: 'Name',
      sortValue: (c) => c.fullName,
      render: (c) => (
        <div className="cell-person">
          <Avatar name={c.fullName} />
          <div>
            <div className="cell-primary">{c.fullName}</div>
            <div className="cell-sub num">{c.phone}</div>
          </div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', sortValue: (c) => c.status, render: (c) => <LeadStatusBadge status={c.status} /> },
    { key: 'stage', header: 'Stage', sortValue: (c) => STAGE_INDEX[c.stage], render: (c) => <StageBadge stage={c.stage} /> },
    {
      key: 'service',
      header: 'Interested in',
      sortValue: (c) => c.serviceName ?? '',
      render: (c) => (
        <div>
          <div>{c.serviceName ?? <span className="muted">Not set</span>}</div>
          <div className="cell-sub">
            {EVENT_LABEL[c.eventType]}
            {c.eventDate ? `, ${formatDate(c.eventDate, 'd MMM')}` : ''}
          </div>
        </div>
      ),
    },
    { key: 'source', header: 'Source', sortValue: (c) => SOURCE_LABEL[c.source], render: (c) => SOURCE_LABEL[c.source] },
    { key: 'value', header: 'Est. value', align: 'right', sortValue: (c) => c.estimatedValue, render: (c) => <Money value={c.estimatedValue} /> },
    { key: 'followup', header: 'Next follow-up', sortValue: (c) => c.nextFollowUpDate ?? '', render: (c) => <FollowUpCell date={c.nextFollowUpDate} /> },
    { key: 'created', header: 'Added', sortValue: (c) => c.createdAt, render: (c) => <span className="num">{formatDate(c.createdAt, 'd MMM yy')}</span> },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <ActionMenu
          trigger={(t) => (
            <Button size="sm" variant="ghost" iconOnly icon={<MoreHorizontal />} {...t}>
              {`Actions for ${c.fullName}`}
            </Button>
          )}
        >
          {(close) => (
            <>
              <button role="menuitem" onClick={() => navigate(`/leads/${c.id}`)}>
                <Eye /> View profile
              </button>
              <button role="menuitem" onClick={() => { close(); setEditing(c); }}>
                <Pencil /> Edit details
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  close();
                  void run((s) => s.setArchived(c.id, !c.archived), c.archived ? `${c.fullName} restored` : `${c.fullName} archived`).catch(() => {});
                }}
              >
                {c.archived ? <ArchiveRestore /> : <Archive />} {c.archived ? 'Restore' : 'Archive'}
              </button>
              <hr />
              <button role="menuitem" className="danger" onClick={() => { close(); setDeleting(c); }}>
                <Trash2 /> Delete permanently
              </button>
            </>
          )}
        </ActionMenu>
      ),
    },
  ];

  const exportCsv = () => {
    const csv = toCsv(filtered, [
      { header: 'Customer ID', value: (c) => c.id },
      { header: 'Full name', value: (c) => c.fullName },
      { header: 'Phone', value: (c) => c.phone },
      { header: 'Email', value: (c) => c.email },
      { header: 'Instagram', value: (c) => c.instagram },
      { header: 'Location', value: (c) => c.location },
      { header: 'Lead source', value: (c) => SOURCE_LABEL[c.source] },
      { header: 'Service', value: (c) => c.serviceName },
      { header: 'Event type', value: (c) => EVENT_LABEL[c.eventType] },
      { header: 'Event date', value: (c) => c.eventDate },
      { header: 'People', value: (c) => c.groupSize },
      { header: 'Estimated value (USD)', value: (c) => c.estimatedValue },
      { header: 'Status', value: (c) => LEAD_STATUS_LABEL[c.status] },
      { header: 'Stage', value: (c) => STAGE_LABEL[c.stage] },
      { header: 'Total spent (USD)', value: (c) => c.totalSpent },
      { header: 'Next follow-up', value: (c) => c.nextFollowUpDate },
      { header: 'Last contact', value: (c) => c.lastContactAt?.slice(0, 10) },
      { header: 'Date created', value: (c) => c.createdAt.slice(0, 10) },
      { header: 'Notes', value: (c) => c.notes },
    ]);
    downloadCsv(`zainab-leads-${todayISO()}.csv`, csv);
  };

  return (
    <div className="page">
      <PageHeader
        title="Leads & customers"
        subtitle={`${counts.leads} open leads and ${counts.customers} customers. Click anyone to see their full history.`}
        actions={
          <>
            <Button icon={<Download />} onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
              New lead
            </Button>
          </>
        }
      />

      <div className="tabs" role="tablist" aria-label="Customer views" style={{ marginBottom: '1rem' }}>
        {VIEWS.map((v) => (
          <button key={v.value} role="tab" aria-selected={view === v.value} onClick={() => setView(v.value)}>
            {v.label} <span className="num muted">{counts[v.value]}</span>
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="toolbar">
          <div className="search">
            <Search aria-hidden />
            <Input type="search" placeholder="Name, phone, email, @handle…" aria-label="Search leads" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Select aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} placeholder="Any stage" options={PIPELINE_STAGES} />
          <Select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Any source" options={LEAD_SOURCES} />
          <Select
            aria-label="Service"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="Any service"
            options={data.services.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select aria-label="Event type" value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="Any event" options={EVENT_TYPES} />
          <Select
            aria-label="Follow-up"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder="Any follow-up"
            options={[
              { value: 'due', label: 'Due or overdue' },
              { value: 'none', label: 'No follow-up set' },
            ]}
          />
          <DateRangeFilter label="Date added" value={created} onChange={setCreated} />
        </div>
        {activeFilters > 0 && (
          <div className="filter-summary">
            <span className="num">
              {filtered.length} of {views.filter(VIEWS.find((v) => v.value === view)!.match).length} shown
            </span>
            <Button size="sm" variant="ghost" icon={<X />} onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
        <DataTable
          caption="Leads and customers"
          columns={columns}
          rows={filtered}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/leads/${c.id}`)}
          initialSort={{ key: 'created', dir: 'desc' }}
          resetKey={`${view}|${query}|${stage}|${source}|${service}|${eventType}|${followUp}|${JSON.stringify(created)}`}
          empty={
            activeFilters > 0 ? (
              <EmptyState
                compact
                title="No one matches these filters"
                message="Try a shorter search or clear a filter."
                action={<Button onClick={clearFilters}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                title={view === 'archived' ? 'Nothing archived' : 'No one here yet'}
                message={view === 'archived' ? 'Archived leads appear here and can be restored at any time.' : 'Add your first lead when someone asks about henna.'}
                action={view !== 'archived' && <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>New lead</Button>}
              />
            )
          }
        />
      </section>

      {creating && <LeadFormModal open onClose={() => setCreating(false)} onSaved={(c) => navigate(`/leads/${c.id}`)} />}
      {editing && <LeadFormModal open contact={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.fullName}?`}
        message={`This permanently removes ${deleting?.fullName}, their ${deleting?.bookings.length ?? 0} booking(s), notes and history. Archive instead if you might need them later.`}
        confirmLabel="Delete permanently"
        onConfirm={() => (deleting ? run((s) => s.deleteLead(deleting.id), `${deleting.fullName} deleted`) : undefined)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
