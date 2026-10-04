import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TimePoint } from '../../lib/analytics';
import { CHART_COLORS } from '../../lib/constants';

// Kept apart from Charts.tsx so the charting library loads only where it is used.
const GOLD = CHART_COLORS[0];
const AXIS = '#857b6f';
const GRID = '#ebe4d8';

function ChartTooltip({ active, payload, label, format }: { active?: boolean; payload?: { value: number }[]; label?: string; format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <span>{label}</span>
      <strong className="num">{format(payload[0].value)}</strong>
    </div>
  );
}

/** Vertical bars over time with a hover tooltip. One series, one hue. */
export function TimeBars({
  points,
  format = (v) => String(v),
  height = 240,
  axisFormat,
}: {
  points: TimePoint[];
  format?: (v: number) => string;
  height?: number;
  axisFormat?: (v: number) => string;
}) {
  const dense = points.length > 16;
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap={dense ? 2 : '28%'}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: '#d3c8b6' }}
            tick={{ fill: AXIS, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: AXIS, fontSize: 11 }}
            tickFormatter={axisFormat ?? ((v: number) => String(v))}
            width={52}
          />
          <Tooltip cursor={{ fill: 'rgba(160,125,76,0.10)' }} content={<ChartTooltip format={format} />} />
          <Bar dataKey="value" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
