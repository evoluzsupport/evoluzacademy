'use client';
import Link from 'next/link';
import { useState } from 'react';
import { match, usePortal } from '@/lib/store';
import { assignedCourses, assignedTrainersOf, progressFor, scopeTrainees } from '@/lib/selectors';
import { downloadCSV } from '@/lib/csv';
import { Avatar, Empty, Guard, PageHead, Pill, ProgressBar, SectionTitle } from '@/components/ui';
import { TraineeForm } from '@/components/forms';
import { ImportDialog } from '@/components/csvdialog';

export default function TraineesPage() {
  const { S, me, openModal, confirm, removeTrainees } = usePortal();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const isAdmin = me?.kind === 'admin';
  const list = scopeTrainees(S, me)
    .filter((t) => match(q, t.name, t.email, t.jobRole))
    .filter((t) => !status || t.status === status);
  // learners who are really trainers or admins have no trainee record to delete
  const removable = list.filter((t) => S.trainees.some((x) => x.id === t.id));
  const chosen = removable.filter((t) => picked.has(t.id));
  const allOn = removable.length > 0 && chosen.length === removable.length;

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setPicked(allOn ? new Set() : new Set(removable.map((t) => t.id)));

  const deleteChosen = () =>
    confirm(
      `Delete ${chosen.length} ${chosen.length === 1 ? 'trainee' : 'trainees'}? Their assignments and progress are removed too. This cannot be undone.`,
      () => {
        removeTrainees(chosen.map((t) => t.id));
        setPicked(new Set());
      },
      'Delete'
    );

  const exportCSV = () =>
    downloadCSV(
      [
        ['Name', 'Email', 'Role', 'Joined', 'Status', 'Trainer', 'Courses', 'Topics done', 'Topics total'],
        ...scopeTrainees(S, me).map((t) => {
          const p = progressFor(S, t);
          return [t.name, t.email, t.jobRole, t.joined, t.status, assignedTrainersOf(S, t.id, t.trainer), assignedCourses(S, t.id).map((c) => c.name).join('; '), p.done, p.total];
        }),
      ],
      'evoluz-trainees.csv'
    );

  return (
    <Guard kinds={['admin', 'trainer']}>
      <PageHead
        title={isAdmin ? 'Trainees' : 'My Trainee'}
        desc="Manage learner profiles, learning paths, and individual progress."
        actions={
          <>
            {isAdmin && <button className="btn" onClick={() => openModal(<ImportDialog kind="trainees" />)}>Import CSV</button>}
            <button className="btn" onClick={exportCSV}>Export CSV</button>
            {isAdmin && <button className="btn primary" onClick={() => openModal(<TraineeForm />)}>＋ Add trainee</button>}
          </>
        }
      />
      <section className="card table-card">
        <div style={{ padding: '10px 5px 3px' }}>
          <SectionTitle
            title={<>All trainees <span className="subtle">· {list.length} people</span></>}
            right={
              <div className="toolbar">
                <input className="input" placeholder="Search trainees..." aria-label="Search trainees" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className="select" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  <option>Active</option>
                  <option>On hold</option>
                </select>
                {isAdmin && chosen.length > 0 && (
                  <button className="btn" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={deleteChosen}>
                    Delete selected ({chosen.length})
                  </button>
                )}
              </div>
            }
          />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr>{isAdmin && <th style={{ width: 34 }}><input type="checkbox" className="row-check" aria-label="Select all trainees" checked={allOn} onChange={toggleAll} /></th>}<th>Trainee</th><th>Role</th><th>Assigned courses</th><th>Overall progress</th><th>Assigned trainer</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  {isAdmin && (
                    <td>
                      {S.trainees.some((x) => x.id === t.id) && (
                        <input type="checkbox" className="row-check" aria-label={`Select ${t.name}`} checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                      )}
                    </td>
                  )}
                  <td>
                    <div className="person">
                      <Avatar name={t.name} tone={t.tone} />
                      <div><Link className="list-link" href={`/trainees/${t.id}`}>{t.name}</Link><small style={{ display: 'block', color: '#98a3b2', fontWeight: 400, marginTop: 3 }}>{t.email}</small></div>
                    </div>
                  </td>
                  <td>{t.jobRole}</td>
                  <td>{assignedCourses(S, t.id).map((c) => <span key={c.id} className="pill neutral" style={{ margin: 2 }}>{c.name}</span>)}</td>
                  <td><ProgressBar pct={progressFor(S, t).pct} /></td>
                  <td>{assignedTrainersOf(S, t.id, t.trainer) || '—'}</td>
                  <td><Pill kind={t.status === 'Active' ? 'active' : 'wait'}>{t.status}</Pill></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <Link className="btn soft" href={`/trainees/${t.id}`}>View →</Link>
                      {isAdmin && S.trainees.some((x) => x.id === t.id) && <button className="btn" onClick={() => openModal(<TraineeForm id={t.id} />)}>Edit</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={isAdmin ? 8 : 7}><Empty>No trainees match this search.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Guard>
  );
}
