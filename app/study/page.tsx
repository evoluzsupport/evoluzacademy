'use client';
import Link from 'next/link';
import { useState } from 'react';
import { match, usePortal } from '@/lib/store';
import { Empty, Guard, PageHead, Pill, ProgressBar } from '@/components/ui';

export default function MyStudyPage() {
  const { S, me } = usePortal();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');

  const rows = S.courses
    .filter((c) => match(q, c.name, c.group))
    .filter((c) => !group || c.group === group)
    .map((c) => {
      const done = c.topics.filter((t) => S.study[`${me?.id}|${c.id}|${t.id}`]).length;
      return { c, done, pct: c.topics.length ? Math.round((done / c.topics.length) * 100) : 0 };
    });

  return (
    <Guard kinds={['trainer', 'trainee']}>
      <PageHead title="My Study" desc="Learn at your own pace. Pick any course and tick each topic as you finish it." />
      <div className="toolbar" style={{ marginBottom: 15 }}>
        <input className="input" placeholder="Search courses..." aria-label="Search courses" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" aria-label="Category" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">All categories</option>
          {['Common', 'Zoho apps', 'Role-based'].map((x) => <option key={x}>{x}</option>)}
        </select>
        <span className="subtle">{rows.length} courses</span>
      </div>
      <section className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Course</th><th>Category</th><th>Duration</th><th>Topics</th><th>My progress</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map(({ c, done, pct }) => (
                <tr key={c.id}>
                  <td><Link href={`/study/${c.id}`} className="list-link">{c.name}</Link></td>
                  <td><span className={`pill ${c.group === 'Common' ? 'active' : c.group === 'Role-based' ? 'wait' : 'progress'}`}>{c.group}</span></td>
                  <td>{c.duration}</td>
                  <td>{done} / {c.topics.length}</td>
                  <td style={{ minWidth: 130 }}><ProgressBar pct={pct} /></td>
                  <td><Pill kind={pct >= 100 ? 'done' : pct > 0 ? 'progress' : 'wait'}>{pct >= 100 ? 'Completed' : pct > 0 ? 'In progress' : 'Not started'}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty>{S.courses.length ? 'No courses match your search.' : 'No courses available yet.'}</Empty>}
      </section>
    </Guard>
  );
}
