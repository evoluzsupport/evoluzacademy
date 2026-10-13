'use client';
import Link from 'next/link';
import { useState } from 'react';
import { match, usePortal } from '@/lib/store';
import { statCourse } from '@/lib/selectors';
import { downloadCSV } from '@/lib/csv';
import { fmtDate, isOverdue } from '@/lib/util';
import { Avatar, Empty, Guard, PageHead, Pill, ProgressBar } from '@/components/ui';
import { AssignDialog } from '@/components/forms';

export default function AssignmentsPage() {
  const { S, openModal, confirm, unassign, update, toast } = usePortal();
  const [q, setQ] = useState('');

  const rows = S.assignments
    .map((a) => ({ a, t: S.trainees.find((x) => x.id === a.traineeId), c: S.courses.find((x) => x.id === a.courseId) }))
    .filter((x) => x.t && x.c)
    .filter((x) => match(q, x.t!.name, x.c!.name, x.t!.trainer));

  const setDue = (id: string, due: string) =>
    update((s) => {
      const a = s.assignments.find((x) => x.id === id);
      if (a) a.due = due;
    });

  return (
    <Guard kinds={['admin']}>
      <PageHead
        title="Ongoing Training Session"
        desc="Which trainee is taking which course, with due dates to keep learning on schedule."
        actions={
          <>
            <button
              className="btn"
              onClick={() => {
                downloadCSV(
                  [['Trainee', 'Course', 'Assigned', 'Due', 'Progress %'], ...rows.map((x) => [x.t!.name, x.c!.name, x.a.assignedOn, x.a.due, statCourse(S, x.t!.id, x.c!).pct])],
                  'evoluz-assignments.csv'
                );
                toast('CSV exported');
              }}
            >
              Export CSV
            </button>
            <button className="btn primary" onClick={() => openModal(<AssignDialog />)}>＋ New assignment</button>
          </>
        }
      />
      <section className="card table-card">
        <div style={{ padding: '10px 5px' }}>
          <input className="input" placeholder="Search trainee, course or trainer…" aria-label="Search assignments" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Trainee</th><th>Course</th><th>Assigned</th><th>Due date</th><th>Progress</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map(({ a, t, c }) => {
                const st = statCourse(S, t!.id, c!);
                const overdue = isOverdue(a.due, st.pct);
                return (
                  <tr key={a.id}>
                    <td><Link className="person" href={`/trainees/${t!.id}`}><Avatar name={t!.name} tone={t!.tone} />{t!.name}</Link></td>
                    <td>{c!.name}</td>
                    <td>{fmtDate(a.assignedOn)}</td>
                    <td>
                      <input className="input" type="date" aria-label={`Due date for ${t!.name}, ${c!.name}`} style={{ padding: '5px 7px', fontSize: 11 }} value={a.due} onChange={(e) => setDue(a.id, e.target.value)} />
                    </td>
                    <td><ProgressBar pct={st.pct} /></td>
                    <td><Pill kind={overdue ? 'overdue' : st.pct >= 100 ? 'done' : st.pct > 0 ? 'progress' : 'wait'}>{overdue ? 'Overdue' : st.pct >= 100 ? 'Completed' : st.pct > 0 ? 'In progress' : 'Not started'}</Pill></td>
                    <td><button className="btn" onClick={() => confirm('Remove this course assignment? Topic records stay on file.', () => { unassign(a.id); toast('Assignment removed'); }, 'Remove')}>Remove</button></td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={7}><Empty>No assignments yet.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Guard>
  );
}
