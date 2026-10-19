'use client';
import { useEffect, useMemo, useState } from 'react';
import { usePortal } from '@/lib/store';
import { learners } from '@/lib/selectors';
import { supabase } from '@/lib/supabase';
import { Avatar, Empty, Guard, PageHead } from '@/components/ui';
import { DAY_END, DAY_START, addDays, freeWindows, hm, mondayOf, weekDays, ymd } from '@/lib/availability';
import type { Avail } from '@/lib/availability';

type Role = 'All' | 'Trainer' | 'Trainee';
interface Person {
  id: string;
  name: string;
  email: string;
  role: 'Trainer' | 'Trainee';
  tone: string;
}

const NOTE: Record<string, string> = {
  'not-shared': 'Free/busy sharing is off in their Zoho Calendar',
  'no-calendar': 'No Zoho Calendar for this email',
  error: 'Could not read the calendar',
};

/** Every trainer and trainee, with the free time in their Zoho Calendar for the chosen week. */
export default function AvailabilityPage() {
  const { S } = usePortal();
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  const [role, setRole] = useState<Role>('All');
  const [q, setQ] = useState('');
  const [data, setData] = useState<Record<string, Avail>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const people = useMemo<Person[]>(() => {
    const seen = new Set<string>();
    const out: Person[] = [];
    const add = (p: { id: string; name: string; email: string; tone?: string }, r: Person['role']) => {
      const email = (p.email || '').trim().toLowerCase();
      if (!email || seen.has(email)) return;
      seen.add(email);
      out.push({ id: p.id, name: p.name, email, role: r, tone: p.tone ?? '' });
    };
    S.trainers.forEach((t) => add(t, 'Trainer'));
    learners(S).forEach((t) => add(t, 'Trainee'));
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [S]);

  const days = weekDays(monday);
  const emailKey = people.map((p) => p.email).join(',');
  const from = ymd(days[0]);
  const to = ymd(days[4]);

  useEffect(() => {
    if (!people.length) return;
    let live = true;
    setBusy(true);
    setErr('');
    (async () => {
      try {
        const { data: s } = await supabase.auth.getSession();
        const r = await fetch('/api/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
          body: JSON.stringify({ emails: people.map((p) => p.email), from, to }),
        });
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (r.ok) setData(j.results ?? {});
        else setErr(r.status === 501 ? 'The calendar connection is not set up on the server yet (ZOHO_MCP_URL).' : j.error || 'Could not load availability');
      } catch {
        if (live) setErr('Could not reach the calendar service');
      } finally {
        if (live) setBusy(false);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailKey, from, to]);

  const shown = people.filter((p) => (role === 'All' || p.role === role) && `${p.name} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const label = `${days[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${days[4].toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <Guard kinds={['admin']}>
      <PageHead
        title="Availability"
        desc={`Free time for training in each person’s Zoho Calendar, ${hm(DAY_START)}–${hm(DAY_END)} on weekdays.`}
        actions={
          <>
            <button className="btn" onClick={() => setMonday(addDays(monday, -7))}>‹ Prev</button>
            <button className="btn" onClick={() => setMonday(mondayOf(new Date()))}>This week</button>
            <button className="btn" onClick={() => setMonday(addDays(monday, 7))}>Next ›</button>
          </>
        }
      />
      <div className="toolbar" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13 }}>{label}</b>
        <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Show">
          <option value="All">Trainers and trainees</option>
          <option value="Trainer">Trainers</option>
          <option value="Trainee">Trainees</option>
        </select>
        <input className="input" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        {busy && <span className="subtle">Loading calendars…</span>}
      </div>
      {err && <section className="card empty">{err}</section>}
      {!err && !people.length && <Empty>No trainers or trainees with an email yet.</Empty>}
      {!err && !!people.length && (
        <section className="card table-card">
          <div className="table-wrap">
            <table className="table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Person</th>
                  {days.map((d) => (
                    <th key={ymd(d)}>{d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const a = data[p.email];
                  return (
                    <tr key={p.email}>
                      <td>
                        <div className="person"><Avatar name={p.name} tone={p.tone} />
                          <div>
                            <div>{p.name} <span className={`pill ${p.role === 'Trainer' ? 'progress' : 'neutral'}`}>{p.role}</span></div>
                            <small className="subtle">{p.email}</small>
                          </div>
                        </div>
                      </td>
                      {!a || a.status !== 'ok' ? (
                        <td colSpan={5} className="subtle">{!a ? (busy ? 'Loading…' : '—') : NOTE[a.status]}</td>
                      ) : (
                        days.map((d) => {
                          const free = freeWindows(ymd(d), a.slots);
                          return (
                            <td key={ymd(d)}>
                              {free.length ? (
                                <div style={{ display: 'grid', gap: 4 }}>
                                  {free.map(([s, e]) => <span key={s} className="pill active">{hm(s)}–{hm(e)}</span>)}
                                </div>
                              ) : (
                                <span className="pill overdue">Fully booked</span>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!shown.length && <Empty>No one matches that search.</Empty>}
        </section>
      )}
    </Guard>
  );
}
