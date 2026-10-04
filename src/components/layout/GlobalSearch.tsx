import { CalendarDays, Palette, Search, User } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate, normalize } from '../../lib/format';
import { indexById } from '../../lib/selectors';
import { useCrm } from '../../state/CrmContext';

interface Result {
  id: string;
  kind: 'customer' | 'booking' | 'service';
  title: string;
  detail: string;
  to: string;
}

/** Search across customers, bookings and services. Ctrl/⌘+K or "/" focuses it. */
export function GlobalSearch() {
  const { data } = useCrm();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo<Result[]>(() => {
    const q = normalize(query.trim());
    if (!data || q.length < 2) return [];
    const digits = q.replace(/\D/g, '');
    const contacts = indexById(data.contacts);
    const out: Result[] = [];
    for (const c of data.contacts) {
      const hay = normalize([c.fullName, c.email, c.instagram, c.id, c.location].filter(Boolean).join(' '));
      const phoneHit = digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits);
      if (hay.includes(q) || phoneHit) {
        out.push({ id: c.id, kind: 'customer', title: c.fullName, detail: `${c.phone}${c.archived ? ' (archived)' : ''}`, to: `/leads/${c.id}` });
      }
    }
    for (const b of data.bookings) {
      const name = contacts.get(b.contactId)?.fullName ?? '';
      if (normalize(`${b.id} ${name} ${b.location}`).includes(q)) {
        out.push({ id: b.id, kind: 'booking', title: `Booking for ${name}`, detail: `${b.id}, ${formatDate(b.date)}`, to: `/bookings?booking=${b.id}` });
      }
    }
    for (const s of data.services) {
      if (normalize(s.name).includes(q)) out.push({ id: s.id, kind: 'service', title: s.name, detail: s.active ? 'Service' : 'Inactive service', to: '/services' });
    }
    return out.slice(0, 8);
  }, [data, query]);


  const go = (r: Result) => {
    navigate(r.to);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const icon = { customer: User, booking: CalendarDays, service: Palette };
  const showList = open && query.trim().length >= 2;

  return (
    <div className="global-search search">
      <Search aria-hidden />
      <input
        ref={inputRef}
        className="input"
        type="search"
        placeholder="Search customers, phone, bookings…"
        aria-label="Search everything"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && results[active]) {
            go(results[active]);
          } else if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
      />
      <kbd className="search-kbd" aria-hidden>
        /
      </kbd>
      {showList && (
        <ul className="search-results" id={listId} role="listbox">
          {results.length === 0 ? (
            <li className="search-empty">No matches for “{query.trim()}”. Try a name, phone number or booking ID.</li>
          ) : (
            results.map((r, i) => {
              const Icon = icon[r.kind];
              return (
                <li
                  key={`${r.kind}-${r.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(r);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <Icon aria-hidden />
                  <span className="search-title">{r.title}</span>
                  <span className="search-detail">{r.detail}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
