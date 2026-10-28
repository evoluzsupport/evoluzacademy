import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Avail } from '@/lib/availability';
import { isZohoMcpUrl, ownerEvents, slotsOf, tool } from '@/lib/zohoMcp';

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

async function busyRows(url: string, args: Record<string, string>) {
  const d = await tool(url, 'ZohoCalendar_get_busy_slots', args);
  return ((d?.userFreeBusy as Record<string, unknown>[]) ?? []) as Record<string, unknown>[];
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

  const body = (await req.json()) as { emails?: string[]; from?: string; to?: string };
  const emails = [...new Set((body.emails ?? []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(e)))].slice(0, MAX_EMAILS);
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!emails.length || !day.test(body.from ?? '') || !day.test(body.to ?? '')) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  // people who connected their own calendar: exact meetings straight from their link
  const { data: conns } = await sb.rpc('admin_calendar_urls', { p_emails: emails });
  const personal = new Map<string, string>();
  for (const c of (conns ?? []) as { email: string; mcp_url: string }[]) if (isZohoMcpUrl(c.mcp_url)) personal.set(c.email, c.mcp_url);
  const url = process.env.ZOHO_MCP_URL;
  const shared = emails.filter((e) => !personal.has(e));
  if (shared.length && !url && !personal.size) return NextResponse.json({ error: 'not-configured' }, { status: 501 });

  const sdate = body.from!.replace(/-/g, '') + 'T000000';
  const edate = body.to!.replace(/-/g, '') + 'T235959';

  const results: Record<string, Avail> = {};
  await Promise.all([
    ...[...personal].map(async ([email, link]) => {
      const own = await ownerEvents(link, body.from!, body.to!);
      results[email] = own
        ? { status: 'ok', events: own.events, slots: own.events.filter((e) => !e.allDay).map((e) => ({ start: e.start, end: e.end })) }
        : { status: 'error', slots: [], message: 'Their saved calendar link did not respond' };
    }),
    shared.length && url ? sharedAvailability(url, shared, sdate, edate, body.from!, body.to!, results) : Promise.resolve(),
  ]);
  for (const e of emails) results[e] ??= { status: 'error', slots: [], message: 'No answer for this email' };
  return NextResponse.json({ results });
}

/** Everyone without their own link: free/busy through the shared server link, exact meetings for its own account. */
async function sharedAvailability(url: string, emails: string[], sdate: string, edate: string, from: string, to: string, results: Record<string, Avail>) {
  const chunks: string[][] = [];
  for (let i = 0; i < emails.length; i += CHUNK) chunks.push(emails.slice(i, i + CHUNK));
  const [owner] = await Promise.all([
    ownerEvents(url, from, to),
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
  if (owner?.local) {
    const mine = emails.find((e) => e.split('@')[0] === owner.local);
    if (mine)
      results[mine] = {
        status: 'ok',
        events: owner.events,
        slots: owner.events.filter((e) => !e.allDay).map((e) => ({ start: e.start, end: e.end })),
      };
  }
}
