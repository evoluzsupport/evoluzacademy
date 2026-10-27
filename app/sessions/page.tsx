'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePortal } from '@/lib/store';
import { visibleCourses } from '@/lib/selectors';
import { downloadCSV } from '@/lib/csv';
import { fmtDate } from '@/lib/util';
import { Empty, Guard, PageHead } from '@/components/ui';

export default function SessionsPage() {
  const { S, me, confirm, undoSession } = usePortal();
  // trainers only see sessions for the courses assigned to them
  const allowed = new Set(visibleCourses(S, me).map((c) => c.id));
  const [q, setQ] = useState('');
  const [attendee, setAttendee] = useState('');
  const [trainerBy, setTrainerBy] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const people = [...S.admins, ...S.trainers, ...S.trainees];
  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? '(removed)';
  const topicNames = (s: (typeof S.sessions)[number]) => {
    const c = S.courses.find((x) => x.id === s.courseId);
    return s.topicIds.map((id) => c?.topics.find((t) => t.id === id)?.topic ?? '(removed)');
  };
  const base = S.sessions.filter((x) => allowed.has(x.courseId));
  const attendeeOptions = [...new Map(base.flatMap((x) => x.traineeIds).map((id) => [id, personName(id)])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const trainerOptions = [...new Set(base.map((x) => x.trainer).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const needle = q.trim().toLowerCase();
  const list = base
    .filter((x) => !attendee || x.traineeIds.includes(attendee))
    .filter((x) => !trainerBy || x.trainer === trainerBy)
    .filter((x) => (!from || x.date >= from) && (!to || x.date <= to))
    .filter((x) => !needle || [x.courseName, x.trainer, ...x.traineeIds.map(personName), ...topicNames(x)].join(' ').toLowerCase().includes(needle))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const filtering = !!(needle || attendee || trainerBy || from || to);

  const exportCSV = () =>
    downloadCSV(
      [
        ['Date', 'Course', 'Trainer', 'Attendees', 'Topics covered', 'New marks', 'Existing preserved'],
        ...list.map((s) => {
          return [
            s.date,
            s.courseName,
            s.trainer,
            s.traineeIds.map(personName).join('; '),
            topicNames(s).join('; '),
            s.newMarks,
            s.existingPreserved,
          ];
        }),
      ],
      'evoluz-sessions.csv'
    );

  return (
    <Guard kinds={['admin', 'trainer']}>
      <PageHead
        title="Session history"
        desc="Every group session that was logged, with who attended and what was covered."
        actions={
          <>
            <button className="btn" onClick={exportCSV} disabled={!list.length}>Export CSV</button>
            <Link className="btn primary" href="/session">＋ Log a session</Link>
          </>
        }
      />
      <section className="card table-card">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: 12 }}>
          <input className="input" style={{ flex: '2 1 220px' }} type="search" placeholder="Search course, topic, attendee or trainer…" aria-label="Search sessions" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="select" aria-label="Attendee" value={attendee} onChange={(e) => setAttendee(e.target.value)}>
            <option value="">Attendee: all</option>
            {attendeeOptions.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <select className="select" aria-label="Trainer" value={trainerBy} onChange={(e) => setTrainerBy(e.target.value)}>
            <option value="">Trainer: all</option>
            {trainerOptions.map((n) => <option key={n}>{n}</option>)}
          </select>
          <input className="input" type="date" aria-label="From date" title="From date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <input className="input" type="date" aria-label="To date" title="To date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          {filtering && <button className="btn" onClick={() => { setQ(''); setAttendee(''); setTrainerBy(''); setFrom(''); setTo(''); }}>Clear</button>}
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Course</th><th>Trainer</th><th>Attendees</th><th>Topics</th><th>Marks</th><th></th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.date)}</td>
                  <td><b>{s.courseName}</b></td>
                  <td>{s.trainer}</td>
                  <td>{s.traineeIds.map(personName).join(', ')}</td>
                  <td>{topicNames(s).join(', ')}</td>
                  <td>
                    {s.newMarks} new{s.existingPreserved ? <span className="subtle"> · {s.existingPreserved} kept</span> : null}
                  </td>
                  <td>
                    <button
                      className="btn"
                      onClick={() => confirm('Undo this session? The completion marks it created will be removed.', () => undoSession(s.id), 'Undo session')}
                    >
                      Undo
                    </button>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7}><Empty>{filtering ? 'No sessions match these filters.' : 'No sessions logged yet. Use “Log a session” to record a group session.'}</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Guard>
  );
}
