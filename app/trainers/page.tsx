'use client';
import { useMemo, useState } from 'react';
import { match, usePortal } from '@/lib/store';
import { assignedCourses, scopeTrainees } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { downloadCSV } from '@/lib/csv';
import type { Kind } from '@/lib/types';
import { Avatar, Empty, Guard, PageHead } from '@/components/ui';
import { TrainerForm } from '@/components/forms';
import { ImportDialog } from '@/components/csvdialog';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
/** "Jyoti Raj/ Shivangi Kumari" -> ["Jyoti Raj", "Shivangi Kumari"] */
const names = (v: string | undefined) =>
  String(v || '')
    .split(/\s*(?:\/|&|,|;|\band\b)\s*/i)
    .map((x) => x.trim())
    .filter((x) => x && !/^no trainer assigned$/i.test(x));
const PERSON = /^[A-Z][A-Za-z.'-]+(\s+[A-Za-z][A-Za-z.'-]*){0,2}$/;
const NOT_PERSON = /project|coordinator|developer|manager|owner|review|spot|trainer|training|observ|exception|dsm|where|required|senior|check/i;

interface Row {
  id: string;
  name: string;
  tone: string;
  title: string;
  email: string;
  kind: Kind;
}

export default function TrainersPage() {
  const { S, me, openModal, confirm, update, toast, setRole } = usePortal();
  const [q, setQ] = useState('');
  const isAdmin = me?.kind === 'admin';
  const isTrainee = me?.kind === 'trainee';

  // Everyone the courses and sessions name as a trainer, whatever their access role is today.
  const named = useMemo(() => {
    const set = new Map<string, string>();
    const add = (v: string | undefined) => names(v).forEach((n) => !set.has(norm(n)) && set.set(norm(n), n));
    S.courses.forEach((c) => {
      add(c.primaryTrainer);
      c.topics.forEach((t) => add(t.trainer));
    });
    S.sessions.forEach((x) => add(x.trainer));
    Object.values(S.progress).forEach((r) => add(r.trainer));
    return set;
  }, [S.courses, S.sessions, S.progress]);

  const all: Row[] = [
    ...S.trainers.map((t) => ({ id: t.id, name: t.name, tone: t.tone, title: t.specialty, email: t.email, kind: 'trainer' as Kind })),
    ...S.admins.map((a) => ({ id: a.id, name: a.name, tone: '', title: '', email: a.email, kind: 'admin' as Kind })),
    ...S.trainees.map((t) => ({ id: t.id, name: t.name, tone: t.tone, title: t.jobRole, email: t.email, kind: 'trainee' as Kind })),
  ];
  let pool = all.filter((r) => r.kind === 'trainer' || named.has(norm(r.name)));

  // trainees only see the trainers connected to their own courses
  if (me?.kind === 'trainee') {
    const mine = scopeTrainees(S, me)[0];
    const mineNames = new Set<string>();
    if (mine?.trainer) names(mine.trainer).forEach((n) => mineNames.add(norm(n)));
    assignedCourses(S, me.id).forEach((c) => names(primaryOf(c)).forEach((n) => mineNames.add(norm(n))));
    Object.entries(S.progress).forEach(([k, r]) => k.startsWith(me.id + '|') && names(r.trainer).forEach((n) => mineNames.add(norm(n))));
    pool = pool.filter((r) => mineNames.has(norm(r.name)) && r.id !== me.id);
  }
  const list = pool.filter((r) => match(q, r.name, r.title, r.email, r.kind));

  // names used in courses that nobody in the directory matches yet
  const known = new Set(all.map((r) => norm(r.name)));
  const unmatched = [...named.entries()]
    .filter(([k, n]) => !known.has(k) && PERSON.test(n) && !NOT_PERSON.test(n))
    .map(([, n]) => n);

  const del = (id: string, name: string) =>
    confirm(`Remove ${name} from the trainer directory? Courses they lead and past completions keep their name.`, () => {
      update((s) => {
        s.trainers = s.trainers.filter((t) => t.id !== id);
      });
      toast('Trainer removed');
    });

  // trainee view: which of my assigned courses each trainer teaches me
  const taughtBy = new Map<string, string[]>();
  if (isTrainee && me) {
    for (const a of S.assignments.filter((x) => x.traineeId === me.id)) {
      const c = S.courses.find((x) => x.id === a.courseId);
      if (!c) continue;
      const who = names(a.trainer).length ? names(a.trainer) : names(primaryOf(c));
      who.forEach((n) => taughtBy.set(norm(n), [...(taughtBy.get(norm(n)) ?? []), c.name]));
    }
  }

  const led = (r: Row) => S.courses.filter((c) => names(c.primaryTrainer).some((n) => norm(n) === norm(r.name))).length;
  const delivered = (r: Row) =>
    Object.values(S.progress).filter((x) => x.done && names(x.trainer).some((n) => norm(n) === norm(r.name))).length;

  return (
    <Guard kinds={['admin', 'trainee']}>
      <PageHead
        title={me?.kind === 'trainee' ? 'My Trainer' : 'Trainers'}
        desc="Everyone who leads or delivers training, including people whose access role is not Trainer."
        actions={
          isAdmin && (
            <>
              <button className="btn" onClick={() => openModal(<ImportDialog kind="trainers" />)}>Import CSV</button>
              <button className="btn" onClick={() => downloadCSV([['Name', 'Role', 'Access', 'Email'], ...list.map((t) => [t.name, t.title, t.kind, t.email])], 'evoluz-trainers.csv')}>Export CSV</button>
              <button className="btn primary" onClick={() => openModal(<TrainerForm />)}>＋ Add trainer</button>
            </>
          )
        }
      />
      <div className="toolbar" style={{ marginBottom: 15 }}>
        <input className="input" placeholder="Search trainers..." aria-label="Search trainers" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="subtle">{list.length} {list.length === 1 ? 'trainer' : 'trainers'}</span>
      </div>
      <section className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {isTrainee && <th>Assigned Course</th>}
                <th>Trainer</th>
                <th>Role</th>
                <th>Access</th>
                <th>Email</th>
                <th>Primary courses</th>
                <th>Completion marks</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  {isTrainee && <td><b>{(taughtBy.get(norm(r.name)) ?? []).join(', ') || '—'}</b></td>}
                  <td><div className="person"><Avatar name={r.name} tone={r.tone} />{r.name}</div></td>
                  <td>{r.title || '—'}</td>
                  <td><span className={`pill ${r.kind === 'trainer' ? 'active' : r.kind === 'admin' ? 'progress' : 'neutral'}`}>{r.kind[0].toUpperCase() + r.kind.slice(1)}</span></td>
                  <td>{r.email || <span className="subtle">{isAdmin ? 'No login email yet' : '—'}</span>}</td>
                  <td>{led(r)}</td>
                  <td>{delivered(r)}</td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {r.kind === 'trainer' ? (
                          <>
                            <button className="btn" onClick={() => openModal(<TrainerForm id={r.id} />)}>Edit</button>
                            <button className="btn" aria-label={`Remove ${r.name}`} onClick={() => del(r.id, r.name)}>×</button>
                          </>
                        ) : (
                          <button className="btn" onClick={() => setRole(r.id, 'trainer')} title="Change this person's access role to Trainer">Make trainer</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && <Empty>No trainers to show.</Empty>}
      </section>

      {isAdmin && unmatched.length > 0 && (
        <section className="card detail-panel" style={{ marginTop: 16 }}>
          <h3 style={{ font: '700 14px Manrope', margin: '0 0 6px' }}>Named in courses, not in Users yet ({unmatched.length})</h3>
          <p className="subtle" style={{ lineHeight: 1.6, margin: '0 0 10px' }}>
            These names appear as trainers in your course data but have no user account. Add them on the Users page to link them.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {unmatched.map((n) => <span key={n} className="pill neutral">{n}</span>)}
          </div>
        </section>
      )}
    </Guard>
  );
}
