'use client';
import Link from 'next/link';
import { usePortal } from '@/lib/store';
import {
  allStats, assignedCourses, assignmentsOf, recentActivity, scopeTrainees, statCourse, progressFor, orderedTopics, topicKey, visibleCourses,
} from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { fmtDate, isOverdue } from '@/lib/util';
import { Avatar, COURSE_ICONS, COURSE_TONES, Empty, PageHead, Pill, ProgressBar, SectionTitle, Stat } from '@/components/ui';
import { TraineeForm } from '@/components/forms';

function Chart() {
  const { S, me } = usePortal();
  const rows = visibleCourses(S, me)
    .map((c) => {
      const ts = S.assignments.filter((a) => a.courseId === c.id).map((a) => a.traineeId);
      const total = ts.length * c.topics.length;
      const done = ts.reduce((n, tid) => n + statCourse(S, tid, c).done, 0);
      return { name: c.name.replace('7-Day ', '').replace('Project Coordinator Training', 'Project coord.'), total, pct: total ? Math.round((done / total) * 100) : 0 };
    })
    .filter((x) => x.total)
    .slice(0, 7);
  return (
    <div className="chart">
      {rows.map((x) => (
        <div className="bar-col" key={x.name}>
          <div className="bar-wrap">
            <div className="bar dark" style={{ height: `${Math.max(x.pct, 2)}%` }} title={`${x.pct}% complete`} />
            <div className="bar" style={{ height: `${Math.max(100 - x.pct, 2)}%` }} />
          </div>
          <div className="bar-label">{x.name.length > 12 ? x.name.slice(0, 11) + '…' : x.name}</div>
        </div>
      ))}
    </div>
  );
}

function StaffOverview() {
  const { S, me, openModal } = usePortal();
  const trainees = scopeTrainees(S, me);
  const s = allStats(S, trainees);
  const activeT = trainees.filter((t) => t.status === 'Active');
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const recentJoins = trainees.filter((t) => t.joined >= cutoff).length;
  const isAdmin = me?.kind === 'admin';

  return (
    <>
      <PageHead
        title="Training at a glance"
        desc="A clear view of learning progress across your people and programs."
        actions={
          <>
            <Link className="btn" href="/analytics">◔ View analytics</Link>
            {isAdmin ? (
              <button className="btn primary" onClick={() => openModal(<TraineeForm />)}>＋ Add trainee</button>
            ) : (
              <Link className="btn primary" href="/session">＋ Log a session</Link>
            )}
          </>
        }
      />
      <div className="grid stats">
        <Stat label="Active trainees" icon="♙" note={<><span className="trend">+{recentJoins}</span> joined in the last 30 days</>}>{s.active}</Stat>
        <Stat label={me?.kind === 'trainer' ? 'My courses' : 'Courses in library'} icon="▤" note={me?.kind === 'trainer' ? 'Assigned to you by an admin' : 'Across common, apps & role-based'}>{visibleCourses(S, me).length}</Stat>
        <Stat label="Topics completed" icon="✓" note="Across all learner assignments">
          {s.done}
          <small style={{ font: "500 13px 'DM Sans'", color: '#98a3b2' }}> / {s.total}</small>
        </Stat>
        <Stat label="Overall completion" icon="◔" note="Individual topic completion">{s.pct}%</Stat>
      </div>
      <div className="grid overview-grid">
        <section className="card section-card">
          <SectionTitle title="Training progress" right={<span className="subtle">Topic coverage by course</span>} />
          <Chart />
          <div className="legend"><span>Topics completed</span><span>Topics remaining</span></div>
        </section>
        <section className="card section-card">
          <SectionTitle title="Recent activity" right={<Link href="/tracker" style={{ color: '#4569bf', fontSize: 11, fontWeight: 700 }}>Open tracker →</Link>} />
          <div className="activity-list">
            {recentActivity(S, trainees).map((x, i) => (
              <div className="activity" key={i}>
                <div className="activity-dot">✓</div>
                <div>
                  <b>{x.traineeName} completed a topic</b>
                  <small>{x.topic} · {x.course}</small>
                </div>
                <time>{x.date}</time>
              </div>
            ))}
            {!recentActivity(S, trainees).length && <Empty>Topic completions will appear here as trainers update the tracker.</Empty>}
          </div>
        </section>
      </div>
      <div className="grid lower-grid">
        <section className="card section-card">
          <SectionTitle title="Keep learning moving" right={<Link href="/trainees" style={{ color: '#4569bf', fontSize: 11, fontWeight: 700 }}>All trainees →</Link>} />
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Trainee</th><th>Current path</th><th>Progress</th><th>Status</th></tr></thead>
              <tbody>
                {activeT.slice(0, 4).map((t) => {
                  const cs = assignedCourses(S, t.id);
                  const c = cs.find((x) => statCourse(S, t.id, x).pct < 100) ?? cs.at(-1);
                  const p = progressFor(S, t);
                  return (
                    <tr key={t.id}>
                      <td><Link className="person" href={`/trainees/${t.id}`}><Avatar name={t.name} tone={t.tone} /><span>{t.name}</span></Link></td>
                      <td>{c?.name ?? 'No course'}</td>
                      <td><ProgressBar pct={p.pct} /></td>
                      <td><Pill kind={p.pct === 100 ? 'done' : 'active'}>{p.pct === 100 ? 'Completed' : 'On track'}</Pill></td>
                    </tr>
                  );
                })}
                {!activeT.length && <tr><td colSpan={4}><Empty>No active trainees yet.</Empty></td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card section-card">
          <SectionTitle title="Popular learning paths" right={<Link href={me?.kind === 'trainer' ? '/my-courses' : '/courses'} style={{ color: '#4569bf', fontSize: 11, fontWeight: 700 }}>{me?.kind === 'trainer' ? 'My courses →' : 'Course library →'}</Link>} />
          <div className="course-list">
            {[...visibleCourses(S, me)]
              .map((c) => ({ c, n: S.assignments.filter((a) => a.courseId === c.id).length }))
              .sort((a, b) => b.n - a.n)
              .slice(0, 4)
              .map(({ c, n }, i) => (
                <Link key={c.id} href={`/courses/${c.id}`} className="course-row">
                  <div className={`course-icon ${COURSE_TONES[i % 3]}`}>{COURSE_ICONS[i % 3]}</div>
                  <div className="course-copy"><b>{c.name}</b><small>{c.topics.length} topics · {c.duration}</small></div>
                  <div className="course-end"><b>{n}</b> learners</div>
                </Link>
              ))}
          </div>
        </section>
      </div>
    </>
  );
}

function TraineeOverview() {
  const { S, me } = usePortal();
  if (!me) return null;
  const t = S.trainees.find((x) => x.id === me.id);
  if (!t) return null;
  const p = progressFor(S, t);
  const as = assignmentsOf(S, t.id);
  const done = as.filter((a) => {
    const c = S.courses.find((x) => x.id === a.courseId);
    return c && statCourse(S, t.id, c).pct >= 100;
  }).length;
  const contacts = [...new Set([t.trainer, ...as.map((a) => primaryOf(S.courses.find((c) => c.id === a.courseId)))].filter(Boolean))];

  return (
    <>
      <PageHead title={`Welcome, ${t.name.split(' ')[0]}`} desc="Your training overview." actions={<Link className="btn primary" href="/tracker">Open my courses →</Link>} />
      <div className="grid stats">
        <Stat label="Courses assigned" icon="▤">{as.length}</Stat>
        <Stat label="Completed" icon="✓">{done}</Stat>
        <Stat label="Topics done" icon="☑" note={`of ${p.total} assigned`}>{p.done}</Stat>
        <Stat label="Overall progress" icon="◔">{p.pct}%</Stat>
      </div>
      <div className="grid overview-grid">
        <section className="card section-card">
          <SectionTitle title="My learning paths" right={<span className="subtle">Resume where you left off</span>} />
          {as.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Course</th><th>Next topic</th><th>Progress</th><th>Due</th></tr></thead>
                <tbody>
                  {as.map((a) => {
                    const c = S.courses.find((x) => x.id === a.courseId);
                    if (!c) return null;
                    const st = statCourse(S, t.id, c);
                    const next = orderedTopics(c).find((tp) => !S.progress[topicKey(t.id, c.id, tp.id)]?.done);
                    return (
                      <tr key={a.id}>
                        <td><b>{c.name}</b></td>
                        <td>{next ? `${next.day} · ${next.topic}` : 'All topics completed'}</td>
                        <td><ProgressBar pct={st.pct} /></td>
                        <td>{a.due ? <Pill kind={isOverdue(a.due, st.pct) ? 'overdue' : 'neutral'}>{isOverdue(a.due, st.pct) ? 'Overdue · ' : ''}{fmtDate(a.due)}</Pill> : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No course assigned yet. Your coordinator will assign one soon.</Empty>
          )}
        </section>
        <section className="card section-card">
          <SectionTitle title="My training team" />
          <div className="course-list">
            {contacts.length ? contacts.map((n) => {
              const r = S.trainers.find((x) => x.name === n);
              return (
                <div className="course-row" key={n}>
                  <Avatar name={n} tone={r?.tone} />
                  <div className="course-copy"><b>{n}</b><small>{r?.specialty || 'Trainer'}{r?.email ? ' · ' + r.email : ''}</small></div>
                </div>
              );
            }) : <Empty>No trainer assigned yet.</Empty>}
          </div>
        </section>
      </div>
    </>
  );
}

export default function Overview() {
  const { me } = usePortal();
  if (!me) return null;
  return me.kind === 'trainee' ? <TraineeOverview /> : <StaffOverview />;
}
