'use client';
import { useEffect, useMemo, useState } from 'react';
import { usePortal } from '@/lib/store';
import { learners } from '@/lib/selectors';
import { supabase } from '@/lib/supabase';
import { addDays, fullWeek, mondayOf, ymd } from '@/lib/availability';
import type { Avail } from '@/lib/availability';
import { WeekGrid } from './CalendarPopup';

type Role = 'Trainer' | 'Trainee' | 'Admin';

const NOTE: Record<string, string> = {
  'not-shared': 'Free/busy sharing is off in this Zoho Calendar, so nothing can be shown.',
  'no-calendar': 'No Zoho Calendar for this email.',
  error: 'Could not read this calendar.',
};

/** "Available Slot for Training": pick a role, then a member, and see that member's week calendar. */
export function AvailabilityBox({ role: initial = 'Trainer', email: initialEmail = '' }: { role?: Role; email?: string }) {
  const { S } = usePortal();
  const [role, setRole] = useState<Role>(initial);
  const [email, setEmail] = useState(initialEmail);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [avail, setAvail] = useState<Avail>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const members = useMemo(() => {
    const src = role === 'Admin' ? S.admins : role === 'Trainer' ? S.trainers : learners(S);
    const seen = new Set<string>();
    return src
      .map((p) => ({ name: p.name, email: (p.email || '').trim().toLowerCase() }))
      .filter((p) => p.email && !seen.has(p.email) && !!seen.add(p.email))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [S, role]);

  const from = ymd(monday);
  const to = ymd(fullWeek(monday)[6]);

  useEffect(() => {
    if (!email) {
      setAvail(undefined);
      setErr('');
      return;
    }
    let live = true;
    setBusy(true);
    setErr('');
    setAvail(undefined);
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        const r = await fetch('/api/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
          body: JSON.stringify({ emails: [email], from, to }),
        });
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (r.ok) setAvail(j.results?.[email]);
        else setErr(r.status === 501 ? 'The calendar connection is not set up on the server yet.' : j.error || 'Could not load availability');
      } catch {
        if (live) setErr('Could not reach the calendar service');
      } finally {
        if (live) setBusy(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [email, from, to]);

  const range = `${fullWeek(monday)[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${fullWeek(monday)[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <aside className="avail-box">
      <h3 style={{ margin: '0 0 10px', font: '800 15px Manrope' }}>Available Slot for Training</h3>
      <div className="form-grid">
        <div className="field">
          <label>Lookup</label>
          <select value={role} onChange={(e) => { setRole(e.target.value as Role); setEmail(''); }}>
            <option value="Trainer">Trainer</option>
            <option value="Trainee">Trainee</option>
            <option value="Admin">Admin</option>
          </select>
        </div>
        <div className="field">
          <label>Available Member</label>
          <select value={email} onChange={(e) => setEmail(e.target.value)}>
            <option value="">Select {role.toLowerCase()}…</option>
            {members.map((m) => <option key={m.email} value={m.email}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="toolbar" style={{ margin: '12px 0 8px', flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => setMonday(addDays(monday, -7))}>‹</button>
        <b style={{ fontSize: 12 }}>{range}</b>
        <button type="button" className="btn" onClick={() => setMonday(addDays(monday, 7))}>›</button>
        {busy && <span className="subtle">Loading…</span>}
      </div>
      {!email ? (
        <section className="card empty">Pick a {role.toLowerCase()} to see their calendar.</section>
      ) : err ? (
        <section className="card empty">{err}</section>
      ) : !avail ? (
        <section className="card empty">{busy ? 'Loading calendar…' : 'No calendar data.'}</section>
      ) : avail.status !== 'ok' ? (
        <section className="card empty">{NOTE[avail.status]}</section>
      ) : (
        <WeekGrid avail={avail} monday={monday} maxHeight="360px" />
      )}
    </aside>
  );
}
