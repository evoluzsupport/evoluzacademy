'use client';
import Link from 'next/link';
import { usePortal } from '@/lib/store';
import { studyStats } from '@/lib/selectors';
import { Empty, ProgressBar, SectionTitle } from '@/components/ui';

/** Overview report for the signed-in person's own self-study. */
export function MyStudyCard() {
  const { S, me } = usePortal();
  if (!me) return null;
  const st = studyStats(S, me.id);
  const tiles: [string, string | number][] = [
    ['Courses started', st.started],
    ['Courses completed', st.completed],
    ['Topics completed', st.done],
    ['Overall progress', st.pct + '%'],
  ];
  return (
    <section className="card section-card" style={{ marginTop: 18 }}>
      <SectionTitle
        title="My Study"
        right={<Link href="/study" style={{ color: '#4569bf', fontSize: 11, fontWeight: 700 }}>Open My Study →</Link>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
        {tiles.map(([k, v]) => (
          <div key={k} className="mini-stat card">
            <small>{k}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      {st.perCourse.length ? (
        <div className="course-list">
          {st.perCourse.slice(0, 4).map(({ course, done, total, pct }) => (
            <Link key={course.id} href={`/study/${course.id}`} className="course-row">
              <div className="course-copy">
                <b>{course.name}</b>
                <small>{done} of {total} topics</small>
              </div>
              <div style={{ width: 120 }}><ProgressBar pct={pct} /></div>
            </Link>
          ))}
        </div>
      ) : (
        <Empty>You have not started a course yet. Open My Study to begin.</Empty>
      )}
    </section>
  );
}
