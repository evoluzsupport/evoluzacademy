'use client';
import Link from 'next/link';
import { useState } from 'react';
import { match, usePortal } from '@/lib/store';
import { assignedCourses, progressFor, scopeTrainees } from '@/lib/selectors';
import { downloadCSV } from '@/lib/csv';
import { Avatar, Empty, Guard, PageHead, Pill, ProgressBar, SectionTitle } from '@/components/ui';
import { TraineeForm } from '@/components/forms';
import { ImportDialog } from '@/components/csvdialog';

export default function TraineesPage() {
  const { S, me, openModal } = usePortal();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const isAdmin = me?.kind === 'admin';
  const list = scopeTrainees(S, me)
    .filter((t) => match(q, t.name, t.email, t.jobRole))
    .filter((t) => !status || t.status === status);

  const exportCSV = () =>
    downloadCSV(
      [
        ['Name', 'Email', 'Role', 'Joined', 'Status', 'Trainer', 'Courses', 'Topics done', 'Topics total'],
        ...scopeTrainees(S, me).map((t) => {
          const p = progressFor(S, t);
          return [t.name, t.email, t.jobRole, t.joined, t.status, t.trainer, assignedCourses(S, t.id).map((c) => c.name).join('; '), p.done, p.total];
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
              </div>
            }
          />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Trainee</th><th>Role</th><th>Assigned courses</th><th>Overall progress</th><th>Trainer</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="person">
                      <Avatar name={t.name} tone={t.tone} />
                      <div>{t.name}<small style={{ display: 'block', color: '#98a3b2', fontWeight: 400, marginTop: 3 }}>{t.email}</small></div>
                    </div>
                  </td>
                  <td>{t.jobRole}</td>
                  <td>{assignedCourses(S, t.id).map((c) => <span key={c.id} className="pill neutral" style={{ margin: 2 }}>{c.name}</span>)}</td>
                  <td><ProgressBar pct={progressFor(S, t).pct} /></td>
                  <td>{t.trainer || '—'}</td>
                  <td><Pill kind={t.status === 'Active' ? 'active' : 'wait'}>{t.status}</Pill></td>
                  <td><Link className="btn soft" href={`/trainees/${t.id}`}>View →</Link></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7}><Empty>No trainees match this search.</Empty></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Guard>
  );
}
