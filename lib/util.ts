export const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const validPastOrToday = (date: string) => !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today();

export const initials = (n: string) =>
  n
    .split(' ')
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const dayNumber = (v: string | undefined) => {
  const m = String(v || '').match(/^\s*day\s*(\d+)/i);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};
export const daySort = (a: string, b: string) => dayNumber(a) - dayNumber(b) || String(a).localeCompare(String(b));

export const lc = (s: unknown) => String(s ?? '').trim().toLowerCase();

export const isOverdue = (due: string, pct: number) => !!due && pct < 100 && due < today();

export const fmtDate = (d?: string) =>
  d && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(d + 'T00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : d || '—';
