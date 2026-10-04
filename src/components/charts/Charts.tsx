import { BarChart3, Table2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { CHART_COLORS } from '../../lib/constants';
import type { Datum } from '../../lib/analytics';

const GOLD = CHART_COLORS[0];

/**
 * Panel that shows a chart with a one-click table alternative
 * (for screen readers, exact numbers, and print).
 */
export function ChartCard({
  title,
  subtitle,
  rows,
  format = (v) => String(v),
  valueHeader = 'Value',
  children,
  className = '',
  empty = 'No data in this period.',
}: {
  title: string;
  subtitle?: ReactNode;
  rows: { label: string; value: number }[];
  format?: (v: number) => string;
  valueHeader?: string;
  children: ReactNode;
  className?: string;
  empty?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const hasData = rows.some((r) => r.value > 0);
  return (
    <section className={`panel chart-card ${className}`}>
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="panel-sub">{subtitle}</p>}
        </div>
        {hasData && (
          <button className="chart-toggle" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
            {asTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
            {asTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      <div className="panel-body">
        {!hasData ? (
          <p className="chart-empty">{empty}</p>
        ) : asTable ? (
          <table className="table compact-table">
            <thead>
              <tr>
                <th scope="col">{title}</th>
                <th scope="col" className="align-right">
                  {valueHeader}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="align-right num">{format(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/**
 * Horizontal bars with direct labels. Best for ranked categories
 * (sources, services, locations). Rows are clickable when `onSelect` is given.
 */
export function BarList({
  data,
  format = (v) => String(v),
  onSelect,
  color = GOLD,
  limit,
}: {
  data: Datum[];
  format?: (v: number) => string;
  onSelect?: (d: Datum) => void;
  color?: string;
  limit?: number;
}) {
  const rows = limit ? data.slice(0, limit) : data;
  const max = Math.max(1, ...rows.map((d) => d.value));
  return (
    <ul className="bar-list">
      {rows.map((d) => {
        const content = (
          <>
            <span className="bar-label">{d.label}</span>
            <span className="bar-track" aria-hidden>
              <span className="bar-fill" style={{ width: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%`, background: color }} />
            </span>
            <span className="bar-value num">{format(d.value)}</span>
          </>
        );
        return (
          <li key={d.key} title={`${d.label}: ${format(d.value)}`}>
            {onSelect ? (
              <button className="bar-row" onClick={() => onSelect(d)}>
                {content}
              </button>
            ) : (
              <div className="bar-row">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Parts of a whole as one segmented bar + legend (status mix, etc.). */
export function ProportionBar({
  data,
  format = (v) => String(v),
  colors = {},
}: {
  data: Datum[];
  format?: (v: number) => string;
  /** Override colors by key when categories carry meaning. */
  colors?: Record<string, string>;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const colorOf = (d: Datum, i: number) => colors[d.key] ?? CHART_COLORS[i % CHART_COLORS.length];
  return (
    <div className="proportion">
      <div className="proportion-bar" role="img" aria-label={data.map((d) => `${d.label} ${d.value}`).join(', ')}>
        {data.map((d, i) =>
          d.value > 0 ? (
            <span
              key={d.key}
              style={{ width: `${(d.value / total) * 100}%`, background: colorOf(d, i) }}
              title={`${d.label}: ${format(d.value)} (${Math.round((d.value / total) * 100)}%)`}
            />
          ) : null,
        )}
      </div>
      <ul className="legend">
        {data.map((d, i) => (
          <li key={d.key}>
            <i style={{ background: colorOf(d, i) }} aria-hidden />
            {d.label}
            <strong className="num">{format(d.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
