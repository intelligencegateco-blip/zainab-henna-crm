import type { ReactNode } from 'react';
import { Button } from './Button';
import { NuqtaCluster } from './Ornament';

export function EmptyState({
  title,
  message,
  action,
  compact,
}: {
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`state ${compact ? 'compact' : ''}`}>
      {!compact && <NuqtaCluster />}
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action && <div className="actions">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'This page couldn’t load', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="state error" role="alert">
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && (
        <div className="actions">
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function Skeleton({ height = 16, width = '100%', radius }: { height?: number; width?: number | string; radius?: number }) {
  return <div className="skeleton" style={{ height, width, borderRadius: radius }} aria-hidden />;
}

/** Placeholder layout shown while CRM data loads. */
export function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading">
      <div style={{ display: 'grid', gap: 12, marginBottom: 28 }}>
        <Skeleton height={34} width={260} />
        <Skeleton height={14} width={360} />
      </div>
      <div className="grid-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="panel" key={i} style={{ padding: 20, display: 'grid', gap: 10 }}>
            <Skeleton height={13} width="50%" />
            <Skeleton height={30} width="70%" />
          </div>
        ))}
      </div>
      <div className="panel" style={{ padding: 20, marginTop: 20, display: 'grid', gap: 14 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={18} />
        ))}
      </div>
    </div>
  );
}
