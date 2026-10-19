export interface Slot {
  /** wall-clock times as the calendar reports them: yyyy-MM-ddTHH:mm */
  start: string;
  end: string;
}
export type AvailStatus = 'ok' | 'not-shared' | 'no-calendar' | 'error';
export interface Avail {
  status: AvailStatus;
  slots: Slot[];
  message?: string;
}

/** Working window used to turn busy slots into free time. */
export const DAY_START = 9 * 60;
export const DAY_END = 18 * 60;
export const MIN_FREE = 30;

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const mondayOf = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const weekDays = (monday: Date) => Array.from({ length: 5 }, (_, i) => addDays(monday, i));
export const hm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

const minutesOf = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

/** The free windows (minutes since midnight) inside working hours on one day, given the busy slots. */
export function freeWindows(day: string, slots: Slot[]): [number, number][] {
  const busy = slots
    .filter((s) => s.start.slice(0, 10) <= day && s.end.slice(0, 10) >= day)
    .map((s): [number, number] => [s.start.slice(0, 10) < day ? 0 : minutesOf(s.start), s.end.slice(0, 10) > day ? 24 * 60 : minutesOf(s.end)])
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let cur = DAY_START;
  for (const [s, e] of busy) {
    if (s > cur) out.push([cur, Math.min(s, DAY_END)]);
    cur = Math.max(cur, e);
    if (cur >= DAY_END) break;
  }
  if (cur < DAY_END) out.push([cur, DAY_END]);
  return out.filter(([s, e]) => e - s >= MIN_FREE);
}
