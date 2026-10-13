'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePortal } from '@/lib/store';
import { orderedTopics } from '@/lib/selectors';
import { fmtDate } from '@/lib/util';
import { Guard, PageHead, ProgressBar, SectionTitle } from '@/components/ui';
import { TopicDetails } from '@/components/topic';

export default function StudyCourse() {
  const { id } = useParams<{ id: string }>();
  const { S, me, toggleStudy } = usePortal();
  const c = S.courses.find((x) => x.id === id);

  if (!c) {
    return (
      <Guard kinds={['trainer', 'trainee']}>
        <section className="card empty">Course not found. <Link href="/study" style={{ color: '#3158b6' }}>Back to My Study</Link></section>
      </Guard>
    );
  }
  const topics = orderedTopics(c);
  const key = (topicId: string) => `${me?.id}|${c.id}|${topicId}`;
  const done = topics.filter((t) => S.study[key(t.id)]).length;
  const pct = topics.length ? Math.round((done / topics.length) * 100) : 0;

  return (
    <Guard kinds={['trainer', 'trainee']}>
      <Link href="/study" className="subtle" style={{ display: 'inline-block', marginBottom: 10 }}>← Back to My Study</Link>
      <PageHead title={c.name} desc={`${c.group} · ${c.duration} · ${topics.length} topics`} />
      <section className="card detail-panel" style={{ marginBottom: 16 }}>
        <SectionTitle title="My progress" right={<span className="subtle">{done} of {topics.length} topics complete</span>} />
        <ProgressBar pct={pct} />
      </section>
      <section className="card detail-panel">
        <SectionTitle title="Learning plan" right={<span className="subtle">Tick a topic when you have completed it</span>} />
        {topics.map((t) => {
          const rec = S.study[key(t.id)];
          return (
            <div className="topic-row" key={t.id}>
              <button
                className={`check ${rec ? 'checked' : ''}`}
                role="checkbox"
                aria-checked={!!rec}
                aria-label={`${t.topic}: ${rec ? 'completed' : 'not completed'}`}
                title={rec ? 'Mark as not done' : 'Mark as done'}
                onClick={() => toggleStudy(c.id, t.id)}
              >
                {rec ? '✓' : ''}
              </button>
              <div>
                <div className="topic-title">{t.topic}</div>
                {t.category && <div className="subtle" style={{ marginTop: 3 }}>{t.category}</div>}
                <TopicDetails cover={t.cover} activity={t.activity} />
                {rec && <div className="subtle" style={{ marginTop: 8 }}>Completed {fmtDate(rec.date)}</div>}
              </div>
              <span className="topic-day">{t.day}</span>
            </div>
          );
        })}
        {!topics.length && <div className="empty">This course has no topics yet.</div>}
      </section>
    </Guard>
  );
}
