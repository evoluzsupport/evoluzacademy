'use client';
import Link from 'next/link';
import { useState } from 'react';
import { match, usePortal } from '@/lib/store';
import { primaryOf } from '@/lib/seed';
import { nameMatches, statCourse, visibleCourses } from '@/lib/selectors';
import { Empty, Guard, PageHead, ProgressBar } from '@/components/ui';

export default function MyCoursesPage() {
  const { S, me } = usePortal();
  const [q, setQ] = useState('');
  const name = S.trainers.find((t) => t.id === me?.id)?.name ?? me?.name ?? '';
  const list = visibleCourses(S, me).filter((c) => match(q, c.name, c.group));

  return (
    <Guard kinds={['trainer']}>
      <PageHead title="My Courses" desc="The courses an admin has assigned to you as trainer." />
      <div className="toolbar" style={{ marginBottom: 15 }}>
        <input className="input" placeholder="Search my courses..." aria-label="Search my courses" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="subtle">{list.length} {list.length === 1 ? 'course' : 'courses'}</span>
      </div>
      <section className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Course</th><th>Category</th><th>Duration</th><th>Topics</th><th>Primary trainer</th><th>My learners</th><th>Progress</th></tr>
            </thead>
            <tbody>
              {list.map((c) => {
                // learners on this course that are assigned to me, or all learners if I lead the course
                const lead = nameMatches(c.primaryTrainer, name);
                const mine = S.assignments.filter((a) => a.courseId === c.id && (lead || nameMatches(a.trainer, name)));
                const total = mine.length * c.topics.length;
                const done = mine.reduce((n, a) => n + statCourse(S, a.traineeId, c).done, 0);
                return (
                  <tr key={c.id}>
                    <td><Link href={`/courses/${c.id}`} className="list-link">{c.name}</Link></td>
                    <td><span className={`pill ${c.group === 'Common' ? 'active' : c.group === 'Role-based' ? 'wait' : 'progress'}`}>{c.group}</span></td>
                    <td>{c.duration}</td>
                    <td>{c.topics.length}</td>
                    <td>{primaryOf(c)}</td>
                    <td>{mine.length}</td>
                    <td style={{ minWidth: 120 }}>{total ? <ProgressBar pct={Math.round((done / total) * 100)} /> : <span className="subtle">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!list.length && <Empty>{S.courses.length ? 'No courses are assigned to you yet. Ask an admin to assign you as a trainer.' : 'No courses yet.'}</Empty>}
      </section>
    </Guard>
  );
}
