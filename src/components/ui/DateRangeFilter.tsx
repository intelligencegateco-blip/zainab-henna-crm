import { RANGE_PRESETS, type DateRangeValue, type RangePreset } from '../../lib/dateRange';
import { Input, Select } from './Field';

/** Preset ranges plus a custom from/to, in one compact row. */
export function DateRangeFilter({
  value,
  onChange,
  label = 'Date range',
  presets = RANGE_PRESETS.map((p) => p.value),
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  label?: string;
  presets?: RangePreset[];
}) {
  return (
    <div className="range-filter">
      <Select
        aria-label={label}
        value={value.preset}
        options={RANGE_PRESETS.filter((p) => presets.includes(p.value))}
        onChange={(e) => onChange({ ...value, preset: e.target.value as RangePreset })}
      />
      {value.preset === 'custom' && (
        <>
          <Input
            type="date"
            aria-label="From"
            value={value.from ?? ''}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <span className="muted small">to</span>
          <Input type="date" aria-label="To" value={value.to ?? ''} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </>
      )}
    </div>
  );
}
