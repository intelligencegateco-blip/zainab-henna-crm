import type { ReactNode } from 'react';
import { BOOKING_STATUS_LABEL, LEAD_STATUS_LABEL, STAGE_INDEX, STAGE_LABEL } from '../../lib/constants';
import type { BookingStatus, LeadStatus, PipelineStage } from '../../types/models';

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'gold' | 'dark';

export function Badge({ tone = 'neutral', children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge tone-${tone}`}>
      {dot && <span className="badge-dot" aria-hidden />}
      {children}
    </span>
  );
}

const BOOKING_TONE: Record<BookingStatus, Tone> = {
  pending: 'warn',
  confirmed: 'info',
  completed: 'ok',
  cancelled: 'danger',
  no_show: 'neutral',
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={BOOKING_TONE[status]}>{BOOKING_STATUS_LABEL[status]}</Badge>;
}

const LEAD_TONE: Record<LeadStatus, Tone> = {
  new: 'gold',
  active: 'info',
  customer: 'ok',
  lost: 'danger',
  archived: 'neutral',
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={LEAD_TONE[status]}>{LEAD_STATUS_LABEL[status]}</Badge>;
}

export function StageBadge({ stage }: { stage: PipelineStage }) {
  const tone: Tone =
    stage === 'completed' ? 'ok' : stage === 'booking_confirmed' ? 'dark' : stage === 'lost' || stage === 'cancelled' ? 'danger' : 'neutral';
  return (
    <Badge tone={tone} dot={false}>
      {STAGE_INDEX[stage] + 1}. {STAGE_LABEL[stage]}
    </Badge>
  );
}
