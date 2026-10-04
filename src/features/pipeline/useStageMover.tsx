import { useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { STAGE_LABEL } from '../../lib/constants';
import { formatDate } from '../../lib/format';
import { openBookingFor } from '../../lib/selectors';
import { useCrmData } from '../../state/CrmContext';
import type { ID, PipelineStage } from '../../types/models';
import { BookingFormModal } from '../bookings/BookingFormModal';

/**
 * One place that decides what moving a lead between stages needs:
 * - Booking confirmed / Completed without a confirmed booking -> booking form
 * - Cancelled / Lost with an open booking -> confirm cancelling it
 * - anything else -> move straight away
 */
export function useStageMover() {
  const { data, run } = useCrmData();
  const [convert, setConvert] = useState<{ contactId: ID; target: 'booking_confirmed' | 'completed' } | null>(null);
  const [cancelAsk, setCancelAsk] = useState<{ contactId: ID; stage: PipelineStage; bookingId: ID; date: string } | null>(null);

  const doMove = (contactId: ID, stage: PipelineStage) =>
    run((s) => s.moveStage(contactId, stage), `Moved to ${STAGE_LABEL[stage]}`);

  const move = async (contactId: ID, stage: PipelineStage) => {
    const contact = data.contacts.find((c) => c.id === contactId);
    if (!contact || contact.stage === stage) return;
    const open = openBookingFor(contactId, data.bookings);

    if (stage === 'booking_confirmed' && (!open || open.status === 'pending')) {
      setConvert({ contactId, target: stage });
      return;
    }
    if (stage === 'completed' && !open) {
      setConvert({ contactId, target: stage });
      return;
    }
    if ((stage === 'cancelled' || stage === 'lost') && open) {
      setCancelAsk({ contactId, stage, bookingId: open.id, date: open.date });
      return;
    }
    try {
      await doMove(contactId, stage);
    } catch {
      // toast already shown
    }
  };

  const contactName = (id?: ID) => data.contacts.find((c) => c.id === id)?.fullName ?? 'this customer';

  const dialogs = (
    <>
      {convert && (
        <BookingFormModal open contactId={convert.contactId} convertTo={convert.target} onClose={() => setConvert(null)} />
      )}
      <ConfirmDialog
        open={Boolean(cancelAsk)}
        title={`Cancel ${contactName(cancelAsk?.contactId)}’s booking?`}
        message={
          cancelAsk
            ? `Moving to ${STAGE_LABEL[cancelAsk.stage]} also cancels booking ${cancelAsk.bookingId} on ${formatDate(cancelAsk.date)}. Any deposit stays recorded.`
            : ''
        }
        confirmLabel="Cancel booking and move"
        onConfirm={() => (cancelAsk ? doMove(cancelAsk.contactId, cancelAsk.stage) : undefined)}
        onClose={() => setCancelAsk(null)}
      />
    </>
  );

  return { move, dialogs };
}
