import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Providing this makes the column sortable. */
  sortValue?: (row: T) => string | number | undefined;
  align?: 'left' | 'right';
  className?: string;
}

export type SortState = { key: string; dir: 'asc' | 'desc' };

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  initialSort?: SortState;
  pageSize?: number;
  empty: ReactNode;
  caption: string;
  /** Changing this resets to page 1 (e.g. when filters change). */
  resetKey?: string;
}

export function sortRows<T>(rows: T[], columns: Column<T>[], sort: SortState | null): T[] {
  if (!sort) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col?.sortValue) return rows;
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = col.sortValue!(a);
    const vb = col.sortValue!(b);
    if (va === vb) return 0;
    if (va === undefined || va === '') return 1; // blanks last
    if (vb === undefined || vb === '') return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' }) * dir;
  });
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  initialSort,
  pageSize = 10,
  empty,
  caption,
  resetKey,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);
  const [page, setPage] = useState(1);
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  // Back to page 1 when filters change (derived during render, no effect needed).
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey);
    setPage(1);
  }

  const sorted = useMemo(() => sortRows(rows, columns, sort), [rows, columns, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setPage(1);
  };

  if (!rows.length) return <>{empty}</>;

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={c.align === 'right' ? 'align-right' : undefined}
                    aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    scope="col"
                  >
                    {c.sortValue ? (
                      <button onClick={() => toggleSort(c.key)}>
                        {c.header}
                        {active ? (
                          sort!.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
                        ) : (
                          <ArrowUpDown size={12} opacity={0.45} />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? 'clickable' : undefined}
                onClick={onRowClick ? (e) => {
                  // Let buttons/links inside the row work on their own.
                  if ((e.target as HTMLElement).closest('button, a, input, select')) return;
                  onRowClick(row);
                } : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={[c.align === 'right' && 'align-right', c.className].filter(Boolean).join(' ') || undefined}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span className="num">
          {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, sorted.length)} of {sorted.length}
        </span>
        {pageCount > 1 && (
          <div className="pagination-controls">
            <Button size="sm" variant="secondary" iconOnly icon={<ChevronLeft />} disabled={current === 1} onClick={() => setPage(current - 1)}>
              Previous page
            </Button>
            <span className="num">
              Page {current} of {pageCount}
            </span>
            <Button size="sm" variant="secondary" iconOnly icon={<ChevronRight />} disabled={current === pageCount} onClick={() => setPage(current + 1)}>
              Next page
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
