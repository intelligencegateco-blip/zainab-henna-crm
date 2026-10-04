import { useEffect, useRef, useState, type ReactNode } from 'react';
import { initials, moneyParts } from '../../lib/format';
import { useCrm } from '../../state/CrmContext';

/** Renders an amount in USD and/or bolívares, following Settings. */
export function Money({ value, inline, single, className = '' }: { value: number; inline?: boolean; single?: boolean; className?: string }) {
  const { data } = useCrm();
  const parts = moneyParts(value, data?.settings ?? { exchangeRate: 0, currencyDisplay: 'USD' });
  return (
    <span className={`money ${inline || single ? 'inline' : ''} ${className}`}>
      <span>{parts.primary}</span>
      {parts.secondary && !single && <span className="secondary">{parts.secondary}</span>}
    </span>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span className={`avatar ${size === 'lg' ? 'lg' : ''}`} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  flush,
  className = '',
  as: Heading = 'h2',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
  as?: 'h2' | 'h3';
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          <div>
            {title && <Heading>{title}</Heading>}
            {subtitle && <p className="panel-sub">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={`panel-body ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatTile({
  label,
  value,
  foot,
  icon,
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="stat">
      <span className="stat-label">
        {icon}
        {label}
      </span>
      <span className="stat-value num">{value}</span>
      {foot && <span className="stat-foot">{foot}</span>}
    </div>
  );
}

/** Small actions menu (⋯) that closes on outside click and Escape. */
export function ActionMenu({ trigger, children, align = 'right' }: { trigger: (props: { onClick: () => void; 'aria-expanded': boolean }) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open })}
      {open && (
        <div className="menu" role="menu" style={{ [align]: 0, top: 'calc(100% + 4px)' }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
