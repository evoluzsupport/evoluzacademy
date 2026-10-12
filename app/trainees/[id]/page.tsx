'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { usePortal } from '@/lib/store';
import { assignmentsOf, orderedTopics, progressFor, scopeTrainees, statCourse } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { downloadCSV } from '@/lib/csv';
import { fmtDate, isOverdue } from '@/lib/util';
import { Avatar, Guard, Pill, ProgressBar, SectionTitle, Stat } from '@/components/ui';
import { AssignDialog, TraineeForm } from '@/components/forms';
import { TopicRow } from '@/components/topic';

export default function TraineeDetail() {
  const { id } = useParams<{ id: string }>();
  const { S, me, openModal, confirm, removeTrainee, unassign } = usePortal();
  const router = useRouter();
  const t = S.trainees.find((x) => x.id === id);
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
          {isAdmin && <button className="btn" onClick={() => openModal(<TraineeForm id={t.id} />)}>Edit profile</button>}
          {isAdmin && (
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
      <div className="grid" style={{ gap: 14 }}>
        {as.map((a) => {
          const c = S.courses.find((x) => x.id === a.courseId);
          if (!c) return null;
          const x = statCourse(S, t.id, c);
          const topics = orderedTopics(c);
          const overdue = isOverdue(a.due, x.pct);
          return (
            <section className="card detail-panel" key={a.id}>
              <SectionTitle
                title={c.name}
                sub={
                  <>
                    {x.done} of {x.total} topics complete · {x.pct}% · Primary trainer: {primaryOf(c)}
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
              {topics.slice(0, 5).map((tp) => <TopicRow key={tp.id} traineeId={t.id} course={c} topic={tp} editable />)}
              {topics.length > 5 && <Link className="btn" href={`/tracker?trainee=${t.id}&course=${c.id}`}>Open full tracker →</Link>}
            </section>
          );
        })}
        {!as.length && <section className="card empty">No courses assigned yet. Use “Assign course” to create this learner’s path.</section>}
      </div>
    </Guard>
  );
}
