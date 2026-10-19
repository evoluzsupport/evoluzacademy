import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Avail, Slot } from '@/lib/availability';

export const runtime = 'nodejs';

/**
 * Free/busy for a list of people from Zoho Calendar, through the Zoho MCP server in ZOHO_MCP_URL
 * (that URL holds a secret, so it only ever lives on the server). Admins only.
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

async function rpc(url: string, args: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ZohoCalendar_get_busy_slots', arguments: { query_params: args } } }),
    cache: 'no-store',
  });
  const j = await res.json();
  const text: string | undefined = j?.result?.content?.[0]?.text;
  const parsed = j?.result?.structuredContent?.data ?? (text ? JSON.parse(text) : null);
  return (parsed?.userFreeBusy ?? []) as Record<string, unknown>[];
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
  await Promise.all(
    chunks.map(async (group) => {
      try {
        const rows = await rpc(url, { attendees: group.join(','), sdate, edate, duration: '30', mode: 'busyslots' });
        for (const r of rows) {
          const email = String(r.emailid ?? '').toLowerCase();
          const err = typeof r.error === 'string' ? r.error : '';
          if (!err) results[email] = { status: 'ok', slots: slotsOf(r) };
          else if (/not enabled/i.test(err)) results[email] = { status: 'not-shared', slots: [] };
          else if (/non zoho|not a calendar/i.test(err)) results[email] = { status: 'no-calendar', slots: [] };
          else results[email] = { status: 'error', slots: [], message: err };
        }
      } catch {
        for (const e of group) results[e] = { status: 'error', slots: [], message: 'Calendar did not respond' };
      }
    })
  );
  for (const e of emails) results[e] ??= { status: 'error', slots: [], message: 'No answer for this email' };
  return NextResponse.json({ results });
}
