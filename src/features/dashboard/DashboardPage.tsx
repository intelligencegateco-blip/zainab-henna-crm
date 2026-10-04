import { Check, Clock } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarList, ChartCard } from '../../components/charts/Charts';
import { BookingStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Money, Panel } from '../../components/ui/Misc';
import { Nuqta, StrokeStack } from '../../components/ui/Ornament';
import { EmptyState } from '../../components/ui/States';
import { computeDashboard } from '../../lib/analytics';
import { INTERACTION_LABEL } from '../../lib/constants';
import { formatDate, formatDateTime, formatPercent, formatTime, moneyParts, now, relativeDay, todayISO } from '../../lib/format';
import { indexById } from '../../lib/selectors';
import { useAuth, usePermissions } from '../../state/AuthContext';
import { useCrmData } from '../../state/CrmContext';

function greeting() {
  const h = now().getHours();
  return h < 12 ? 'Good morning' : h < 19 ? 'Good afternoon' : 'Good evening';
}

export function DashboardPage() {
  const { data, run } = useCrmData();
  const { user } = useAuth();
  const { canWrite } = usePermissions();
  const navigate = useNavigate();
  const m = useMemo(() => computeDashboard(data), [data]);
  const contacts = indexById(data.contacts);
  const services = indexById(data.services);
  const today = todayISO();
  const month = moneyParts(m.revenueLast30, data.settings);

  const metrics = [
    { label: 'Total customers', value: m.totalCustomers, foot: 'Booked at least once', to: '/leads?view=customers' },
    { label: 'New leads', value: m.newLeads, foot: `${m.newLeadsLast30} added in the last 30 days`, to: '/leads?stage=new_inquiry' },
    { label: 'Active leads', value: m.activeLeads, foot: <>Worth <Money value={m.pipelineValue} single /> in open inquiries</>, to: '/pipeline' },
    { label: 'Conversion rate', value: formatPercent(m.conversionRate), foot: 'Leads who became customers', to: '/analytics' },
    { label: 'Upcoming bookings', value: m.upcomingBookings, foot: `${m.todays.length} today`, to: '/bookings' },
    { label: 'Completed bookings', value: m.completedBookings, foot: 'All time', to: '/bookings?when=past' },
    { label: 'Cancelled bookings', value: m.cancelledBookings, foot: 'Including no-shows', to: '/bookings?when=all' },
    { label: 'Revenue', value: <Money value={m.revenue} />, foot: <>Still owed: <Money value={m.outstanding} single /></>, to: '/analytics' },
  ];

  return (
    <div className="page dashboard">
      <section className="today-band" aria-labelledby="today-title">
        <StrokeStack className="today-ornament" />
        <div className="today-intro">
          <p className="today-date">{formatDate(today, 'EEEE d MMMM yyyy')}</p>
          <h1 id="today-title">
            {greeting()}, {user?.name ?? 'Zainab'}
          </h1>
          <dl className="today-figures">
            <div>
              <dt>Appointments today</dt>
              <dd className="num">{m.todays.length}</dd>
            </div>
            <div>
              <dt>Follow-ups due</dt>
              <dd className="num">{m.followUpsDue.length}</dd>
            </div>
            <div>
              <dt>Earned, last 30 days</dt>
              <dd className="num">
                {month.primary}
                {month.secondary && <small>{month.secondary}</small>}
              </dd>
            </div>
          </dl>
        </div>
        <div className="today-list">
          <h2>Today’s chair</h2>
          {m.todays.length === 0 ? (
            <p className="today-empty">
              No appointments today.{' '}
              {m.upcoming[0] && (
                <>
                  Next: {contacts.get(m.upcoming[0].contactId)?.fullName}, {relativeDay(m.upcoming[0].date).toLowerCase()}.
                </>
              )}
            </p>
          ) : (
            <ul>
              {m.todays.map((b) => (
                <li key={b.id}>
                  <span className="today-time num">{formatTime(b.startTime)}</span>
                  <Link to={`/leads/${b.contactId}`}>{contacts.get(b.contactId)?.fullName}</Link>
                  <span className="today-service">{services.get(b.serviceId)?.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="metric-grid panel" aria-label="Key numbers">
        {metrics.map((x) => (
          <Link key={x.label} to={x.to} className="metric">
            <span className="stat-label">{x.label}</span>
            <span className="stat-value num">{x.value}</span>
            <span className="stat-foot">{x.foot}</span>
          </Link>
        ))}
      </section>

      <div className="dash-grid">
        <Panel
          title="Upcoming appointments"
          subtitle={`${m.upcoming.length} booked from today`}
          actions={
            <Button size="sm" variant="ghost" onClick={() => navigate('/bookings?view=calendar')}>
              Open calendar
            </Button>
          }
          className="dash-upcoming"
          flush
        >
          {m.upcoming.length === 0 ? (
            <EmptyState compact title="Nothing booked yet" message="Confirmed bookings from the pipeline will appear here." />
          ) : (
            <ul className="booking-rows">
              {m.upcoming.slice(0, 6).map((b) => (
                <li key={b.id}>
                  <Link to={`/leads/${b.contactId}`}>
                    <span className={`booking-date ${b.date === today ? 'is-today' : ''}`}>
                      <span className="d">{formatDate(b.date, 'd')}</span>
                      <span className="m">{formatDate(b.date, 'MMM')}</span>
                    </span>
                    <span className="booking-info">
                      <span className="cell-primary">{contacts.get(b.contactId)?.fullName}</span>
                      <span className="cell-sub">
                        {relativeDay(b.date)} at {formatTime(b.startTime)}, {services.get(b.serviceId)?.name}
                      </span>
                    </span>
                    <span className="booking-money">
                      <Money value={b.price} />
                    </span>
                    <BookingStatusBadge status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Follow-ups due" subtitle="Today and overdue" className="dash-followups" flush>
          {m.followUpsDue.length === 0 ? (
            <EmptyState compact title="You’re all caught up" message="No follow-ups due today." />
          ) : (
            <ul className="followup-list padded">
              {m.followUpsDue.slice(0, 7).map((f) => {
                const c = contacts.get(f.contactId);
                return (
                  <li key={f.id} className={f.dueDate < today ? 'overdue' : 'today'}>
                    {canWrite && (
                      <Button
                        size="sm"
                        variant="secondary"
                        iconOnly
                        icon={<Check />}
                        onClick={() => void run((s) => s.completeFollowUp(f.id), 'Follow-up done').catch(() => {})}
                      >
                        {`Mark follow-up with ${c?.fullName} done`}
                      </Button>
                    )}
                    <div>
                      <Link to={`/leads/${f.contactId}`} className="cell-primary">
                        {c?.fullName}
                      </Link>
                      <div className="cell-sub">
                        {f.note},{' '}
                        {f.dueDate < today ? <span className="due overdue">{relativeDay(f.dueDate).toLowerCase()}</span> : <span className="due today">today</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
              {m.followUpsDue.length > 7 && (
                <li className="more-link">
                  <Link to="/leads?followup=due">See all {m.followUpsDue.length}</Link>
                </li>
              )}
            </ul>
          )}
        </Panel>

        <ChartCard
          title="Most requested services"
          subtitle="Inquiries plus bookings, all time"
          rows={m.topServices}
          valueHeader="Requests"
          className="dash-services"
        >
          <BarList data={m.topServices} onSelect={(d) => navigate(`/leads?service=${d.key}`)} />
        </ChartCard>

        <Panel title="Recent activity" className="dash-activity">
          {m.recentActivity.length === 0 ? (
            <p className="muted small">Conversations you log will show up here.</p>
          ) : (
            <ol className="timeline compact">
              {m.recentActivity.map((i) => (
                <li key={i.id} className={i.type === 'system' ? 'system' : ''}>
                  <span className="timeline-dot" aria-hidden>
                    <Nuqta size={9} />
                  </span>
                  <div>
                    <div className="timeline-head">
                      <Link to={`/leads/${i.contactId}`} className="timeline-type">
                        {contacts.get(i.contactId)?.fullName ?? 'Removed contact'}
                      </Link>
                      <span className="muted small">
                        <Clock size={12} aria-hidden /> {formatDateTime(i.occurredAt)}
                      </span>
                    </div>
                    <p>
                      <span className="muted">{INTERACTION_LABEL[i.type]}: </span>
                      {i.summary}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
