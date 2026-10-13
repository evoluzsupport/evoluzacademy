'use client';
import Link from 'next/link';
import { usePortal } from '@/lib/store';
import { visibleCourses } from '@/lib/selectors';
import { downloadCSV } from '@/lib/csv';
import { fmtDate } from '@/lib/util';
import { Empty, Guard, PageHead } from '@/components/ui';

export default function SessionsPage() {
  const { S, me, confirm, undoSession } = usePortal();
  // trainers only see sessions for the courses assigned to them
  const allowed = new Set(visibleCourses(S, me).map((c) => c.id));
  const list = S.sessions.filter((x) => allowed.has(x.courseId)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const exportCSV = () =>
    downloadCSV(
      [
        ['Date', 'Course', 'Trainer', 'Attendees', 'Topics covered', 'New marks', 'Existing preserved'],
        ...list.map((s) => {
          const c = S.courses.find((x) => x.id === s.courseId);
          return [
            s.date,
            s.courseName,
            s.trainer,
            s.traineeIds.map((id) => S.trainees.find((t) => t.id === id)?.name ?? '(removed)').join('; '),
            s.topicIds.map((id) => c?.topics.find((t) => t.id === id)?.topic ?? '(removed)').join('; '),
            s.newMarks,
            s.existingPreserved,
          ];
        }),
      ],
      'evoluz-sessions.csv'
    );

  return (
    <Guard kinds={['admin', 'trainer']}>
      <PageHead
        title="Session history"
        desc="Every group session that was logged, with who attended and what was covered."
        actions={
          <>
            <button className="btn" onClick={exportCSV} disabled={!list.length}>Export CSV</button>
            <Link className="btn primary" href="/session">＋ Log a session</Link>
          </>
        }
      />
      <section className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Course</th><th>Trainer</th><th>Attendees</th><th>Topics</th><th>Marks</th><th></th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>{fmtDate(s.date)}</td>
                  <td><b>{s.courseName}</b></td>
                  <td>{s.trainer}</td>
                  <td>{s.traineeIds.map((id) => S.trainees.find((t) => t.id === id)?.name ?? '(removed)').join(', ')}</td>
                  <td>{s.topicIds.length}</td>
                  <td>
                    {s.newMarks} new{s.existingPreserved ? <span className="subtle"> · {s.existingPreserved} kept</span> : null}
                  </td>
                  <td>
                    <button
                      className="btn"
                      onClick={() => confirm('Undo this session? The completion marks it created will be removed.', () => undoSession(s.id), 'Undo session')}
                    >
                      Undo
                    </button>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7}><Empty>No sessions logged yet. Use “Log a session” to record a group session.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Guard>
  );
}
