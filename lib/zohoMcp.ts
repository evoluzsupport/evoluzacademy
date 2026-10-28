import type { CalEvent, Slot } from './availability';

/** Server-only helpers for talking to a Zoho MCP server. The MCP link holds a secret, so it never reaches the browser. */

/** Only Zoho MCP hosts are called: a saved link is user input, so anything else is refused. */
export const isZohoMcpUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password && /^[a-z0-9-]+\.zohomcp\.[a-z.]+$/i.test(u.hostname);
  } catch {
    return false;
  }
};

const compact = (s: string) => /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(s.replace(/[-:]/g, ''));
export const toWall = (v: unknown): string | null => {
  const m = compact(String(v ?? ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : null;
};

/** Pull {start,end} pairs out of whatever shape the calendar returns the busy slots in. */
export function slotsOf(node: unknown, out: Slot[] = []): Slot[] {
  if (Array.isArray(node)) node.forEach((x) => slotsOf(x, out));
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    const s = toWall(o.startTime ?? o.start ?? o.sdate ?? o.from);
    const e = toWall(o.endTime ?? o.end ?? o.edate ?? o.to);
    if (s && e) out.push({ start: s, end: e });
    else Object.values(o).forEach((x) => slotsOf(x, out));
  }
  return out;
}

export async function tool(url: string, name: string, query_params: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: { query_params } } }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  const j = await res.json();
  const text: string | undefined = j?.result?.content?.[0]?.text;
  return (j?.result?.structuredContent?.data ?? (text ? JSON.parse(text) : null)) as Record<string, unknown> | null;
}

const ymdCompact = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

/** The signed-in account's own meetings for the range (full details), plus the name of its default calendar. */
export async function ownerEvents(url: string, from: string, to: string): Promise<{ local: string; events: CalEvent[] } | null> {
  try {
    const cals = await tool(url, 'ZohoCliq_list_calendars', {});
    const list = (cals?.data as Record<string, unknown>[]) ?? [];
    const own = list.find((c) => c.is_default && c.category === 'own');
    if (!own?.calendar_uid) return null;
    const end = new Date(to + 'T00:00:00');
    end.setDate(end.getDate() + 1);
    const d = await tool(url, 'ZohoCalendar_get_event', {
      caluid: String(own.calendar_uid),
      start: from.replace(/-/g, ''),
      end: ymdCompact(end),
      byinstance: 'true',
      fields: 'title,dateandtime,organizer,isallday,location,url,attendees',
    });
    const raw = (d?.events as Record<string, unknown>[]) ?? [];
    const events: CalEvent[] = [];
    for (const e of raw) {
      const dt = (e.dateandtime ?? {}) as Record<string, unknown>;
      let s = toWall(dt.start);
      let en = toWall(dt.end);
      if (!s && /^\d{8}$/.test(String(dt.start ?? ''))) {
        const v = String(dt.start);
        s = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00`;
        en = s;
      }
      if (!s || !en) continue;
      events.push({
        title: String(e.title ?? 'Busy'),
        start: s,
        end: en,
        allDay: !!e.isallday,
        organizer: e.organizer ? String(e.organizer) : undefined,
        location: e.location ? String(e.location) : undefined,
        url: e.url ? String(e.url) : undefined,
        attendees: Array.isArray(e.attendees) ? e.attendees.length : undefined,
      });
    }
    return { local: String(own.name ?? '').toLowerCase(), events };
  } catch {
    return null;
  }
}
