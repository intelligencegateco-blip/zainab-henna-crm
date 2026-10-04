import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarList, ChartCard, ProportionBar } from '../../components/charts/Charts';
import { TimeBars } from '../../components/charts/TimeBars';
import { DateRangeFilter } from '../../components/ui/DateRangeFilter';
import { Money, PageHeader, StatTile } from '../../components/ui/Misc';
import { computeAnalytics } from '../../lib/analytics';
import { CHART_COLORS } from '../../lib/constants';
import { describeRange, resolveRange, type DateRangeValue } from '../../lib/dateRange';
import { formatCompactUSD, formatPercent, formatUSD } from '../../lib/format';
import { useCrmData } from '../../state/CrmContext';

export function AnalyticsPage() {
  const { data } = useCrmData();
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRangeValue>({ preset: 'year' });
  const resolved = resolveRange(range);
  const a = useMemo(() => computeAnalytics(data, resolveRange(range)), [data, range]);
  const invalidCustom = range.preset === 'custom' && !resolved;
  const unit = a.revenue.byPeriod.unit;
  const per = unit === 'day' ? 'day' : unit === 'week' ? 'week' : 'month';

  return (
    <div className="page analytics">
      <PageHeader
        title="Analytics"
        subtitle={invalidCustom ? 'Pick both dates to apply a custom range. Showing all time meanwhile.' : `Showing ${range.preset === 'custom' ? describeRange(range) : describeRange(range).toLowerCase()}. Leads count by the day they were added; bookings and revenue by appointment date.`}
        actions={<DateRangeFilter value={range} onChange={setRange} label="Analytics period" />}
      />

      <section className="analytics-section" aria-labelledby="a-leads">
        <h2 id="a-leads">Leads</h2>
        <div className="summary-strip panel">
          <StatTile label="Total leads" value={a.leads.total} foot="Added in this period" />
          <StatTile label="Became customers" value={a.leads.converted} foot="Booked at least once" />
          <StatTile label="Conversion rate" value={formatPercent(a.leads.conversionRate)} foot="Customers ÷ leads" />
        </div>
        <div className="chart-grid">
          <ChartCard title="New leads over time" subtitle={`Per ${per}`} rows={a.leads.overTime.points} valueHeader="Leads" className="span-2">
            <TimeBars points={a.leads.overTime.points} />
          </ChartCard>
          <ChartCard title="Leads by source" subtitle="Click a source to see those leads" rows={a.leads.bySource} valueHeader="Leads">
            <BarList data={a.leads.bySource} onSelect={(d) => navigate(`/leads?source=${d.key}`)} />
          </ChartCard>
          <ChartCard title="Leads by stage" subtitle="Where this period’s leads are now" rows={a.leads.byStage} valueHeader="Leads">
            <BarList data={a.leads.byStage} onSelect={(d) => navigate(`/leads?stage=${d.key}`)} />
          </ChartCard>
          <ChartCard title="Leads by status" rows={a.leads.byStatus} valueHeader="Leads" className="span-2">
            <ProportionBar
              data={a.leads.byStatus}
              colors={{ new: CHART_COLORS[0], active: CHART_COLORS[1], customer: CHART_COLORS[4], lost: '#9a9084' }}
            />
          </ChartCard>
        </div>
      </section>

      <section className="analytics-section" aria-labelledby="a-bookings">
        <h2 id="a-bookings">Bookings</h2>
        <div className="summary-strip panel">
          <StatTile label="Total bookings" value={a.bookings.total} />
          <StatTile label="Upcoming" value={a.bookings.upcoming} foot="Pending or confirmed" />
          <StatTile label="Completed" value={a.bookings.completed} />
          <StatTile label="Cancelled" value={a.bookings.cancelled} foot="Including no-shows" />
        </div>
        <div className="chart-grid">
          <ChartCard title="Bookings by service" subtitle="Excludes cancellations" rows={a.bookings.byService} valueHeader="Bookings">
            <BarList data={a.bookings.byService} />
          </ChartCard>
          <ChartCard title="Bookings by event type" subtitle="Excludes cancellations" rows={a.bookings.byEventType} valueHeader="Bookings">
            <BarList data={a.bookings.byEventType} />
          </ChartCard>
        </div>
      </section>

      <section className="analytics-section" aria-labelledby="a-revenue">
        <h2 id="a-revenue">Revenue</h2>
        <div className="summary-strip panel">
          <StatTile label="Revenue" value={<Money value={a.revenue.total} />} foot="Completed bookings" />
          <StatTile label="Average booking" value={<Money value={a.revenue.averageBookingValue} />} />
          <StatTile label="Outstanding balances" value={<Money value={a.revenue.outstanding} />} foot={`${a.revenue.outstandingCount} bookings still owe`} />
        </div>
        <div className="chart-grid">
          <ChartCard
            title={`Revenue by ${per}`}
            subtitle="USD, completed bookings"
            rows={a.revenue.byPeriod.points}
            valueHeader="Revenue"
            format={formatUSD}
            className="span-2"
          >
            <TimeBars points={a.revenue.byPeriod.points} format={formatUSD} axisFormat={formatCompactUSD} />
          </ChartCard>
          <ChartCard title="Revenue by service" rows={a.revenue.byService} valueHeader="Revenue" format={formatUSD} className="span-2">
            <BarList data={a.revenue.byService} format={formatUSD} />
          </ChartCard>
        </div>
      </section>

      <section className="analytics-section" aria-labelledby="a-customers">
        <h2 id="a-customers">Customers</h2>
        <div className="summary-strip panel">
          <StatTile label="New customers" value={a.customers.new} foot="First booking in this period" />
          <StatTile label="Returning customers" value={a.customers.returning} foot="Two or more bookings" />
          <StatTile label="Customers served" value={a.customers.active} foot={`Out of ${a.customers.total} total`} />
        </div>
        <div className="chart-grid">
          <ChartCard title="Customers by location" rows={a.customers.byLocation} valueHeader="Customers">
            <BarList data={a.customers.byLocation} />
          </ChartCard>
          <ChartCard title="How customers found you" rows={a.customers.bySource} valueHeader="Customers">
            <BarList data={a.customers.bySource} />
          </ChartCard>
        </div>
      </section>
    </div>
  );
}
