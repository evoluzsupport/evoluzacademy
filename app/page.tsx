'use client';
import Link from 'next/link';
import { usePortal } from '@/lib/store';
import {
  allStats, assignedCourses, assignedTrainersOf, assignmentsOf, attentionItems, nameMatches, recentActivity, scopeTrainees, statCourse, progressFor, orderedTopics, topicKey, visibleCourses,
} from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { fmtDate, isOverdue } from '@/lib/util';
import { Avatar, COURSE_ICONS, COURSE_TONES, Empty, PageHead, Pill, ProgressBar, SectionTitle, Stat } from '@/components/ui';
import { TraineeForm } from '@/components/forms';
import { Fold, FoldList } from '@/components/fold';

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
        <Stat label={me?.kind === 'trainer' ? 'Assigned Courses' : 'Courses in library'} icon="▤" note={me?.kind === 'trainer' ? 'Assigned to you by an admin' : 'Across common, apps & role-based'}>{visibleCourses(S, me).length}</Stat>
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
          <SectionTitle title="Popular learning paths" right={<Link href={me?.kind === 'trainer' ? '/my-courses' : '/courses'} style={{ color: '#4569bf', fontSize: 11, fontWeight: 700 }}>{me?.kind === 'trainer' ? 'Assigned Courses →' : 'Course library →'}</Link>} />
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

/** A course's topics for one learner, as a status list. */
function TopicStatus({ traineeId, courseId }: { traineeId: string; courseId: string }) {
  const { S } = usePortal();
  const c = S.courses.find((x) => x.id === courseId);
  if (!c) return null;
  const topics = orderedTopics(c);
  const nextId = topics.find((tp) => !S.progress[topicKey(traineeId, c.id, tp.id)]?.done)?.id;
  return (
    <div>
      {topics.map((tp) => {
        const rec = S.progress[topicKey(traineeId, c.id, tp.id)];
        return (
          <div className="subrow" key={tp.id}>
            <span className="pill neutral">{tp.day}</span>
            <span className="grow">
              <b>{tp.topic}</b>
              <small>Trainer: {rec?.trainer || tp.trainer || primaryOf(c)}</small>
            </span>
            {rec?.done ? (
              <Pill kind="done">Completed {rec.date ? fmtDate(rec.date) : ''}</Pill>
            ) : (
              <Pill kind={tp.id === nextId ? 'progress' : 'neutral'}>{tp.id === nextId ? 'Up next' : 'Pending'}</Pill>
            )}
          </div>
        );
      })}
      {!topics.length && <span className="subtle">No topics in this course yet.</span>}
    </div>
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
  const contacts = assignedTrainersOf(S, t.id, t.trainer).split(', ').filter(Boolean);

  return (
    <>
      <PageHead title={`Welcome, ${t.name.split(' ')[0]}`} desc="Your training overview." actions={<Link className="btn primary" href="/tracker">Open my courses →</Link>} />
      <div className="grid stats">
        <Stat label="Courses assigned" icon="▤">{as.length}</Stat>
        <Stat label="Completed" icon="✓">{done}</Stat>
        <Stat label="Topics done" icon="☑" note={`of ${p.total} assigned`}>{p.done}</Stat>
        <Stat label="Overall progress" icon="◔">{p.pct}%</Stat>
      </div>

      <section className="card section-card" style={{ marginBottom: 17 }}>
        <SectionTitle title="My courses" right={<span className="subtle">Open a course to see its topics and your progress</span>} />
        <FoldList>
          {as.map((a, i) => {
            const c = S.courses.find((x) => x.id === a.courseId);
            if (!c) return null;
            const st = statCourse(S, t.id, c);
            const who = a.trainer && a.trainer !== 'No Trainer Assigned' ? a.trainer : primaryOf(c);
            const late = isOverdue(a.due, st.pct);
            return (
              <Fold
                key={a.id}
                defaultOpen={i === 0}
                title={c.name}
                meta={`Trainer: ${who || 'Not assigned'} · Start ${a.startDate ? fmtDate(a.startDate) : 'not set'} · Due ${a.due ? fmtDate(a.due) : 'not set'}`}
                right={
                  <>
                    {late && <Pill kind="overdue">Overdue</Pill>}
                    <ProgressBar pct={st.pct} />
                  </>
                }
                href={`/tracker?course=${c.id}`}
                hrefLabel="Open course →"
              >
                <div className="subtle" style={{ margin: '4px 0 6px' }}>{st.done} of {st.total} topics completed</div>
                <TopicStatus traineeId={t.id} courseId={c.id} />
              </Fold>
            );
          })}
          {!as.length && <Empty>No course assigned yet. Your coordinator will assign one soon.</Empty>}
        </FoldList>
      </section>

      <section className="card section-card">
        <SectionTitle title="My training team" right={<span className="subtle">Trainers on your courses</span>} />
        <FoldList>
          {contacts.map((n) => {
            const r = S.trainers.find((x) => x.name === n);
            const mine = as.filter((a) => nameMatches(a.trainer || '', n) || (!a.trainer && nameMatches(S.courses.find((c) => c.id === a.courseId)?.primaryTrainer, n)));
            return (
              <Fold
                key={n}
                title={<span className="person" style={{ display: 'inline-flex' }}><Avatar name={n} tone={r?.tone} />{n}</span>}
                meta={`${r?.specialty || 'Trainer'}${r?.email ? ' · ' + r.email : ''}`}
                right={<span className="subtle">{mine.length} {mine.length === 1 ? 'course' : 'courses'}</span>}
              >
                {mine.map((a) => {
                  const c = S.courses.find((x) => x.id === a.courseId);
                  return c ? (
                    <div className="subrow" key={a.id}>
                      <Link className="list-link grow" href={`/tracker?course=${c.id}`}>{c.name}</Link>
                      <ProgressBar pct={statCourse(S, t.id, c).pct} />
                    </div>
                  ) : null;
                })}
                {!mine.length && <span className="subtle">No courses linked to this trainer yet.</span>}
              </Fold>
            );
          })}
          {!contacts.length && <Empty>No trainer assigned yet.</Empty>}
        </FoldList>
      </section>
    </>
  );
}

function TrainerOverview() {
  const { S, me } = usePortal();
  if (!me) return null;
  const people = scopeTrainees(S, me);
  const ids = new Set(people.map((t) => t.id));
  const courses = visibleCourses(S, me);
  const s = allStats(S, people);
  const attention = attentionItems(S, people);
  const myName = S.trainers.find((t) => t.id === me.id)?.name ?? me.name;
  const delivered = Object.values(S.progress).filter((r) => r.done && nameMatches(r.trainer, myName)).length;

  return (
    <>
      <PageHead title={`Welcome, ${myName.split(' ')[0]}`} desc="Your courses, trainees and what needs attention." actions={<Link className="btn primary" href="/session">＋ Log a session</Link>} />
      <div className="grid stats">
        <Stat label="My courses" icon="▤" note="Assigned to you">{courses.length}</Stat>
        <Stat label="My trainees" icon="♙" note="Learning with you">{people.length}</Stat>
        <Stat label="Topics delivered" icon="✓" note="Credited to you">{delivered}</Stat>
        <Stat label="Overall completion" icon="◔" note="Across your trainees">{s.pct}%</Stat>
      </div>

      <section className="card section-card" style={{ marginBottom: 17 }}>
        <SectionTitle title="My courses and trainees" right={<span className="subtle">Open a course, then a trainee, to see topic progress</span>} />
        <FoldList>
          {courses.map((c, i) => {
            const rows = S.assignments.filter((a) => a.courseId === c.id && ids.has(a.traineeId));
            const avg = rows.length ? Math.round(rows.reduce((n, a) => n + statCourse(S, a.traineeId, c).pct, 0) / rows.length) : 0;
            return (
              <Fold
                key={c.id}
                defaultOpen={i === 0}
                title={c.name}
                meta={`${rows.length} ${rows.length === 1 ? 'trainee' : 'trainees'} · ${c.topics.length} topics · ${c.duration}`}
                right={<ProgressBar pct={avg} />}
                href={`/courses/${c.id}`}
                hrefLabel="Course page →"
              >
                {rows.map((a) => {
                  const t = people.find((x) => x.id === a.traineeId);
                  if (!t) return null;
                  const st = statCourse(S, t.id, c);
                  return (
                    <Fold
                      key={a.id}
                      title={<span className="person" style={{ display: 'inline-flex' }}><Avatar name={t.name} tone={t.tone} />{t.name}</span>}
                      meta={`Start ${a.startDate ? fmtDate(a.startDate) : 'not set'} · Due ${a.due ? fmtDate(a.due) : 'not set'} · ${st.done}/${st.total} topics`}
                      right={
                        <>
                          {isOverdue(a.due, st.pct) && <Pill kind="overdue">Overdue</Pill>}
                          <ProgressBar pct={st.pct} />
                        </>
                      }
                      href={`/trainees/${t.id}`}
                      hrefLabel="Trainee report →"
                    >
                      <TopicStatus traineeId={t.id} courseId={c.id} />
                    </Fold>
                  );
                })}
                {!rows.length && <span className="subtle">No trainees on this course yet.</span>}
              </Fold>
            );
          })}
          {!courses.length && <Empty>No courses are assigned to you yet.</Empty>}
        </FoldList>
      </section>

      <section className="card section-card">
        <SectionTitle title="Needs attention" right={<span className="subtle">Overdue, on hold or without a course</span>} />
        <FoldList>
          {attention.map((x, i) => (
            <Fold key={i} title={x.text} meta={x.sub} href={`/trainees/${x.traineeId}`} hrefLabel="Trainee report →" />
          ))}
          {!attention.length && <Empty>Nothing needs attention right now.</Empty>}
        </FoldList>
      </section>
    </>
  );
}

export default function Overview() {
  const { me } = usePortal();
  if (!me) return null;
  if (me.kind === 'trainee') return <TraineeOverview />;
  return me.kind === 'trainer' ? <TrainerOverview /> : <StaffOverview />;
}
