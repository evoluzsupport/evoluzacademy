'use client';
import Link from 'next/link';
import { usePortal } from '@/lib/store';
import { allStats, assignedCourses, assignedTrainersOf, progressFor, nameMatches, scopeTrainees, statCourse, visibleCourses } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { downloadCSV } from '@/lib/csv';
import { Avatar, Empty, Guard, PageHead, Pill, ProgressBar, SectionTitle, Stat } from '@/components/ui';

export default function AnalyticsPage() {
  const { S, me } = usePortal();
  const trainees = scopeTrainees(S, me);
  const ids = new Set(trainees.map((t) => t.id));
  const s = allStats(S, trainees);

  const courseRows = visibleCourses(S, me)
    .map((c) => {
      const ts = S.assignments.filter((a) => a.courseId === c.id && ids.has(a.traineeId)).map((a) => a.traineeId);
      const total = ts.length * c.topics.length;
      const done = ts.reduce((n, tid) => n + statCourse(S, tid, c).done, 0);
      return { c, n: ts.length, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
    })
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n);

  const trainerRows = S.trainers
    .map((r) => {
      const entries = Object.entries(S.progress).filter(([k, x]) => x.done && nameMatches(x.trainer, r.name) && ids.has(k.split('|')[0]));
      return {
        r,
        delivered: entries.length,
        learners: new Set(entries.map(([k]) => k.split('|')[0])).size,
        assigned: S.courses.filter((c) => nameMatches(primaryOf(c), r.name)).length,
      };
    })
    .filter((x) => x.delivered || x.assigned)
    .sort((a, b) => b.delivered - a.delivered);

  const exportSummary = () =>
    downloadCSV(
      [
        ['Trainee', 'Role', 'Course', 'Topic', 'Status', 'Completion date', 'Primary trainer', 'Delivered by'],
        ...trainees.flatMap((t) =>
          assignedCourses(S, t.id).flatMap((c) =>
            c.topics.map((topic) => {
              const rec = S.progress[`${t.id}|${c.id}|${topic.id}`];
              return [t.name, t.jobRole, c.name, topic.topic, rec?.done ? 'Completed' : 'Pending', rec?.date ?? '', primaryOf(c), rec?.trainer ?? ''];
            })
          )
        ),
      ],
      'evoluz-training-analytics.csv'
    );

  return (
    <Guard kinds={['admin', 'trainer']}>
      <PageHead
        title="Learning analytics"
        desc="Track topic completion, primary trainer ownership, and actual training delivery."
        actions={<button className="btn" onClick={exportSummary}>Export summary</button>}
      />
      <div className="grid stats">
        <Stat label="Learners" note={`${s.active} currently active`}>{trainees.length}</Stat>
        <Stat label="Assigned learning paths" note="Common + role-specific courses">{s.assigned.length}</Stat>
        <Stat label="Topics completed" note={`of ${s.total} assigned topic checkpoints`}>{s.done}</Stat>
        <Stat label="Completion rate" note="Weighted by assigned topics">{s.pct}%</Stat>
      </div>
      <div className="grid overview-grid">
        <section className="card section-card">
          <SectionTitle title="Completion by learning path" right={<span className="subtle">Learner topic records</span>} />
          <div style={{ display: 'grid', gap: 17 }}>
            {courseRows.map((x) => (
              <div key={x.c.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <b style={{ fontSize: 11 }}>{x.c.name}</b>
                  <span className="subtle">{x.done}/{x.total} topics · {x.pct}%</span>
                </div>
                <div className="track" style={{ width: '100%', height: 9 }}>
                  <i style={{ width: `${x.pct}%`, background: x.pct > 75 ? '#42a582' : '#4d79cf' }} />
                </div>
              </div>
            ))}
            {!courseRows.length && <Empty>Assign courses to learners to see course analytics.</Empty>}
          </div>
        </section>
        <section className="card section-card">
          <SectionTitle title="Overall completion" />
          <div style={{ display: 'grid', placeItems: 'center', padding: 17 }}>
            <div style={{ width: 158, height: 158, borderRadius: '50%', background: `conic-gradient(#3158b6 ${s.pct * 3.6}deg,#edf1f7 0)`, display: 'grid', placeItems: 'center' }}>
              <div style={{ width: 118, height: 118, borderRadius: '50%', background: 'white', display: 'grid', placeContent: 'center', textAlign: 'center' }}>
                <b style={{ font: '800 27px Manrope' }}>{s.pct}%</b>
                <small className="subtle">complete</small>
              </div>
            </div>
          </div>
          <div className="legend" style={{ justifyContent: 'center' }}>
            <span>Completed ({s.done})</span>
            <span>Remaining ({s.total - s.done})</span>
          </div>
        </section>
      </div>
      <section className="card section-card" style={{ marginTop: 17 }}>
        <SectionTitle title="Trainer contribution" right={<span className="subtle">Click a trainer for their report · a topic is credited only to who delivered it</span>} />
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Trainer</th><th>Primary courses</th><th>Trainee-topic completions</th><th>Trainees reached</th></tr></thead>
            <tbody>
              {trainerRows.map((x) => (
                <tr key={x.r.id}>
                  <td><Link className="person" href={`/trainers/${x.r.id}`}><Avatar name={x.r.name} tone={x.r.tone} />{x.r.name}</Link></td>
                  <td>{x.assigned}</td>
                  <td><b>{x.delivered}</b></td>
                  <td>{x.learners}</td>
                </tr>
              ))}
              {!trainerRows.length && <tr><td colSpan={4}><Empty>Completed topics will appear here by trainer.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card section-card" style={{ marginTop: 17 }}>
        <SectionTitle title="Trainee progress overview" right={<span className="subtle">Topic completion across assigned paths</span>} />
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Trainee</th><th>Courses</th><th>Completed topics</th><th>Progress</th><th>Assigned trainer</th><th>Status</th></tr></thead>
            <tbody>
              {trainees.map((t) => {
                const p = progressFor(S, t);
                return (
                  <tr key={t.id}>
                    <td><Link className="person" href={`/trainees/${t.id}`}><Avatar name={t.name} tone={t.tone} />{t.name}</Link></td>
                    <td>{assignedCourses(S, t.id).length}</td>
                    <td>{p.done} / {p.total}</td>
                    <td><ProgressBar pct={p.pct} /></td>
                    <td>{assignedTrainersOf(S, t.id, t.trainer) || '—'}</td>
                    <td><Pill kind={t.status === 'Active' ? 'active' : 'wait'}>{t.status}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </Guard>
  );
}
