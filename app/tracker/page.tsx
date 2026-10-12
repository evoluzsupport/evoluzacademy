'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePortal } from '@/lib/store';
import { assignedCourses, orderedTopics, scopeTrainees, statCourse, topicKey } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { Empty, PageHead, SectionTitle } from '@/components/ui';
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
        title={isTrainee ? 'My courses' : 'Training tracker'}
        desc={isTrainee ? 'Tick topics as you complete them. Your trainer’s report updates automatically.' : 'Individual topic status, actual trainer, and editable completion date.'}
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
      {c ? (
        <div className="detail-layout">
          <section className="card detail-panel">
            <SectionTitle title={`${c.name} · ${topics.length} topics`} right={<span className="subtle">{done} complete · {topics.length - done} remaining</span>} />
            {topics.map((x) => <TopicRow key={`${t.id}-${c.id}-${x.id}`} traineeId={t.id} course={c} topic={x} editable />)}
            {isTrainee && <p className="readonly-note">Tick a topic when you complete it. Your trainer sees it in their tracker straight away.</p>}
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
