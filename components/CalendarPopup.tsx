'use client';
import { useEffect } from 'react';
import { addDays, fullWeek, hm, ymd } from '@/lib/availability';
import type { Avail } from '@/lib/availability';

const FIRST = 7; // first hour shown
const LAST = 22; // last hour shown (end of grid)
const PX = 46; // pixels per hour
const GRID_H = (LAST - FIRST) * PX;

interface Block {
  title: string;
  startMin: number;
  endMin: number;
  sub?: string;
  exact: boolean;
}
interface Placed extends Block {
  lane: number;
  lanes: number;
}

const minutes = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

/** Side-by-side lanes for blocks that overlap in time. */
function place(blocks: Block[]): Placed[] {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: Placed[] = [];
  let group: Placed[] = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = group.reduce((m, g) => Math.max(m, g.lane + 1), 1);
    group.forEach((g) => (g.lanes = lanes));
    out.push(...group);
    group = [];
  };
  for (const b of sorted) {
    if (group.length && b.startMin >= groupEnd) flush();
    const taken = new Set(group.filter((g) => g.endMin > b.startMin).map((g) => g.lane));
    let lane = 0;
    while (taken.has(lane)) lane++;
    group.push({ ...b, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, b.endMin);
  }
  flush();
  return out;
}

/** A Zoho-style week calendar for one person. Real meetings when we have them, otherwise "Busy" blocks. */
export function CalendarPopup({
  name,
  email,
  role,
  avail,
  monday,
  loading,
  onWeek,
  onClose,
}: {
  name: string;
  email: string;
  role: string;
  avail?: Avail;
  monday: Date;
  loading: boolean;
  onWeek: (d: Date) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const days = fullWeek(monday);
  const exact = !!avail?.events;
  const todayKey = ymd(new Date());
  const hours = Array.from({ length: LAST - FIRST }, (_, i) => FIRST + i);

  const forDay = (day: string): Block[] => {
    const src = exact
      ? (avail!.events ?? []).filter((e) => !e.allDay).map((e) => ({ title: e.title, start: e.start, end: e.end, sub: e.organizer ? `by ${e.organizer.split('@')[0]}` : undefined }))
      : (avail?.slots ?? []).map((s) => ({ title: 'Busy', start: s.start, end: s.end, sub: undefined as string | undefined }));
    return src
      .filter((s) => s.start.slice(0, 10) <= day && s.end.slice(0, 10) >= day)
      .map((s) => ({
        title: s.title,
        sub: s.sub,
        exact,
        startMin: s.start.slice(0, 10) < day ? 0 : minutes(s.start),
        endMin: s.end.slice(0, 10) > day ? 24 * 60 : minutes(s.end),
      }));
  };
  const allDay = (day: string) => (avail?.events ?? []).filter((e) => e.allDay && e.start.slice(0, 10) <= day && e.end.slice(0, 10) >= day);
  const total = days.reduce((n, d) => n + forDay(ymd(d)).length, 0);
  const range = `${days[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={`${name}'s calendar`} style={{ width: 'min(1040px, 96vw)', maxHeight: '92vh', overflow: 'auto', padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0 }}>{name} <span className="pill neutral">{role}</span></h2>
            <p style={{ margin: '4px 0 0' }}>{email}</p>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => onWeek(addDays(monday, -7))}>‹ Prev</button>
            <button className="btn" onClick={() => onWeek(addDays(monday, 7))}>Next ›</button>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="toolbar" style={{ margin: '12px 0 10px', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 13 }}>{range}</b>
          <span className="pill progress">{total} {exact ? (total === 1 ? 'meeting' : 'meetings') : total === 1 ? 'busy slot' : 'busy slots'}</span>
          {loading && <span className="subtle">Loading…</span>}
        </div>
        {!avail || avail.status !== 'ok' ? (
          <section className="card empty">
            {!avail ? 'Loading…' : avail.status === 'not-shared' ? 'Free/busy sharing is off in this Zoho Calendar, so nothing can be shown.' : avail.status === 'no-calendar' ? 'No Zoho Calendar for this email.' : 'Could not read this calendar.'}
          </section>
        ) : (
          <>
            {!exact && <p className="subtle" style={{ margin: '0 0 8px' }}>Only busy time is shared for this person, so meeting titles are not shown.</p>}
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--line)', background: '#fbfcfe' }}>
                <div />
                {days.map((d) => {
                  const k = ymd(d);
                  const ad = allDay(k);
                  return (
                    <div key={k} style={{ padding: '8px 6px', borderLeft: '1px solid var(--line)', textAlign: 'center', minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: '#8a96a8' }}>{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: k === todayKey ? '#2e70c7' : undefined }}>{d.getDate()}</div>
                      {ad.map((e, i) => (
                        <div key={i} title={e.title} style={{ marginTop: 3, fontSize: 9, background: '#e4f0d4', borderRadius: 4, padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div style={{ maxHeight: '58vh', overflow: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(7, minmax(0, 1fr))', position: 'relative' }}>
                  <div>
                    {hours.map((h) => (
                      <div key={h} style={{ height: PX, fontSize: 10, color: '#98a3b1', textAlign: 'right', padding: '0 8px 0 0', transform: 'translateY(-6px)' }}>
                        {h === FIRST ? '' : hm(h * 60)}
                      </div>
                    ))}
                  </div>
                  {days.map((d) => {
                    const k = ymd(d);
                    const blocks = place(forDay(k));
                    return (
                      <div
                        key={k}
                        style={{
                          position: 'relative',
                          height: GRID_H,
                          borderLeft: '1px solid var(--line)',
                          background: `repeating-linear-gradient(to bottom, transparent 0, transparent ${PX - 1}px, #eef1f6 ${PX - 1}px, #eef1f6 ${PX}px)`,
                        }}
                      >
                        {blocks.map((b, i) => {
                          const top = Math.max(0, ((b.startMin - FIRST * 60) / 60) * PX);
                          const bottom = Math.min(GRID_H, ((b.endMin - FIRST * 60) / 60) * PX);
                          if (bottom <= 0 || top >= GRID_H) return null;
                          const h = Math.max(18, bottom - top - 1);
                          return (
                            <div
                              key={i}
                              title={`${b.title} · ${hm(b.startMin)}–${hm(Math.min(b.endMin, 24 * 60 - 1))}${b.sub ? ` · ${b.sub}` : ''}`}
                              style={{
                                position: 'absolute',
                                top,
                                height: h,
                                left: `calc(${(b.lane / b.lanes) * 100}% + 2px)`,
                                width: `calc(${100 / b.lanes}% - 4px)`,
                                background: b.exact ? '#e4f0d4' : '#e9eef8',
                                borderLeft: `3px solid ${b.exact ? '#8cbf40' : '#7d94c9'}`,
                                borderRadius: 5,
                                padding: '2px 5px',
                                fontSize: 10,
                                lineHeight: 1.3,
                                overflow: 'hidden',
                                color: '#26344b',
                              }}
                            >
                              <b style={{ display: 'block', textTransform: 'none' }}>{b.title}</b>
                              <span style={{ color: '#6a7790' }}>{hm(b.startMin)}–{hm(Math.min(b.endMin, 24 * 60 - 1))}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
