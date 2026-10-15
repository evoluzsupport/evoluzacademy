'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { match, usePortal } from '@/lib/store';
import { scopeTrainees } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { downloadCSV } from '@/lib/csv';
import type { Kind } from '@/lib/types';
import { Avatar, Empty, Guard, PageHead } from '@/components/ui';
import { TrainerForm } from '@/components/forms';
import { ImportDialog } from '@/components/csvdialog';
import { ViewBody, ViewSwitch, useView } from '@/components/views';
import type { Grouper } from '@/components/views';

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
  const { S, me, openModal, confirm, update, toast, setRole, removeTrainers } = usePortal();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const isAdmin = me?.kind === 'admin';
  const isTrainee = me?.kind === 'trainee';
  const view = useView('trainers');
  const groupers: Grouper<Row>[] = [
    { key: 'access', label: 'Access', of: (r) => (r.id.startsWith('name:') ? 'Not a user' : r.kind[0].toUpperCase() + r.kind.slice(1)) },
    { key: 'role', label: 'Role', of: (r) => r.title },
  ];

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

  // Trainee: the Assigned Trainer comes straight from My Course, i.e. the trainer on each of
  // their assignments (else the course's primary trainer, else their contact trainer).
  if (me?.kind === 'trainee') {
    const mine = scopeTrainees(S, me)[0];
    const real = (v?: string) => (v && v !== 'No Trainer Assigned' ? v : '');
    const assignedNames = new Map<string, string>();
    for (const a of S.assignments.filter((x) => x.traineeId === me.id)) {
      const c = S.courses.find((x) => x.id === a.courseId);
      if (!c) continue;
      const v = real(a.trainer) || real(primaryOf(c)) || real(mine?.trainer);
      names(v).forEach((n) => !assignedNames.has(norm(n)) && assignedNames.set(norm(n), n));
    }
    const rows: Row[] = [];
    for (const [k, n] of assignedNames) {
      const person = all.find((r) => norm(r.name) === k && r.id !== me.id);
      rows.push(person ?? { id: 'name:' + k, name: n, tone: '', title: '', email: '', kind: 'trainer' });
    }
    pool = rows;
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

  // only people with the Trainer access role can be removed from the directory
  const removable = list.filter((r) => r.kind === 'trainer' && !r.id.startsWith('name:'));
  const chosen = removable.filter((r) => picked.has(r.id));
  const allOn = removable.length > 0 && chosen.length === removable.length;
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setPicked(allOn ? new Set() : new Set(removable.map((r) => r.id)));
  const deleteChosen = () =>
    confirm(
      `Remove ${chosen.length} ${chosen.length === 1 ? 'trainer' : 'trainers'} from the trainer directory? Courses they lead and past completions keep their name.`,
      () => {
        removeTrainers(chosen.map((r) => r.id));
        setPicked(new Set());
      },
      'Delete'
    );

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
        <ViewSwitch view={view} groupers={groupers} />
        {isAdmin && chosen.length > 0 && (
          <button className="btn" style={{ marginLeft: 'auto', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={deleteChosen}>
            Delete selected ({chosen.length})
          </button>
        )}
      </div>
      <section className="card table-card">
        <ViewBody
          view={view}
          items={list}
          groupers={groupers}
          id={(r) => r.id}
          empty={<Empty>No trainers to show.</Empty>}
          card={(r) => (
            <div className="vcard">
              <div className="vtop">
                {isTrainee || r.id.startsWith('name:') ? (
                  <div className="person"><Avatar name={r.name} tone={r.tone} />{r.name}</div>
                ) : (
                  <Link className="person" href={`/trainers/${r.id}`}><Avatar name={r.name} tone={r.tone} />{r.name}</Link>
                )}
                {isAdmin && r.kind === 'trainer' && !r.id.startsWith('name:') && (
                  <input type="checkbox" className="row-check" aria-label={`Select ${r.name}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                )}
              </div>
              <div className="vmail">{r.email || (isAdmin ? 'No login email yet' : '—')}</div>
              <dl className="vmeta">
                <div><dt>Role</dt><dd>{r.title || '—'}</dd></div>
                <div><dt>Access</dt><dd>{r.id.startsWith('name:') ? 'Not a user' : r.kind[0].toUpperCase() + r.kind.slice(1)}</dd></div>
                <div><dt>Primary courses</dt><dd>{led(r)}</dd></div>
                <div><dt>Completion marks</dt><dd>{delivered(r)}</dd></div>
              </dl>
              {isAdmin && !r.id.startsWith('name:') && (
                <div className="vfoot" style={{ justifyContent: 'flex-end' }}>
                  <Link className="btn soft" href={`/trainers/${r.id}`}>View →</Link>
                  {r.kind === 'trainer' ? (
                    <>
                      <button className="btn" onClick={() => openModal(<TrainerForm id={r.id} />)}>Edit</button>
                      <button className="btn" aria-label={`Remove ${r.name}`} onClick={() => del(r.id, r.name)}>×</button>
                    </>
                  ) : (
                    <button className="btn" onClick={() => setRole(r.id, 'trainer')}>Make trainer</button>
                  )}
                </div>
              )}
            </div>
          )}
          list={
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: 34 }}>
                    <input type="checkbox" className="row-check" aria-label="Select all trainers" checked={allOn} disabled={!removable.length} onChange={toggleAll} />
                  </th>
                )}
                <th>{isTrainee ? 'Assigned Trainer' : 'Trainer'}</th>
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
                  {isAdmin && (
                    <td>
                      {r.kind === 'trainer' && !r.id.startsWith('name:') && (
                        <input type="checkbox" className="row-check" aria-label={`Select ${r.name}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                      )}
                    </td>
                  )}
                  <td>
                    {isTrainee || r.id.startsWith('name:') ? (
                      <div className="person"><Avatar name={r.name} tone={r.tone} />{r.name}</div>
                    ) : (
                      <Link className="person" href={`/trainers/${r.id}`}><Avatar name={r.name} tone={r.tone} />{r.name}</Link>
                    )}
                  </td>
                  <td>{r.title || '—'}</td>
                  <td><span className={`pill ${r.kind === 'trainer' ? 'active' : r.kind === 'admin' ? 'progress' : 'neutral'}`}>{r.id.startsWith('name:') ? 'Not a user' : r.kind[0].toUpperCase() + r.kind.slice(1)}</span></td>
                  <td>{r.email || <span className="subtle">{isAdmin ? 'No login email yet' : '—'}</span>}</td>
                  <td>{led(r)}</td>
                  <td>{delivered(r)}</td>
                  {isAdmin && (
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {r.kind === 'trainer' ? (
                          <>
                            <Link className="btn soft" href={`/trainers/${r.id}`}>View →</Link>
                            <button className="btn" onClick={() => openModal(<TrainerForm id={r.id} />)}>Edit</button>
                            <button className="btn" aria-label={`Remove ${r.name}`} onClick={() => del(r.id, r.name)}>×</button>
                          </>
                        ) : (
                          <>
                            <Link className="btn soft" href={`/trainers/${r.id}`}>View →</Link>
                            <button className="btn" onClick={() => setRole(r.id, 'trainer')} title="Change this person's access role to Trainer">Make trainer</button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          }
        />
        {view.mode === 'list' && !list.length && <Empty>No trainers to show.</Empty>}
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
