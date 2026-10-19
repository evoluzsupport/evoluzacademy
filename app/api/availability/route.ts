import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Avail, CalEvent, Slot } from '@/lib/availability';

export const runtime = 'nodejs';

/**
 * Free/busy and meetings from Zoho Calendar, through the Zoho MCP server in ZOHO_MCP_URL
 * (that URL holds a secret, so it only ever lives on the server). Admins only.
 *
 * Other people's calendars only give free/busy slots. The account the MCP is signed in as also gives
 * full event details (titles, times, organiser), so that person's meetings are exact.
 */
const MAX_EMAILS = 200;
const CHUNK = 10;

const compact = (s: string) => /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/.exec(s.replace(/[-:]/g, ''));
const toWall = (v: unknown): string | null => {
  const m = compact(String(v ?? ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : null;
};

/** Pull {start,end} pairs out of whatever shape the calendar returns the busy slots in. */
function slotsOf(node: unknown, out: Slot[] = []): Slot[] {
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

async function tool(url: string, name: string, query_params: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: { query_params } } }),
    cache: 'no-store',
  });
  const j = await res.json();
  const text: string | undefined = j?.result?.content?.[0]?.text;
  return (j?.result?.structuredContent?.data ?? (text ? JSON.parse(text) : null)) as Record<string, unknown> | null;
}

async function busyRows(url: string, args: Record<string, string>) {
  const d = await tool(url, 'ZohoCalendar_get_busy_slots', args);
  return ((d?.userFreeBusy as Record<string, unknown>[]) ?? []) as Record<string, unknown>[];
}

const ymdCompact = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

/** The signed-in account's own meetings for the range (full details), plus the name of its default calendar. */
async function ownerEvents(url: string, from: string, to: string): Promise<{ local: string; events: CalEvent[] } | null> {
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

export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const { data: prof } = await sb.from('profiles').select('role').eq('auth_user_id', u.user.id).maybeSingle();
  if (prof?.role !== 'admin') return NextResponse.json({ error: 'Only admins can view availability' }, { status: 403 });

  const url = process.env.ZOHO_MCP_URL;
  if (!url) return NextResponse.json({ error: 'not-configured' }, { status: 501 });

  const body = (await req.json()) as { emails?: string[]; from?: string; to?: string };
  const emails = [...new Set((body.emails ?? []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(e)))].slice(0, MAX_EMAILS);
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!emails.length || !day.test(body.from ?? '') || !day.test(body.to ?? '')) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const sdate = body.from!.replace(/-/g, '') + 'T000000';
  const edate = body.to!.replace(/-/g, '') + 'T235959';

  const results: Record<string, Avail> = {};
  const chunks: string[][] = [];
  for (let i = 0; i < emails.length; i += CHUNK) chunks.push(emails.slice(i, i + CHUNK));
  const [owner] = await Promise.all([
    ownerEvents(url, body.from!, body.to!),
    ...chunks.map(async (group) => {
      try {
        const rows = await busyRows(url, { attendees: group.join(','), sdate, edate, duration: '30', mode: 'busyslots' });
        for (const r of rows) {
          const email = String(r.emailid ?? '').toLowerCase();
          const err = typeof r.error === 'string' ? r.error : '';
          if (!err) results[email] = { status: 'ok', slots: slotsOf(r) };
          else if (/not enabled/i.test(err)) results[email] = { status: 'not-shared', slots: [] };
          else if (/non zoho|not a calendar/i.test(err)) results[email] = { status: 'no-calendar', slots: [] };
          else results[email] = { status: 'error', slots: [], message: err };
        }
      } catch {
        for (const e of group) results[e] ??= { status: 'error', slots: [], message: 'Calendar did not respond' };
      }
    }),
  ]);
  for (const e of emails) results[e] ??= { status: 'error', slots: [], message: 'No answer for this email' };

  // the signed-in account: exact meetings instead of free/busy (its calendar may not be in free/busy at all)
  if (owner?.local) {
    const mine = emails.find((e) => e.split('@')[0] === owner.local);
    if (mine)
      results[mine] = {
        status: 'ok',
        events: owner.events,
        slots: owner.events.filter((e) => !e.allDay).map((e) => ({ start: e.start, end: e.end })),
      };
  }
  return NextResponse.json({ results });
}
