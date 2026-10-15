'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePortal } from '@/lib/store';
import { learners as allLearners, orderedTopics, scopeTrainees, statCourse, topicKey, visibleCourses } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { fmtDate, isOverdue } from '@/lib/util';
import { downloadCSV, slug } from '@/lib/csv';
import { Avatar, Empty, Guard, Pill, ProgressBar, SectionTitle, Stat } from '@/components/ui';
import { AssignDialog, CourseForm, TopicForm } from '@/components/forms';
import { ImportDialog } from '@/components/csvdialog';
import { TopicDetails } from '@/components/topic';
import { Fold, FoldList } from '@/components/fold';

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const { S, me, openModal, confirm, removeCourse, removeTopic } = usePortal();
  const router = useRouter();
  const [tab, setTab] = useState<'topics' | 'trainees'>('topics');
  const c = visibleCourses(S, me).find((x) => x.id === id);
  const isAdmin = me?.kind === 'admin';

  if (!c) {
    return (
      <Guard kinds={['admin', 'trainer']}>
        <section className="card empty">Course not found. <Link href={me?.kind === 'trainer' ? '/my-courses' : '/courses'} style={{ color: '#3158b6' }}>Back to courses</Link></section>
      </Guard>
    );
  }

  const allowed = new Set(scopeTrainees(S, me).map((t) => t.id));
  const people = allLearners(S);
  // assigned trainees on this course, with their assignment
  const rows = S.assignments
    .filter((a) => a.courseId === c.id && allowed.has(a.traineeId))
    .map((a) => ({ a, t: people.find((t) => t.id === a.traineeId)! }))
    .filter((r) => !!r.t);
  const topics = orderedTopics(c);
  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + statCourse(S, r.t.id, c).pct, 0) / rows.length) : 0;

  const exportTopics = () =>
    downloadCSV(
      [['Course', 'Planned day', 'Topic', 'What we cover', 'Activity / assessment', 'Trainer'], ...c.topics.map((t) => [c.name, t.day, t.topic, t.cover, t.activity, t.trainer || primaryOf(c)])],
      `evoluz-topics-${slug(c.name)}.csv`
    );

  return (
    <Guard kinds={['admin', 'trainer']}>
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link href={me?.kind === 'trainer' ? '/my-courses' : '/courses'}>← Back to courses</Link></div>
          <h1>{c.name}</h1>
          <p>{c.group} learning path · {c.duration} · Primary trainer: {primaryOf(c)}</p>
        </div>
        <div className="actions">
          {isAdmin && <button className="btn" onClick={() => openModal(<ImportDialog kind="topics" courseId={c.id} />)}>Import topics</button>}
          <button className="btn" onClick={exportTopics}>Export topics</button>
          {isAdmin && <button className="btn" onClick={() => openModal(<CourseForm id={c.id} />)}>Edit course</button>}
          {isAdmin && (
            <button
              className="btn"
              onClick={() => confirm(`Remove ${c.name} from the course library? Assigned trainee records will be removed.`, () => { removeCourse(c.id); router.replace('/courses'); }, 'Remove course')}
            >
              Remove course
            </button>
          )}
          {isAdmin && <button className="btn primary" onClick={() => openModal(<TopicForm courseId={c.id} />)}>＋ Add topic</button>}
        </div>
      </div>

      <div className="grid stats">
        <Stat label="Topics" icon="▤">{c.topics.length}</Stat>
        <Stat label="Assigned trainees" icon="♙">{rows.length}</Stat>
        <Stat label="Average progress" icon="◔">{avg}%</Stat>
        <Stat label="Duration" icon="◷"><span style={{ fontSize: 20 }}>{c.duration}</span></Stat>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'topics'} className={tab === 'topics' ? 'on' : ''} onClick={() => setTab('topics')}>
          Topics<span className="count">{topics.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'trainees'} className={tab === 'trainees' ? 'on' : ''} onClick={() => setTab('trainees')}>
          Assigned trainees<span className="count">{rows.length}</span>
        </button>
      </div>

      {tab === 'topics' && (
        <section className="card section-card">
          <SectionTitle title="Topics" right={<span className="subtle">Open a topic to see what it covers and who has completed it</span>} />
          <FoldList>
            {topics.map((x) => {
              const done = rows.filter((r) => S.progress[topicKey(r.t.id, c.id, x.id)]?.done);
              return (
                <Fold
                  key={x.id}
                  title={<><span className="pill neutral" style={{ marginRight: 8 }}>{x.day}</span>{x.topic}</>}
                  meta={`Trainer: ${x.trainer || primaryOf(c)}`}
                  right={<Pill kind={done.length === rows.length && rows.length ? 'done' : 'neutral'}>{done.length}/{rows.length} done</Pill>}
                  actions={
                    isAdmin && (
                      <>
                        <button className="btn" onClick={() => openModal(<TopicForm courseId={c.id} topicId={x.id} />)}>Edit</button>
                        <button className="btn" aria-label={`Remove ${x.topic}`} onClick={() => confirm(`Remove “${x.topic}” from ${c.name}? Trainees’ records for it are removed too.`, () => removeTopic(c.id, x.id), 'Remove topic')}>×</button>
                      </>
                    )
                  }
                >
                  <TopicDetails cover={x.cover} activity={x.activity} />
                  <div style={{ marginTop: 10 }}>
                    {rows.map((r) => {
                      const rec = S.progress[topicKey(r.t.id, c.id, x.id)];
                      return (
                        <div className="subrow" key={r.a.id}>
                          <Link className="person" href={`/trainees/${r.t.id}`}><Avatar name={r.t.name} tone={r.t.tone} />{r.t.name}</Link>
                          <span className="grow" />
                          {rec?.done ? <Pill kind="done">Completed {rec.date ? fmtDate(rec.date) : ''}{rec.trainer ? ` · ${rec.trainer}` : ''}</Pill> : <Pill kind="neutral">Pending</Pill>}
                        </div>
                      );
                    })}
                    {!rows.length && <span className="subtle">No trainees are assigned to this course yet.</span>}
                  </div>
                </Fold>
              );
            })}
            {!topics.length && <Empty>No topics yet.{isAdmin ? ' Use “Add topic” or import a CSV.' : ''}</Empty>}
          </FoldList>
        </section>
      )}

      {tab === 'trainees' && (
        <section className="card section-card">
          <SectionTitle
            title="Assigned trainees"
            right={<button className="btn soft" onClick={() => openModal(<AssignDialog courseId={c.id} />)}>＋ Assign trainee</button>}
          />
          <FoldList>
            {rows.map(({ a, t }) => {
              const st = statCourse(S, t.id, c);
              const who = a.trainer && a.trainer !== 'No Trainer Assigned' ? a.trainer : primaryOf(c);
              const late = isOverdue(a.due, st.pct);
              return (
                <Fold
                  key={a.id}
                  title={<span className="person" style={{ display: 'inline-flex' }}><Avatar name={t.name} tone={t.tone} />{t.name}</span>}
                  meta={`Trainer: ${who || 'Not assigned'} · Start ${a.startDate ? fmtDate(a.startDate) : 'not set'} · Due ${a.due ? fmtDate(a.due) : 'not set'}`}
                  right={
                    <>
                      {late && <Pill kind="overdue">Overdue</Pill>}
                      <ProgressBar pct={st.pct} />
                    </>
                  }
                  href={`/trainees/${t.id}`}
                  hrefLabel="Trainee report →"
                >
                  <div className="subtle" style={{ margin: '4px 0 6px' }}>{st.done} of {st.total} topics completed</div>
                  {topics.map((x) => {
                    const rec = S.progress[topicKey(t.id, c.id, x.id)];
                    return (
                      <div className="subrow" key={x.id}>
                        <span className="pill neutral">{x.day}</span>
                        <span className="grow"><b>{x.topic}</b></span>
                        {rec?.done ? <Pill kind="done">Completed {rec.date ? fmtDate(rec.date) : ''}</Pill> : <Pill kind="neutral">Pending</Pill>}
                      </div>
                    );
                  })}
                </Fold>
              );
            })}
            {!rows.length && <Empty>No trainees assigned to this course.</Empty>}
          </FoldList>
        </section>
      )}
    </Guard>
  );
}
