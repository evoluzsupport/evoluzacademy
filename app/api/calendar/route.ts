import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Avail } from '@/lib/availability';
import { isZohoMcpUrl, ownerEvents } from '@/lib/zohoMcp';

export const runtime = 'nodejs';

/** The signed-in person's own meetings, read through the Zoho MCP link they saved (row-level security keeps it theirs). */
export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string };
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!day.test(body.from ?? '') || !day.test(body.to ?? '')) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const { data: row, error } = await sb.from('calendar_connections').select('mcp_url').maybeSingle();
  if (error) return NextResponse.json({ error: 'Calendar storage is not set up yet' }, { status: 501 });
  if (!row?.mcp_url) return NextResponse.json({ error: 'not-connected' }, { status: 404 });
  if (!isZohoMcpUrl(row.mcp_url)) return NextResponse.json({ error: 'That is not a Zoho MCP link' }, { status: 400 });

  const own = await ownerEvents(row.mcp_url, body.from!, body.to!);
  if (!own) return NextResponse.json({ error: 'The saved link did not return a calendar. Check it and save again.' }, { status: 502 });
  const avail: Avail = { status: 'ok', events: own.events, slots: own.events.filter((e) => !e.allDay).map((e) => ({ start: e.start, end: e.end })) };
  return NextResponse.json({ avail });
}
