'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePortal } from '@/lib/store';
import { coursesOfTrainer, learnersOfTrainer, nameMatches, scopeTrainees } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { downloadCSV } from '@/lib/csv';
import { fmtDate } from '@/lib/util';
import { Avatar, Empty, Guard, Pill, ProgressBar, SectionTitle, Stat } from '@/components/ui';

/** Drill-down report for one trainer: the courses they teach and the learners they teach on each. */
export default function TrainerReport() {
  const { id } = useParams<{ id: string }>();
  const { S, me } = usePortal();
  const person =
    S.trainers.find((x) => x.id === id) ?? S.admins.find((x) => x.id === id) ?? S.trainees.find((x) => x.id === id);

  if (!person) {
    return (
      <Guard kinds={['admin', 'trainer']}>
        <section className="card empty">
          Trainer not found. <Link href={me?.kind === 'admin' ? '/trainers' : '/analytics'} style={{ color: '#3158b6' }}>Go back</Link>
        </section>
      </Guard>
    );
  }

  const title = 'specialty' in person ? person.specialty : 'jobRole' in person ? person.jobRole : '';
  const role = S.trainers.some((x) => x.id === id) ? 'Trainer' : S.admins.some((x) => x.id === id) ? 'Admin' : 'Trainee';
  const courses = coursesOfTrainer(S, person.name);
  // a trainer only sees the learners already in their own scope
  const rows = learnersOfTrainer(S, person.name, scopeTrainees(S, me));
  const delivered = rows.reduce((n, r) => n + r.items.reduce((m, i) => m + i.delivered, 0), 0);
  const back = me?.kind === 'admin' ? '/trainers' : '/analytics';

  const exportCSV = () =>
    downloadCSV(
      [
        ['Trainer', 'Trainee', 'Course', 'Start date', 'Due', 'Topics done', 'Topics total', 'Delivered by trainer'],
        ...rows.flatMap((r) =>
          r.items.map((i) => [person.name, r.t.name, i.c.name, i.a.startDate ?? '', i.a.due, i.stat.done, i.stat.total, i.delivered])
        ),
      ],
      `evoluz-trainer-${person.name.toLowerCase().replace(/\s+/g, '-')}.csv`
    );

  return (
    <Guard kinds={['admin', 'trainer']}>
      <div className="page-head">
        <div>
          <div className="eyebrow"><Link href={back}>← Back</Link></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <Avatar name={person.name} />
            <div>
              <h1>{person.name}</h1>
              <p>{[role, title, person.email].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        </div>
        <div className="actions"><button className="btn" onClick={exportCSV}>Export report</button></div>
      </div>

      <div className="grid stats">
        <Stat label="Courses" note="Leads or teaches">{courses.length}</Stat>
        <Stat label="Trainees" note="Learning with this trainer">{rows.length}</Stat>
        <Stat label="Topics delivered" note="Credited to this trainer">{delivered}</Stat>
      </div>

      <section className="card section-card" style={{ marginTop: 17 }}>
        <SectionTitle title="Courses" right={<span className="subtle">Click a course to open it</span>} />
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Course</th><th>Category</th><th>Primary trainer</th><th>Topics</th><th>Trainees</th></tr></thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td><Link className="list-link" href={`/courses/${c.id}`}>{c.name}</Link></td>
                  <td>{c.group}</td>
                  <td>{nameMatches(c.primaryTrainer, person.name) ? <Pill kind="active">Primary</Pill> : primaryOf(c)}</td>
                  <td>{c.topics.length}</td>
                  <td>{rows.filter((r) => r.items.some((i) => i.c.id === c.id)).length}</td>
                </tr>
              ))}
              {!courses.length && <tr><td colSpan={5}><Empty>No courses yet for this trainer.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card section-card" style={{ marginTop: 17 }}>
        <SectionTitle title="Trainees by course" right={<span className="subtle">Click a trainee for their full report</span>} />
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Trainee</th><th>Course</th><th>Start date</th><th>Due</th><th>Delivered</th><th>Progress</th></tr></thead>
            <tbody>
              {rows.flatMap((r) =>
                r.items.map((i) => (
                  <tr key={i.a.id}>
                    <td>
                      <Link className="person" href={`/trainees/${r.t.id}`}><Avatar name={r.t.name} tone={r.t.tone} />{r.t.name}</Link>
                    </td>
                    <td><Link className="list-link" href={`/courses/${i.c.id}`}>{i.c.name}</Link></td>
                    <td>{i.a.startDate ? fmtDate(i.a.startDate) : '—'}</td>
                    <td>{i.a.due ? fmtDate(i.a.due) : '—'}</td>
                    <td>{i.delivered} / {i.stat.total}</td>
                    <td><ProgressBar pct={i.stat.pct} /></td>
                  </tr>
                ))
              )}
              {!rows.length && <tr><td colSpan={6}><Empty>No trainees are learning with this trainer yet.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Guard>
  );
}
