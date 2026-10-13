'use client';
import Link from 'next/link';
import { useState } from 'react';
import { match, usePortal } from '@/lib/store';
import { primaryOf } from '@/lib/seed';
import { downloadCSV } from '@/lib/csv';
import { Empty, Guard, PageHead } from '@/components/ui';
import { CourseForm } from '@/components/forms';
import { ImportDialog } from '@/components/csvdialog';

export default function CoursesPage() {
  const { S, me, openModal, confirm, removeCourses } = usePortal();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const isAdmin = me?.kind === 'admin';
  const list = S.courses.filter((c) => match(q, c.name, c.group)).filter((c) => !group || c.group === group);
  const chosen = list.filter((c) => picked.has(c.id));
  const allOn = list.length > 0 && chosen.length === list.length;

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setPicked(allOn ? new Set() : new Set(list.map((c) => c.id)));

  const deleteChosen = () =>
    confirm(
      `Delete ${chosen.length} ${chosen.length === 1 ? 'course' : 'courses'}? Their topics, assignments, progress and sessions are removed too. This cannot be undone.`,
      () => {
        removeCourses(chosen.map((c) => c.id));
        setPicked(new Set());
      },
      'Delete'
    );

  const exportCurriculum = () => {
    const rows: string[][] = [['Course', 'Planned Day', 'Trainer Name', 'Category', 'Training Topic', 'What We Cover', 'Practical Activity / Assessment', 'Group', 'Duration']];
    S.courses.forEach((c) => {
      if (!c.topics.length) rows.push([c.name, '', primaryOf(c), '', '', '', '', c.group, c.duration]);
      else c.topics.forEach((t) => rows.push([c.name, t.day, t.trainer || primaryOf(c), t.category ?? '', t.topic, t.cover, t.activity, c.group, c.duration]));
    });
    downloadCSV(rows, 'evoluz-curriculum.csv');
  };

  return (
    <Guard kinds={['admin']}>
      <PageHead
        title="Course library"
        desc="Build distinct learning paths from the shared foundation to role-specific practice."
        actions={
          <>
            {isAdmin && <button className="btn" onClick={() => openModal(<ImportDialog kind="curriculum" />)}>Import curriculum</button>}
            <button className="btn" onClick={exportCurriculum}>Export curriculum</button>
            {isAdmin && <button className="btn primary" onClick={() => openModal(<CourseForm />)}>＋ New course</button>}
          </>
        }
      />
      <div className="toolbar" style={{ marginBottom: 15 }}>
        <input className="input" placeholder="Search courses..." aria-label="Search courses" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" aria-label="Category" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">All categories</option>
          {['Common', 'Zoho apps', 'Role-based'].map((x) => <option key={x}>{x}</option>)}
        </select>
        <span className="subtle">{list.length} paths</span>
        {isAdmin && chosen.length > 0 && (
          <button className="btn" style={{ marginLeft: 'auto', color: 'var(--red)', borderColor: 'var(--red)' }} onClick={deleteChosen}>
            Delete selected ({chosen.length})
          </button>
        )}
      </div>
      <section className="card table-card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: 34 }}>
                    <input type="checkbox" className="row-check" aria-label="Select all courses" checked={allOn} onChange={toggleAll} />
                  </th>
                )}
                <th>Course</th>
                <th>Category</th>
                <th>Duration</th>
                <th>Topics</th>
                <th>Primary trainer</th>
                <th>Learners</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  {isAdmin && (
                    <td>
                      <input type="checkbox" className="row-check" aria-label={`Select ${c.name}`} checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                    </td>
                  )}
                  <td><Link href={`/courses/${c.id}`} className="list-link">{c.name}</Link></td>
                  <td><span className={`pill ${c.group === 'Common' ? 'active' : c.group === 'Role-based' ? 'wait' : 'progress'}`}>{c.group}</span></td>
                  <td>{c.duration}</td>
                  <td>{c.topics.length}</td>
                  <td>{primaryOf(c)}</td>
                  <td>{S.assignments.filter((a) => a.courseId === c.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && <Empty>{S.courses.length ? 'No courses match your search.' : 'No courses yet. Use Import curriculum or New course to add one.'}</Empty>}
      </section>
    </Guard>
  );
}
