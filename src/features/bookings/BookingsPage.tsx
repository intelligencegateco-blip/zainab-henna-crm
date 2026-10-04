import { addDays, format } from 'date-fns';
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Download,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookingStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { DateRangeFilter } from '../../components/ui/DateRangeFilter';
import { Checkbox, Input, Select } from '../../components/ui/Field';
import { ActionMenu, Money, PageHeader, Segmented, StatTile } from '../../components/ui/Misc';
import { EmptyState } from '../../components/ui/States';
import { BOOKING_STATUS_LABEL, BOOKING_STATUSES, EVENT_LABEL, EVENT_TYPES } from '../../lib/constants';
import { downloadCsv, toCsv } from '../../lib/csv';
import { inRange, resolveRange, type DateRangeValue } from '../../lib/dateRange';
import { daysFromToday, formatDate, formatTime, normalize, now, relativeDay, todayISO } from '../../lib/format';
import { bookingBalance, indexById, isOpenBooking, isUpcomingBooking, round2 } from '../../lib/selectors';
import { usePermissions } from '../../state/AuthContext';
import { useCrmData } from '../../state/CrmContext';
import type { Booking, BookingStatus } from '../../types/models';
import { BookingCalendar } from './BookingCalendar';
import { BookingFormModal } from './BookingFormModal';

type When = 'upcoming' | 'past' | 'all';

interface Row extends Booking {
  customer: string;
  service: string;
  balance: number;
}

export function BookingsPage() {
  const { data, run } = useCrmData();
  const { canWrite } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<'list' | 'calendar'>(params.get('view') === 'calendar' ? 'calendar' : 'list');
  const [when, setWhen] = useState<When>((params.get('when') as When) || 'upcoming');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [eventType, setEventType] = useState('');
  const [owing, setOwing] = useState(params.get('owing') === '1');
  const [range, setRange] = useState<DateRangeValue>({ preset: 'all' });
  const [modal, setModal] = useState<{ booking?: Booking; date?: string } | null>(null);
  const bookingParam = params.get('booking');
  // Deep link from global search: /bookings?booking=B-2001
  useEffect(() => {
    if (!bookingParam) return;
    const b = data.bookings.find((x) => x.id === bookingParam);
    if (b && canWrite) {
      setMode('list');
      setModal({ booking: b });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingParam]);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [statusAsk, setStatusAsk] = useState<{ row: Row; status: BookingStatus } | null>(null);

  const contacts = useMemo(() => indexById(data.contacts), [data.contacts]);
  const services = useMemo(() => indexById(data.services), [data.services]);
  const today = todayISO();

  const rows: Row[] = useMemo(
    () =>
      data.bookings.map((b) => ({
        ...b,
        customer: contacts.get(b.contactId)?.fullName ?? 'Unknown customer',
        service: services.get(b.serviceId)?.name ?? 'Unknown service',
        balance: bookingBalance(b),
      })),
    [data.bookings, contacts, services],
  );

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const r = resolveRange(range);
    return rows.filter((b) => {
      if (when === 'upcoming' && !(b.date >= today && b.status !== 'cancelled' && b.status !== 'no_show' && b.status !== 'completed')) return false;
      if (when === 'past' && b.date >= today) return false;
      if (status && b.status !== status) return false;
      if (service && b.serviceId !== service) return false;
      if (eventType && b.eventType !== eventType) return false;
      if (owing && b.balance <= 0) return false;
      if (range.preset !== 'all' && !inRange(b.date, r)) return false;
      if (q && !normalize(`${b.customer} ${b.id} ${b.location} ${b.service}`).includes(q)) return false;
      return true;
    });
  }, [rows, query, when, status, service, eventType, owing, range, today]);

  const upcoming = data.bookings.filter((b) => isUpcomingBooking(b, today));
  const next7 = upcoming.filter((b) => b.date <= format(addDays(now(), 7), 'yyyy-MM-dd'));
  const owingRows = rows.filter((b) => b.balance > 0);
  const owedTotal = round2(owingRows.reduce((s, b) => s + b.balance, 0));
  const pendingDeposits = data.bookings.filter((b) => b.status === 'pending').length;

  const filtersActive = Boolean(query || status || service || eventType || owing || range.preset !== 'all');
  const clear = () => {
    setQuery('');
    setStatus('');
    setService('');
    setEventType('');
    setOwing(false);
    setRange({ preset: 'all' });
  };

  const setStatusQuick = (row: Row, next: BookingStatus) =>
    run((s) => s.setBookingStatus(row.id, next), `Booking ${row.id} marked ${BOOKING_STATUS_LABEL[next].toLowerCase()}`).catch(() => {});

  const closeModal = () => {
    setModal(null);
    if (params.get('booking')) {
      const next = new URLSearchParams(params);
      next.delete('booking');
      setParams(next, { replace: true });
    }
  };

  const columns: Column<Row>[] = [
    {
      key: 'date',
      header: 'Date',
      sortValue: (b) => `${b.date} ${b.startTime}`,
      render: (b) => (
        <div>
          <div className="cell-primary num">{formatDate(b.date, 'EEE d MMM yy')}</div>
          <div className="cell-sub num">
            {formatTime(b.startTime)}
            {isOpenBooking(b) && (daysFromToday(b.date) ?? -1) >= 0 && (daysFromToday(b.date) ?? 99) < 14 ? `, ${relativeDay(b.date).toLowerCase()}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortValue: (b) => b.customer,
      render: (b) => (
        <Link to={`/leads/${b.contactId}`} className="cell-primary">
          {b.customer}
        </Link>
      ),
    },
    {
      key: 'service',
      header: 'Service',
      sortValue: (b) => b.service,
      render: (b) => (
        <div>
          <div>{b.service}</div>
          <div className="cell-sub">{EVENT_LABEL[b.eventType]}</div>
        </div>
      ),
    },
    { key: 'location', header: 'Location', sortValue: (b) => b.location, render: (b) => <span className="clamp">{b.location}</span> },
    { key: 'people', header: 'People', align: 'right', sortValue: (b) => b.groupSize, render: (b) => <span className="num">{b.groupSize}</span> },
    { key: 'price', header: 'Price', align: 'right', sortValue: (b) => b.price, render: (b) => <Money value={b.price} /> },
    { key: 'deposit', header: 'Deposit', align: 'right', sortValue: (b) => b.deposit, render: (b) => <Money value={b.deposit} /> },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      sortValue: (b) => b.balance,
      render: (b) => (b.balance > 0 ? <Money value={b.balance} className="owed" /> : <span className="muted">Paid</span>),
    },
    { key: 'status', header: 'Status', sortValue: (b) => b.status, render: (b) => <BookingStatusBadge status={b.status} /> },
    {
      key: 'actions',
      header: '',
      render: (b) => (
        <ActionMenu
          trigger={(t) => (
            <Button size="sm" variant="ghost" iconOnly icon={<MoreHorizontal />} {...t}>
              {`Actions for booking ${b.id}`}
            </Button>
          )}
        >
          {(close) => (
            <>
              <button role="menuitem" onClick={() => { close(); setModal({ booking: b }); }}>
                <Pencil /> Edit booking
              </button>
              {b.status !== 'completed' && (
                <button role="menuitem" onClick={() => { close(); void setStatusQuick(b, 'completed'); }}>
                  <CheckCircle2 /> Mark completed
                </button>
              )}
              {b.balance > 0 && (
                <button
                  role="menuitem"
                  onClick={() => {
                    close();
                    void run((s) => s.recordPayment(b.id, true), 'Balance marked as paid').catch(() => {});
                  }}
                >
                  <CircleDollarSign /> Mark balance paid
                </button>
              )}
              {b.status !== 'cancelled' && b.status !== 'completed' && (
                <>
                  <button role="menuitem" onClick={() => { close(); setStatusAsk({ row: b, status: 'no_show' }); }}>
                    <UserX /> Mark no-show
                  </button>
                  <button role="menuitem" className="danger" onClick={() => { close(); setStatusAsk({ row: b, status: 'cancelled' }); }}>
                    <XCircle /> Cancel booking
                  </button>
                </>
              )}
              <hr />
              <button role="menuitem" className="danger" onClick={() => { close(); setDeleting(b); }}>
                <Trash2 /> Delete booking
              </button>
            </>
          )}
        </ActionMenu>
      ),
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      `zainab-bookings-${today}.csv`,
      toCsv(filtered, [
        { header: 'Booking ID', value: (b) => b.id },
        { header: 'Date', value: (b) => b.date },
        { header: 'Time', value: (b) => b.startTime },
        { header: 'Customer', value: (b) => b.customer },
        { header: 'Service', value: (b) => b.service },
        { header: 'Event type', value: (b) => EVENT_LABEL[b.eventType] },
        { header: 'Location', value: (b) => b.location },
        { header: 'People', value: (b) => b.groupSize },
        { header: 'Price (USD)', value: (b) => b.price },
        { header: 'Deposit (USD)', value: (b) => b.deposit },
        { header: 'Balance (USD)', value: (b) => b.balance },
        { header: 'Status', value: (b) => BOOKING_STATUS_LABEL[b.status] },
        { header: 'Notes', value: (b) => b.notes },
      ]),
    );

  return (
    <div className="page">
      <PageHeader
        title="Bookings"
        subtitle="Every appointment, with what has been paid and what is still owed."
        actions={
          <>
            <Segmented
              label="View"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'list', label: 'List', icon: <List /> },
                { value: 'calendar', label: 'Calendar', icon: <CalendarDays /> },
              ]}
            />
            {mode === 'list' && (
              <Button icon={<Download />} onClick={exportCsv} disabled={!filtered.length}>
                Export CSV
              </Button>
            )}
            {canWrite && (
              <Button variant="primary" icon={<Plus />} onClick={() => setModal({})}>
                New booking
              </Button>
            )}
          </>
        }
      />

      <div className="summary-strip panel">
        <StatTile label="Upcoming" value={upcoming.length} foot={`${next7.length} in the next 7 days`} />
        <StatTile label="Awaiting deposit" value={pendingDeposits} foot="Pending bookings" />
        <button
          className={`stat stat-button ${owing ? 'is-active' : ''}`}
          onClick={() => {
            setOwing((o) => !o);
            setWhen('all');
            setMode('list');
          }}
          aria-pressed={owing}
        >
          <span className="stat-label">Outstanding balances</span>
          <span className="stat-value num">
            <Money value={owedTotal} />
          </span>
          <span className="stat-foot">{owingRows.length} bookings, click to {owing ? 'show all' : 'filter'}</span>
        </button>
      </div>

      {mode === 'calendar' ? (
        <section className="panel">
          <BookingCalendar
            bookings={data.bookings}
            onOpen={(b) => canWrite && setModal({ booking: b })}
            onCreate={canWrite ? (date) => setModal({ date }) : undefined}
          />
        </section>
      ) : (
        <section className="panel">
          <div className="toolbar">
            <Segmented
              label="When"
              value={when}
              onChange={setWhen}
              options={[
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'past', label: 'Past' },
                { value: 'all', label: 'All' },
              ]}
            />
            <div className="search">
              <Search aria-hidden />
              <Input type="search" aria-label="Search bookings" placeholder="Customer, booking ID, place…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Any status" options={BOOKING_STATUSES} />
            <Select
              aria-label="Service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="Any service"
              options={data.services.map((s) => ({ value: s.id, label: s.name }))}
            />
            <Select aria-label="Event type" value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="Any event" options={EVENT_TYPES} />
            <DateRangeFilter label="Appointment date" value={range} onChange={setRange} />
            <Checkbox label="Balance due" checked={owing} onChange={(e) => setOwing(e.target.checked)} />
          </div>
          {filtersActive && (
            <div className="filter-summary">
              <span className="num">{filtered.length} bookings match</span>
              <Button size="sm" variant="ghost" icon={<X />} onClick={clear}>
                Clear filters
              </Button>
            </div>
          )}
          <DataTable
            caption="Bookings"
            columns={canWrite ? columns : columns.filter((c) => c.key !== 'actions')}
            rows={filtered}
            rowKey={(b) => b.id}
            onRowClick={canWrite ? (b) => setModal({ booking: b }) : undefined}
            initialSort={{ key: 'date', dir: when === 'past' ? 'desc' : 'asc' }}
            resetKey={`${when}|${query}|${status}|${service}|${eventType}|${owing}|${JSON.stringify(range)}`}
            key={when}
            empty={
              <EmptyState
                compact={filtersActive}
                title={filtersActive ? 'No bookings match' : when === 'upcoming' ? 'Nothing coming up' : 'No bookings yet'}
                message={filtersActive ? 'Clear a filter to see more.' : 'Confirmed leads and new appointments show up here.'}
                action={
                  filtersActive ? (
                    <Button onClick={clear}>Clear filters</Button>
                  ) : canWrite ? (
                    <Button variant="primary" icon={<Plus />} onClick={() => setModal({})}>
                      New booking
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </section>
      )}

      {modal && <BookingFormModal open booking={modal.booking} defaultDate={modal.date} onClose={closeModal} />}
      <ConfirmDialog
        open={Boolean(statusAsk)}
        title={statusAsk?.status === 'cancelled' ? `Cancel booking ${statusAsk?.row.id}?` : `Mark ${statusAsk?.row.customer} as a no-show?`}
        message={
          statusAsk
            ? `${statusAsk.row.customer}, ${formatDate(statusAsk.row.date)}. The deposit stays recorded and no further balance will be owed.`
            : ''
        }
        confirmLabel={statusAsk?.status === 'cancelled' ? 'Cancel booking' : 'Mark no-show'}
        onConfirm={() => (statusAsk ? setStatusQuick(statusAsk.row, statusAsk.status) : undefined)}
        onClose={() => setStatusAsk(null)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete booking ${deleting?.id}?`}
        message={`This removes ${deleting?.customer}’s booking on ${formatDate(deleting?.date)} and its payment record. To keep history, cancel it instead.`}
        confirmLabel="Delete booking"
        onConfirm={() => (deleting ? run((s) => s.deleteBooking(deleting.id), 'Booking deleted') : undefined)}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
