export type Row = Record<string, string>;

export const csvHeaderKey = (v: unknown) =>
  String(v || '').replace(/^﻿/, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function parseCSV(text: string): Row[] {
  const input = String(text || '').replace(/^﻿/, '');
  const matrix: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(value);
      matrix.push(row);
      row = [];
      value = '';
    } else value += ch;
  }
  if (value.length || row.length) {
    row.push(value);
    matrix.push(row);
  }
  if (matrix.length < 2) return [];
  const headers = matrix.shift()!.map(csvHeaderKey);
  return matrix
    .filter((r) => r.some((x) => String(x || '').trim()))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])));
}

/** First matching column (by alias) or undefined when the column is absent. */
export function field(row: Row, ...aliases: string[]): string | undefined {
  for (const a of aliases) {
    const k = csvHeaderKey(a);
    if (Object.prototype.hasOwnProperty.call(row, k)) return row[k];
  }
  return undefined;
}

export function downloadCSV(rows: (string | number | undefined)[][], name: string) {
  const csv = rows.map((r) => r.map((x) => '"' + String(x ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export type ImportKind = 'trainees' | 'trainers' | 'curriculum' | 'topics';

export const TEMPLATE_COLUMNS: Record<ImportKind, string[]> = {
  trainees: ['Name', 'Email', 'Role', 'Joined', 'Status', 'Trainer', 'Courses'],
  trainers: ['Name', 'Specialty', 'Email'],
  curriculum: ['Course', 'Category', 'Duration', 'Primary Trainer', 'Planned day', 'Topic', 'What we cover', 'Activity / assessment', 'Topic Trainer'],
  topics: ['Course', 'Planned day', 'Topic', 'What we cover', 'Activity / assessment', 'Trainer'],
};
