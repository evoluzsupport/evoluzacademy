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

export type ImportKind = 'trainees' | 'trainers' | 'curriculum' | 'topics' | 'users';

/** Example rows written under the header of each downloadable sample file. */
export const TEMPLATE_SAMPLES: Record<ImportKind, string[][]> = {
  curriculum: [
    ['Basic Zoho', 'Day 1', 'Project Manager', '', 'Zoho Login', 'Provide internal Zoho account and demo/training access.', 'Verify login and application access'],
    ['Basic Zoho', 'Day 1', 'Project Manager', '', 'Work Environment', 'Set up a dedicated Chrome profile and required extensions.', 'Configure Chrome profile'],
    ['Basic Zoho', 'Day 2', 'Project Manager', '', 'Zoho One Overview', 'Understand the Zoho One ecosystem and common apps.', 'Guided walkthrough'],
    ['Zoho CRM', 'Day 8', 'Shivangi Kumari/Jyoti Raj', 'Fundamentals', 'CRM Fundamentals & Navigation', 'CRM purpose, interface, navigation and modules.', 'Guided tour + quiz'],
    ['Zoho CRM', 'Day 9', 'Shivangi Kumari/Jyoti Raj', 'Sales process', 'Core CRM & Sales Process', 'Leads, Accounts, Contacts, Deals and relationships.', 'Lead-to-Deal practical'],
  ],
  topics: [
    ['Zoho CRM', 'Day 8', 'Shivangi Kumari/Jyoti Raj', 'Fundamentals', 'CRM Fundamentals & Navigation', 'CRM purpose, interface, navigation and modules.', 'Guided tour + quiz'],
    ['Zoho CRM', 'Day 9', 'Shivangi Kumari/Jyoti Raj', 'Sales process', 'Core CRM & Sales Process', 'Leads, Accounts, Contacts, Deals and relationships.', 'Lead-to-Deal practical'],
  ],
  trainees: [
    ['Asha Verma', 'asha.verma@evoluz.tech', 'CRM Consultant', '2026-10-01', 'Active', 'Shivangi', 'Zoho CRM; Basic Zoho'],
  ],
  trainers: [
    ['Shivangi Kumari', 'Zoho CRM', 'shivangi.kumari@evoluz.tech'],
  ],
  users: [
    ['Asha Verma', 'asha.verma@evoluz.tech', 'Trainee', 'CRM Consultant', ''],
    ['Ravi Nair', 'ravi.nair@evoluz.tech', 'Trainer', 'Zoho Creator', ''],
    ['Meera Joshi', 'meera.joshi@evoluz.tech', 'Admin', '', ''],
  ],
};

export const TEMPLATE_COLUMNS: Record<ImportKind, string[]> = {
  trainees: ['Name', 'Email', 'Role', 'Joined', 'Status', 'Trainer', 'Courses'],
  trainers: ['Name', 'Role', 'Email'],
  users: ['Name', 'Email', 'Access', 'Role', 'Phone'],
  curriculum: ['Course', 'Planned Day', 'Trainer Name', 'Category', 'Training Topic', 'What We Cover', 'Practical Activity / Assessment'],
  topics: ['Course', 'Planned Day', 'Trainer Name', 'Category', 'Training Topic', 'What We Cover', 'Practical Activity / Assessment'],
};

export const QUESTION_COLUMNS = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Marks'];
export const QUESTION_SAMPLES = [
  ['Which Zoho app tracks projects and tasks?', 'Zoho Projects', 'Zoho Books', 'Zoho Vault', 'Zoho Meeting', 'A', '2'],
  ['What does MFA stand for?', 'Managed File Access', 'Multi-Factor Authentication', 'Master Form Approval', 'Multiple Folder Access', 'B', '2'],
];
