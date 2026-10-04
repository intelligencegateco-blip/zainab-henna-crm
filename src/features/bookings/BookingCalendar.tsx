import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BookingStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatDate, formatTime, now, todayISO } from '../../lib/format';
import { groupBy, indexById } from '../../lib/selectors';
import { useCrmData } from '../../state/CrmContext';
import type { Booking } from '../../types/models';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function BookingCalendar({
  bookings,
  onOpen,
  onCreate,
}: {
  bookings: Booking[];
  onOpen: (b: Booking) => void;
  /** Omit for read-only users. */
  onCreate?: (date: string) => void;
}) {
  const { data } = useCrmData();
  const [month, setMonth] = useState(() => startOfMonth(now()));
  const [selected, setSelected] = useState(todayISO());
  const contacts = indexById(data.contacts);
  const services = indexById(data.services);
  const today = todayISO();

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );
  const byDay = useMemo(() => {
    const map = groupBy(bookings, (b) => b.date);
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [bookings]);
  const selectedList = byDay.get(selected) ?? [];

  return (
    <div className="calendar">
      <div className="calendar-bar">
        <h2>{format(month, 'MMMM yyyy')}</h2>
        <div className="calendar-nav">
          <Button size="sm" variant="secondary" iconOnly icon={<ChevronLeft />} onClick={() => setMonth((m) => addMonths(m, -1))}>
            Previous month
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setMonth(startOfMonth(now()));
              setSelected(todayISO());
            }}
          >
            Today
          </Button>
          <Button size="sm" variant="secondary" iconOnly icon={<ChevronRight />} onClick={() => setMonth((m) => addMonths(m, 1))}>
            Next month
          </Button>
        </div>
      </div>

      <div className="calendar-grid" role="grid" aria-label={format(month, 'MMMM yyyy')}>
        {WEEKDAYS.map((d) => (
          <div key={d} className="calendar-weekday" role="columnheader">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const iso = format(day, 'yyyy-MM-dd');
          const list = byDay.get(iso) ?? [];
          const classes = [
            'calendar-day',
            !isSameMonth(day, month) && 'outside',
            iso === today && 'is-today',
            iso === selected && 'is-selected',
            iso < today && 'past',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={iso} className={classes} role="gridcell" aria-selected={iso === selected} onClick={() => setSelected(iso)}>
              <button className="calendar-date num" onClick={() => setSelected(iso)} aria-label={`${formatDate(iso)}, ${list.length} bookings`}>
                {format(day, 'd')}
              </button>
              <div className="calendar-chips">
                {list.slice(0, 3).map((b) => (
                  <button
                    key={b.id}
                    className={`calendar-chip status-${b.status}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(b);
                    }}
                    title={`${formatTime(b.startTime)} ${contacts.get(b.contactId)?.fullName ?? ''}`}
                  >
                    <span className="num">{b.startTime}</span> {contacts.get(b.contactId)?.fullName.split(' ')[0]}
                  </button>
                ))}
                {list.length > 3 && <span className="calendar-more">+{list.length - 3} more</span>}
              </div>
              {list.length > 0 && <span className="calendar-dots" aria-hidden>{list.map((b) => <i key={b.id} className={`status-${b.status}`} />)}</span>}
            </div>
          );
        })}
      </div>

      <div className="calendar-agenda">
        <div className="calendar-agenda-head">
          <h3>{formatDate(selected, 'EEEE d MMMM')}</h3>
          {onCreate && (
            <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => onCreate(selected)}>
              Book this day
            </Button>
          )}
        </div>
        {selectedList.length === 0 ? (
          <p className="muted small">Nothing booked.</p>
        ) : (
          <ul className="agenda-list">
            {selectedList.map((b) => (
              <li key={b.id}>
                <button onClick={() => onOpen(b)}>
                  <span className="agenda-time num">{formatTime(b.startTime)}</span>
                  <span>
                    <span className="cell-primary">{contacts.get(b.contactId)?.fullName}</span>
                    <span className="cell-sub">
                      {services.get(b.serviceId)?.name}, {b.location}
                    </span>
                  </span>
                  <BookingStatusBadge status={b.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
