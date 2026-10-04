export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | undefined | null;
}

function escapeCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  let text = String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(','));
  return [header, ...body].join('\r\n');
}

/** Triggers a browser download. BOM keeps accents (é, ñ) intact in Excel. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
