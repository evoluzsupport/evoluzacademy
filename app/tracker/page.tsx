'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePortal } from '@/lib/store';
import { assignedCourses, orderedTopics, scopeTrainees, statCourse, topicKey } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { Empty, PageHead, Pill, ProgressBar, SectionTitle } from '@/components/ui';
import { fmtDate, isOverdue } from '@/lib/util';
import { TopicRow } from '@/components/topic';

function Tracker() {
  const { S, me } = usePortal();
  const params = useSearchParams();
  const [pickT, setPickT] = useState(params.get('trainee') ?? '');
  const [pickC, setPickC] = useState(params.get('course') ?? '');
  const people = scopeTrainees(S, me);
  const isTrainee = me?.kind === 'trainee';

  const t = people.find((x) => x.id === pickT) ?? people[0];
  if (!t) {
    return (
      <>
        <PageHead title="Training tracker" desc="Mark topics covered in a session; use Log a session to update a group in one go." />
        <section className="card empty">Add a trainee to get started.</section>
      </>
    );
  }
  const assigned = assignedCourses(S, t.id);
  const c = assigned.find((x) => x.id === pickC) ?? assigned[0];
  const topics = c ? orderedTopics(c) : [];
  const done = c ? topics.filter((x) => S.progress[topicKey(t.id, c.id, x.id)]?.done).length : 0;
  const resume = topics.find((x) => c && !S.progress[topicKey(t.id, c.id, x.id)]?.done);

  return (
    <>
      <PageHead
        title={isTrainee ? 'My Course' : 'Training tracker'}
        desc={isTrainee ? 'Your courses, assigned trainers and progress. Your trainer updates your topics as you complete them.' : 'Individual topic status, actual trainer, and editable completion date.'}
        actions={!isTrainee && <Link className="btn primary" href="/session">＋ Log a group session</Link>}
      />
      <section className="card detail-panel" style={{ marginBottom: 16 }}>
        <div className="filters">
          {!isTrainee && (
            <div className="field" style={{ minWidth: 190 }}>
              <label htmlFor="trk-t">Trainee</label>
              <select id="trk-t" className="select" style={{ width: '100%' }} value={t.id} onChange={(e) => { setPickT(e.target.value); setPickC(''); }}>
                {people.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ minWidth: 210 }}>
            <label htmlFor="trk-c">Course</label>
            <select id="trk-c" className="select" style={{ width: '100%' }} value={c?.id ?? ''} onChange={(e) => setPickC(e.target.value)}>
              {assigned.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
          {c && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div className="subtle">Primary trainer · {primaryOf(c)}</div>
              <strong style={{ font: '700 20px Manrope' }}>{statCourse(S, t.id, c).pct}%</strong>
              <div className="subtle">path complete</div>
            </div>
          )}
        </div>
      </section>
      {isTrainee && (
        <section className="card table-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: '14px 15px 4px' }}>
            <SectionTitle title="My course and trainer report" />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Course</th><th>Assigned trainer</th><th>Primary trainer</th><th>Assigned</th><th>Due</th><th>Progress</th><th>Status</th></tr></thead>
              <tbody>
                {S.assignments.filter((a) => a.traineeId === t.id).map((a) => {
                  const cc = S.courses.find((x) => x.id === a.courseId);
                  if (!cc) return null;
                  const st = statCourse(S, t.id, cc);
                  const overdue = isOverdue(a.due, st.pct);
                  // the trainer set on the assignment, else the course's primary trainer, else the trainee's contact
                  const real = (v?: string) => (v && v !== 'No Trainer Assigned' ? v : '');
                  const assignedTrainer = real(a.trainer) || real(primaryOf(cc)) || real(t.trainer) || 'No Trainer Assigned';
                  return (
                    <tr key={a.id}>
                      <td><b>{cc.name}</b></td>
                      <td><b>{assignedTrainer}</b></td>
                      <td>{primaryOf(cc)}</td>
                      <td>{fmtDate(a.assignedOn)}</td>
                      <td>{a.due ? fmtDate(a.due) : '—'}</td>
                      <td><ProgressBar pct={st.pct} /></td>
                      <td><Pill kind={overdue ? 'overdue' : st.pct >= 100 ? 'done' : st.pct > 0 ? 'progress' : 'wait'}>{overdue ? 'Overdue' : st.pct >= 100 ? 'Completed' : st.pct > 0 ? 'In progress' : 'Not started'}</Pill></td>
                    </tr>
                  );
                })}
                {!assigned.length && <tr><td colSpan={7}><Empty>No course assigned yet.</Empty></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {c ? (
        <div className="detail-layout">
          <section className="card detail-panel">
            <SectionTitle title={`${c.name} · ${topics.length} topics`} right={<span className="subtle">{done} complete · {topics.length - done} remaining</span>} />
            {topics.map((x) => <TopicRow key={`${t.id}-${c.id}-${x.id}`} traineeId={t.id} course={c} topic={x} editable={!isTrainee} />)}
            {isTrainee && <p className="readonly-note">View only. Your trainer marks topics as they are completed in your sessions.</p>}
          </section>
          <aside className="grid" style={{ alignContent: 'start' }}>
            <section className="card detail-panel">
              <SectionTitle title="Resume point" />
              <p className="subtle" style={{ lineHeight: 1.6 }}>
                Progress is recorded per learner. If a trainee missed a session, leave their topics open; they can resume from the next incomplete topic.
              </p>
              <b>{resume?.topic ?? 'All topics completed'}</b>
            </section>
          </aside>
        </div>
      ) : (
        <section className="card"><Empty>{isTrainee ? 'No course assigned yet.' : `Assign a course to ${t.name} to begin tracking.`}</Empty></section>
      )}
    </>
  );
}

export default function TrackerPage() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
