'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePortal } from '@/lib/store';
import { assignmentsOf, learners, nameMatches, orderedTopics, progressFor, scopeTrainees, statCourse } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { downloadCSV } from '@/lib/csv';
import { fmtDate, isOverdue } from '@/lib/util';
import { Avatar, Guard, Pill, ProgressBar, SectionTitle, Stat } from '@/components/ui';
import type { ReactNode } from 'react';
import { AssignDialog, TraineeForm } from '@/components/forms';
import { TopicRow } from '@/components/topic';

export default function TraineeDetail() {
  const { id } = useParams<{ id: string }>();
  const { S, me, openModal, confirm, removeTrainee, unassign } = usePortal();
  const router = useRouter();
  // course panels the user has collapsed
  const [shut, setShut] = useState<Set<string>>(new Set());
  const flip = (key: string) =>
    setShut((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const jump = (key: string) => {
    setShut((p) => {
      const n = new Set(p);
      n.delete(key);
      return n;
    });
    setTimeout(() => document.getElementById('course-' + key)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const t = learners(S).find((x) => x.id === id);
  // trainers and admins taking a course appear as learners but have no trainee profile to edit or remove
  const isRecord = S.trainees.some((x) => x.id === id);
  const visible = scopeTrainees(S, me).some((x) => x.id === id);
  const isAdmin = me?.kind === 'admin';

  if (!t || !visible) {
    return (
      <Guard kinds={['admin', 'trainer']}>
        <section className="card empty">
          Trainee not found. <Link href="/trainees" style={{ color: '#3158b6' }}>Back to trainees</Link>
        </section>
      </Guard>
    );
  }

  const p = progressFor(S, t);
  const as = assignmentsOf(S, t.id);
  const real = (v?: string) => (v && v !== 'No Trainer Assigned' ? v : '');
  /** trainer names for an assignment, each linked to that trainer's report when they are in the directory */
  const trainerLinks = (names: string): ReactNode =>
    names
      .split(/ *[/&,;] */)
      .filter(Boolean)
      .map((n, i) => {
        const who = [...S.trainers, ...S.admins].find((p) => nameMatches(n, p.name));
        return (
          <span key={n + i}>
            {i > 0 && ', '}
            {who ? <Link className="list-link" href={`/trainers/${who.id}`}>{n}</Link> : n}
          </span>
        );
      });
  const exportProgress = () =>
    downloadCSV(
      [
        ['Trainee', 'Course', 'Day', 'Topic', 'Status', 'Completion date', 'Delivered by'],
        ...as.flatMap((a) => {
          const c = S.courses.find((x) => x.id === a.courseId);
          return (c?.topics ?? []).map((tp) => {
            const r = S.progress[`${t.id}|${c!.id}|${tp.id}`];
            return [t.name, c!.name, tp.day, tp.topic, r?.done ? 'Completed' : 'Pending', r?.date ?? '', r?.trainer ?? ''];
          });
        }),
      ],
      `evoluz-${t.name.toLowerCase().replace(/\s+/g, '-')}-progress.csv`
    );

  return (
    <Guard kinds={['admin', 'trainer']}>
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link href="/trainees">← Back to trainees</Link></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <Avatar name={t.name} tone={t.tone} />
            <div>
              <h1>{t.name}</h1>
              <p>{t.jobRole} · Joined {fmtDate(t.joined)} · {t.email}</p>
            </div>
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={exportProgress}>Export progress</button>
          {isAdmin && isRecord && <button className="btn" onClick={() => openModal(<TraineeForm id={t.id} />)}>Edit</button>}
          {isAdmin && isRecord && (
            <button
              className="btn"
              onClick={() =>
                confirm(`Remove ${t.name} and their individual topic records?`, () => {
                  removeTrainee(t.id);
                  router.replace('/trainees');
                })
              }
            >
              Remove trainee
            </button>
          )}
          <button className="btn primary" onClick={() => openModal(<AssignDialog traineeId={t.id} />)}>＋ Assign course</button>
        </div>
      </div>
      <div className="grid stats">
        <Stat label="Overall progress" note={`${p.done} of ${p.total} topics completed`}>{p.pct}%</Stat>
        <Stat label="Assigned paths" note="Common and role-specific training">{as.length}</Stat>
        <Stat label="Training contact"><span style={{ fontSize: 20 }}>{t.trainer || 'Unassigned'}</span></Stat>
        <Stat label="Learner status"><span style={{ fontSize: 20 }}>{t.status}</span></Stat>
      </div>
      {as.length > 0 && (
        <section className="card section-card" style={{ marginBottom: 14 }}>
          <SectionTitle title="Courses, trainers and topics" right={<span className="subtle">Open a course to see its topics and who teaches them</span>} />
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Course</th><th>Trainer</th><th>Start date</th><th>Due</th><th>Topics</th><th>Progress</th></tr></thead>
              <tbody>
                {as.map((a) => {
                  const c = S.courses.find((x) => x.id === a.courseId);
                  if (!c) return null;
                  const st = statCourse(S, t.id, c);
                  const trainer = real(a.trainer) || real(primaryOf(c)) || real(t.trainer) || 'No Trainer Assigned';
                  return (
                    <tr key={a.id}>
                      <td>
                        <button className="collapse-btn" onClick={() => jump(a.id)} title="Show this course's topics below">
                          <span className="chev">▸</span> {c.name}
                        </button>
                      </td>
                      <td>{trainerLinks(trainer)}</td>
                      <td>{a.startDate ? fmtDate(a.startDate) : '—'}</td>
                      <td>{a.due ? fmtDate(a.due) : '—'}</td>
                      <td>{st.done} / {st.total}</td>
                      <td><ProgressBar pct={st.pct} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <div className="grid" style={{ gap: 14 }}>
        {as.map((a) => {
          const c = S.courses.find((x) => x.id === a.courseId);
          if (!c) return null;
          const x = statCourse(S, t.id, c);
          const topics = orderedTopics(c);
          const overdue = isOverdue(a.due, x.pct);
          return (
            <section className="card detail-panel" key={a.id} id={`course-${a.id}`}>
              <SectionTitle
                title={
                  <button className={`collapse-btn ${shut.has(a.id) ? '' : 'open'}`} aria-expanded={!shut.has(a.id)} onClick={() => flip(a.id)} title={shut.has(a.id) ? 'Expand topics' : 'Collapse topics'}>
                    <span className="chev">▸</span> {c.name}
                  </button>
                }
                sub={
                  <>
                    {x.done} of {x.total} topics complete · {x.pct}% · Primary trainer: {primaryOf(c)}
                    {a.startDate && <> · <Pill kind="neutral">Starts {fmtDate(a.startDate)}</Pill></>}
                    {a.due && <> · <Pill kind={overdue ? 'overdue' : 'neutral'}>{overdue ? 'Overdue · ' : 'Due '}{fmtDate(a.due)}</Pill></>}
                  </>
                }
                right={
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <ProgressBar pct={x.pct} />
                    <button className="btn" onClick={() => confirm('Remove this course from the trainee? Their topic records for it stay on file.', () => unassign(a.id), 'Remove course')}>Remove</button>
                  </div>
                }
              />
              {!shut.has(a.id) && topics.slice(0, 5).map((tp) => <TopicRow key={tp.id} traineeId={t.id} course={c} topic={tp} editable={me?.kind !== 'trainee'} />)}
              {!shut.has(a.id) && topics.length > 5 && <Link className="btn" href={`/tracker?trainee=${t.id}&course=${c.id}`}>Open full tracker →</Link>}
            </section>
          );
        })}
        {!as.length && <section className="card empty">No courses assigned yet. Use “Assign course” to create this learner’s path.</section>}
      </div>
    </Guard>
  );
}
