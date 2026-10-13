'use client';
import { useState } from 'react';
import { match, usePortal } from '@/lib/store';
import { assignedCourses, scopeTrainees } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import { downloadCSV } from '@/lib/csv';
import { Avatar, Empty, Guard, PageHead } from '@/components/ui';
import { TrainerForm } from '@/components/forms';
import { ImportDialog } from '@/components/csvdialog';

export default function TrainersPage() {
  const { S, me, openModal, confirm, update, toast } = usePortal();
  const [q, setQ] = useState('');
  const isAdmin = me?.kind === 'admin';

  // trainees only see the trainers connected to their own courses
  let pool = S.trainers;
  if (me?.kind === 'trainee') {
    const mine = scopeTrainees(S, me)[0];
    const names = new Set<string>();
    if (mine?.trainer) names.add(mine.trainer);
    assignedCourses(S, me.id).forEach((c) => names.add(primaryOf(c)));
    Object.entries(S.progress).forEach(([k, r]) => k.startsWith(me.id + '|') && names.add(r.trainer));
    pool = S.trainers.filter((t) => names.has(t.name));
  }
  const list = pool.filter((r) => match(q, r.name, r.specialty));

  const del = (id: string, name: string) =>
    confirm(`Remove ${name} from the trainer directory? Courses they lead and past completions keep their name.`, () => {
      update((s) => {
        s.trainers = s.trainers.filter((t) => t.id !== id);
      });
      toast('Trainer removed');
    });

  return (
    <Guard kinds={['admin', 'trainee']}>
      <PageHead
        title={me?.kind === 'trainee' ? 'My trainers' : 'Trainers'}
        desc="See primary course ownership separately from topics actually delivered."
        actions={
          isAdmin && (
            <>
              <button className="btn" onClick={() => openModal(<ImportDialog kind="trainers" />)}>Import CSV</button>
              <button className="btn" onClick={() => downloadCSV([['Name', 'Role', 'Email'], ...S.trainers.map((t) => [t.name, t.specialty, t.email])], 'evoluz-trainers.csv')}>Export CSV</button>
              <button className="btn primary" onClick={() => openModal(<TrainerForm />)}>＋ Add trainer</button>
            </>
          )
        }
      />
      <div className="toolbar" style={{ marginBottom: 15 }}>
        <input className="input" placeholder="Search trainers..." aria-label="Search trainers" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <section className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Trainer</th>
                <th>Role</th>
                <th>Email</th>
                <th>Primary courses</th>
                <th>Completion marks</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const led = S.courses.filter((c) => primaryOf(c) === r.name).length;
                const delivered = Object.values(S.progress).filter((x) => x.done && x.trainer === r.name).length;
                return (
                  <tr key={r.id}>
                    <td><div className="person"><Avatar name={r.name} tone={r.tone} />{r.name}</div></td>
                    <td>{r.specialty || '—'}</td>
                    <td>{r.email || <span className="subtle">{isAdmin ? 'No login email yet' : '—'}</span>}</td>
                    <td>{led}</td>
                    <td>{delivered}</td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn" onClick={() => openModal(<TrainerForm id={r.id} />)}>Edit</button>
                          <button className="btn" aria-label={`Remove ${r.name}`} onClick={() => del(r.id, r.name)}>×</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!list.length && <Empty>No trainers to show.</Empty>}
      </section>
    </Guard>
  );
}
