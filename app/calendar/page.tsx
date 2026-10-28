'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { usePortal } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Guard, PageHead } from '@/components/ui';
import { WeekGrid } from '@/components/CalendarPopup';
import { addDays, fullWeek, mondayOf, ymd } from '@/lib/availability';
import type { Avail } from '@/lib/availability';

const looksValid = (v: string) => /^https:\/\/[a-z0-9-]+\.zohomcp\.[a-z.]+\/\S+$/i.test(v.trim());

/** My calendar: save the Zoho MCP link once (kept in the database, editable), then see my own meetings. */
export default function CalendarPage() {
  const { me, toast } = usePortal();
  const [saved, setSaved] = useState<string | null>(null); // null = not loaded yet, '' = none
  const [editing, setEditing] = useState(false);
  const [link, setLink] = useState('');
  const [setup, setSetup] = useState(true);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [avail, setAvail] = useState<Avail>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!me) return;
    let live = true;
    (async () => {
      const { data, error } = await supabase.from('calendar_connections').select('mcp_url').eq('profile_id', me.id).maybeSingle();
      if (!live) return;
      if (error) {
        setSetup(false);
        setSaved('');
      } else setSaved(data?.mcp_url ?? '');
    })();
    return () => {
      live = false;
    };
  }, [me]);

  const from = ymd(monday);
  const to = ymd(fullWeek(monday)[6]);
  const load = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      const { data: s } = await supabase.auth.getSession();
      const r = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
        body: JSON.stringify({ from, to }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setAvail(j.avail);
      else {
        setAvail(undefined);
        setErr(j.error || 'Could not load your calendar');
      }
    } catch {
      setErr('Could not reach the calendar service');
    } finally {
      setBusy(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (saved) void load();
  }, [saved, load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const url = link.trim();
    if (!looksValid(url)) return toast('Paste your Zoho MCP link (https://…zohomcp…)');
    if (!me) return;
    const { error } = await supabase.from('calendar_connections').upsert({ profile_id: me.id, mcp_url: url, updated_at: new Date().toISOString() });
    if (error) return toast(setup ? 'Could not save the link' : 'Saving is not switched on yet. Ask an admin to run supabase/calendar.sql');
    setSaved(url);
    setEditing(false);
    setLink('');
    toast('Calendar link saved');
  };

  const week = fullWeek(monday);
  const range = `${week[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${week[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const showForm = saved === '' || editing;

  return (
    <Guard kinds={['admin', 'trainer', 'trainee']}>
      <PageHead title="Calendar" desc="Connect your Zoho Calendar once with your MCP link. Your meetings show here, and admins can see your availability." />
      {!setup && <section className="card empty" style={{ marginBottom: 14 }}>Saving isn’t switched on yet: the calendar table is missing in the database. An admin needs to run supabase/calendar.sql once.</section>}
      {saved !== null && (
        <section className="card" style={{ padding: 16, marginBottom: 14 }}>
          {showForm ? (
            <form onSubmit={save} style={{ display: 'grid', gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 700 }}>Zoho MCP link</label>
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://yourname-123.zohomcp.in/mcp/…" autoComplete="off" spellCheck={false} />
              <small className="subtle">Keep this link private: it gives access to your calendar. It is saved to your account only, and admins never see the link itself.</small>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn primary" type="submit">{saved ? 'Update link' : 'Connect calendar'}</button>
                {editing && <button className="btn" type="button" onClick={() => { setEditing(false); setLink(''); }}>Cancel</button>}
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="pill active">Connected</span>
              <code style={{ fontSize: 12 }}>{saved!.replace(/^(https:\/\/[^/]+\/).*/, '$1…')}</code>
              <button className="btn" onClick={() => { setLink(saved!); setEditing(true); }}>Edit link</button>
            </div>
          )}
        </section>
      )}
      {setup && !!saved && !editing && (
        <>
          <div className="toolbar" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => setMonday(addDays(monday, -7))}>‹ Prev</button>
            <button className="btn" onClick={() => setMonday(mondayOf(new Date()))}>This week</button>
            <button className="btn" onClick={() => setMonday(addDays(monday, 7))}>Next ›</button>
            <b style={{ fontSize: 13 }}>{range}</b>
            {busy && <span className="subtle">Loading…</span>}
          </div>
          {err ? <section className="card empty">{err}</section> : avail ? <WeekGrid avail={avail} monday={monday} /> : <section className="card empty">{busy ? 'Loading calendar…' : 'No calendar data.'}</section>}
        </>
      )}
    </Guard>
  );
}
