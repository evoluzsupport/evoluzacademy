'use client';
import { useState } from 'react';
import { usePortal } from '@/lib/store';
import { assignedCourses, orderedTopics, statCourse, topicKey } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { fmtDate, isOverdue } from '@/lib/util';
import { Empty, Guard, PageHead, Pill, ProgressBar, SectionTitle } from '@/components/ui';
import { TopicRow } from '@/components/topic';

/** The courses assigned to the signed-in trainer as a learner, with a report like a trainee's. */
export default function AssignedCoursesPage() {
  const { S, me } = usePortal();
  const [pickC, setPickC] = useState('');
  if (!me) return null;

  const assigned = assignedCourses(S, me.id);
  const c = assigned.find((x) => x.id === pickC) ?? assigned[0];
  const topics = c ? orderedTopics(c) : [];
  const done = c ? topics.filter((x) => S.progress[topicKey(me.id, c.id, x.id)]?.done).length : 0;
  const real = (v?: string) => (v && v !== 'No Trainer Assigned' ? v : '');

  return (
    <Guard kinds={['trainer']}>
      <PageHead title="My Course" desc="Courses an admin has assigned to you as a learner, with your progress and trainer." />

      <section className="card table-card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 15px 4px' }}>
          <SectionTitle title="My course and trainer report" />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Course</th><th>Assigned trainer</th><th>Primary trainer</th><th>Assigned</th><th>Start date</th><th>Due</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>
              {S.assignments.filter((a) => a.traineeId === me.id).map((a) => {
                const cc = S.courses.find((x) => x.id === a.courseId);
                if (!cc) return null;
                const st = statCourse(S, me.id, cc);
                const overdue = isOverdue(a.due, st.pct);
                const assignedTrainer = real(a.trainer) || real(primaryOf(cc)) || 'No Trainer Assigned';
                return (
                  <tr key={a.id}>
                    <td><b>{cc.name}</b></td>
                    <td><b>{assignedTrainer}</b></td>
                    <td>{primaryOf(cc)}</td>
                    <td>{fmtDate(a.assignedOn)}</td>
<td>{a.startDate ? fmtDate(a.startDate) : '—'}</td>
                    <td>{a.due ? fmtDate(a.due) : '—'}</td>
                    <td><ProgressBar pct={st.pct} /></td>
                    <td><Pill kind={overdue ? 'overdue' : st.pct >= 100 ? 'done' : st.pct > 0 ? 'progress' : 'wait'}>{overdue ? 'Overdue' : st.pct >= 100 ? 'Completed' : st.pct > 0 ? 'In progress' : 'Not started'}</Pill></td>
                  </tr>
                );
              })}
              {!assigned.length && <tr><td colSpan={7}><Empty>No course has been assigned to you as a learner yet.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {c && (
        <>
          <section className="card detail-panel" style={{ marginBottom: 16 }}>
            <div className="filters">
              <div className="field" style={{ minWidth: 230 }}>
                <label htmlFor="ac-c">Course</label>
                <select id="ac-c" className="select" style={{ width: '100%' }} value={c.id} onChange={(e) => setPickC(e.target.value)}>
                  {assigned.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div className="subtle">{done} of {topics.length} topics complete</div>
                <strong style={{ font: '700 20px Manrope' }}>{statCourse(S, me.id, c).pct}%</strong>
              </div>
            </div>
          </section>
          <section className="card detail-panel">
            <SectionTitle title={`${c.name} · ${topics.length} topics`} right={<span className="subtle">View only · your trainer marks completion</span>} />
            {topics.map((x) => <TopicRow key={`${me.id}-${c.id}-${x.id}`} traineeId={me.id} course={c} topic={x} editable={false} />)}
          </section>
        </>
      )}
    </Guard>
  );
}
