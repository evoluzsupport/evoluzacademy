'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { usePortal } from '@/lib/store';
import { orderedTopics, scopeTrainees, statCourse, topicKey } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { downloadCSV, slug } from '@/lib/csv';
import { Avatar, Empty, Guard, Pill, ProgressBar, SectionTitle } from '@/components/ui';
import { AssignDialog, CourseForm, TopicForm } from '@/components/forms';
import { ImportDialog } from '@/components/csvdialog';

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const { S, me, openModal, confirm, removeCourse, removeTopic } = usePortal();
  const router = useRouter();
  const c = S.courses.find((x) => x.id === id);
  const isAdmin = me?.kind === 'admin';

  if (!c) {
    return (
      <Guard kinds={['admin', 'trainer']}>
        <section className="card empty">Course not found. <Link href="/courses" style={{ color: '#3158b6' }}>Back to courses</Link></section>
      </Guard>
    );
  }

  const allowed = new Set(scopeTrainees(S, me).map((t) => t.id));
  const learners = S.assignments
    .filter((a) => a.courseId === c.id && allowed.has(a.traineeId))
    .map((a) => S.trainees.find((t) => t.id === a.traineeId))
    .filter((t) => !!t);

  const exportTopics = () =>
    downloadCSV(
      [['Course', 'Planned day', 'Topic', 'What we cover', 'Activity / assessment', 'Trainer'], ...c.topics.map((t) => [c.name, t.day, t.topic, t.cover, t.activity, t.trainer || primaryOf(c)])],
      `evoluz-topics-${slug(c.name)}.csv`
    );

  return (
    <Guard kinds={['admin', 'trainer']}>
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link href="/courses">← Back to courses</Link></div>
          <h1>{c.name}</h1>
          <p>{c.group} learning path · {c.duration} · {c.topics.length} topics · Primary trainer: {primaryOf(c)}</p>
        </div>
        <div className="actions">
          {isAdmin && <button className="btn" onClick={() => openModal(<ImportDialog kind="topics" courseId={c.id} />)}>Import topics</button>}
          <button className="btn" onClick={exportTopics}>Export topics</button>
          {isAdmin && <button className="btn" onClick={() => openModal(<CourseForm id={c.id} />)}>Edit course</button>}
          {isAdmin && <button className="btn primary" onClick={() => openModal(<TopicForm courseId={c.id} />)}>＋ Add topic</button>}
        </div>
      </div>
      <div className="detail-layout">
        <section className="card detail-panel">
          <SectionTitle title="Learning plan" right={<span className="subtle">Topics are completed per learner</span>} />
          <div>
            {orderedTopics(c).map((x) => {
              const count = learners.filter((t) => S.progress[topicKey(t!.id, c.id, x.id)]?.done).length;
              return (
                <div className="topic-row" key={x.id} style={{ gridTemplateColumns: '70px minmax(0,1fr) auto' }}>
                  <div className="topic-day">{x.day}</div>
                  <div>
                    <div className="topic-title">{x.topic}</div>
                    <div className="topic-desc">{x.cover}{x.activity ? ' · Activity: ' + x.activity : ''}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Pill kind={count === learners.length && learners.length ? 'done' : 'neutral'}>{count}/{learners.length} done</Pill>
                    {isAdmin && (
                      <>
                        <button className="btn" onClick={() => openModal(<TopicForm courseId={c.id} topicId={x.id} />)}>Edit</button>
                        <button className="btn" aria-label={`Remove ${x.topic}`} onClick={() => confirm(`Remove “${x.topic}” from ${c.name}? Learners’ records for it are removed too.`, () => removeTopic(c.id, x.id), 'Remove topic')}>×</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {!c.topics.length && <Empty>No topics yet.{isAdmin ? ' Use “Add topic” or import a CSV.' : ''}</Empty>}
          </div>
        </section>
        <aside className="grid" style={{ alignContent: 'start' }}>
          <section className="card detail-panel">
            <SectionTitle title="Assigned learners" right={<button className="btn soft" onClick={() => openModal(<AssignDialog courseId={c.id} />)}>＋ Assign trainee</button>} />
            {learners.length ? (
              learners.map((t) => (
                <Link key={t!.id} href={`/trainees/${t!.id}`} className="course-row" style={{ margin: '13px 0' }}>
                  <Avatar name={t!.name} tone={t!.tone} />
                  <div className="course-copy"><b>{t!.name}</b><small>{t!.jobRole}</small></div>
                  <div><ProgressBar pct={statCourse(S, t!.id, c).pct} /></div>
                </Link>
              ))
            ) : (
              <Empty>No learners assigned to this course.</Empty>
            )}
          </section>
          {isAdmin && (
            <section className="card detail-panel">
              <SectionTitle title="Path settings" right={<button className="btn" onClick={() => confirm(`Remove ${c.name} from the course library? Assigned learner records will be removed.`, () => { removeCourse(c.id); router.replace('/courses'); }, 'Remove course')}>Remove course</button>} />
              <div className="subtle">Changes to topics apply to everyone assigned. Learner completion records remain individually tracked.</div>
            </section>
          )}
        </aside>
      </div>
    </Guard>
  );
}
