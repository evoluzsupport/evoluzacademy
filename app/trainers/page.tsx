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
      <div className="grid module-grid">
        {list.map((r) => {
          const led = S.courses.filter((c) => primaryOf(c) === r.name).length;
          const delivered = Object.values(S.progress).filter((x) => x.done && x.trainer === r.name).length;
          return (
            <article className="card course-card" key={r.id} style={{ cursor: 'default' }}>
              <div className="course-card-top">
                <Avatar name={r.name} tone={r.tone} />
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn" onClick={() => openModal(<TrainerForm id={r.id} />)}>Edit</button>
                    <button className="btn" aria-label={`Remove ${r.name}`} onClick={() => del(r.id, r.name)}>×</button>
                  </div>
                )}
              </div>
              <h3>{r.name}</h3>
              <p>{r.specialty}</p>
              <div className="course-meta"><span>{led} primary courses</span><span>{delivered} completion marks</span></div>
              <small className="subtle">{r.email || (isAdmin ? 'No login email yet' : '')}</small>
            </article>
          );
        })}
      </div>
      {!list.length && <section className="card"><Empty>No trainers to show.</Empty></section>}
    </Guard>
  );
}
