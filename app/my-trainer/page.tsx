'use client';
import { usePortal } from '@/lib/store';
import { assignedCourses } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { Avatar, Empty, Guard, PageHead } from '@/components/ui';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const split = (v: string | undefined) =>
  String(v || '')
    .split(/\s*(?:\/|&|,|;|\band\b)\s*/i)
    .map((x) => x.trim())
    .filter((x) => x && !/^no trainer assigned$/i.test(x));

/** The trainers responsible for the signed-in trainer's own learning (courses assigned to them as a learner). */
export default function MyTrainerPage() {
  const { S, me } = usePortal();
  if (!me) return null;

  // trainer name -> courses they teach me
  const byTrainer = new Map<string, { name: string; courses: string[] }>();
  for (const c of assignedCourses(S, me.id)) {
    const a = S.assignments.find((x) => x.traineeId === me.id && x.courseId === c.id);
    const names = split(a?.trainer).length ? split(a?.trainer) : split(primaryOf(c));
    for (const n of names) {
      const e = byTrainer.get(norm(n)) ?? { name: n, courses: [] };
      e.courses.push(c.name);
      byTrainer.set(norm(n), e);
    }
  }
  const directory = [
    ...S.admins.map((p) => ({ ...p, kind: 'Admin', title: '', tone: '' })),
    ...S.trainers.map((p) => ({ ...p, kind: 'Trainer', title: p.specialty })),
    ...S.trainees.map((p) => ({ ...p, kind: 'Trainee', title: p.jobRole })),
  ];
  const rows = [...byTrainer.values()].map((t) => ({ ...t, who: directory.find((p) => norm(p.name) === norm(t.name)) }));

  return (
    <Guard kinds={['trainer']}>
      <PageHead title="My Trainer" desc="The trainers responsible for the courses assigned to you as a learner." />
      <section className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Trainer</th><th>Role</th><th>Email</th><th>Teaches me</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td><div className="person"><Avatar name={r.name} tone={r.who?.tone} />{r.name}</div></td>
                  <td>{r.who?.title || r.who?.kind || '—'}</td>
                  <td>{r.who?.email || <span className="subtle">—</span>}</td>
                  <td>{r.courses.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty>No trainer is assigned to you yet. They appear here once an admin assigns you a course with a trainer.</Empty>}
      </section>
    </Guard>
  );
}
