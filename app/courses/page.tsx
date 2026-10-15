'use client';
import Link from 'next/link';
import { useState } from 'react';
import { match, usePortal } from '@/lib/store';
import { primaryOf } from '@/lib/seed';
import { downloadCSV } from '@/lib/csv';
import { Empty, Guard, PageHead, SectionTitle } from '@/components/ui';
import { ViewBody, ViewSwitch, useView } from '@/components/views';
import type { Grouper } from '@/components/views';
import type { Course } from '@/lib/types';
import { CourseForm } from '@/components/forms';
import { ImportDialog } from '@/components/csvdialog';

export default function CoursesPage() {
  const { S, me, openModal, confirm, removeCourses } = usePortal();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const view = useView('courses');
  const groupers: Grouper<Course>[] = [
    { key: 'category', label: 'Category', of: (c) => c.group },
    { key: 'trainer', label: 'Primary trainer', of: (c) => primaryOf(c) },
    { key: 'duration', label: 'Duration', of: (c) => c.duration },
  ];
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const isAdmin = me?.kind === 'admin';
  const list = S.courses.filter((c) => match(q, c.name, c.group)).filter((c) => !cat || c.group === cat);
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
      <section className="card table-card">
        <div style={{ padding: '10px 5px 3px' }}>
          <SectionTitle
            title={<>All courses <span className="subtle">· {list.length} {list.length === 1 ? 'path' : 'paths'}</span></>}
            right={
              <div className="toolbar">
                <input className="input" placeholder="Search courses..." aria-label="Search courses" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className="select" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
                  <option value="">All categories</option>
                  {['Common', 'Zoho apps', 'Role-based'].map((x) => <option key={x}>{x}</option>)}
                </select>
                <ViewSwitch view={view} groupers={groupers} />
                {isAdmin && chosen.length > 0 && (
                  <button className="btn" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={deleteChosen}>
                    Delete selected ({chosen.length})
                  </button>
                )}
              </div>
            }
          />
        </div>
        <ViewBody
          view={view}
          items={list}
          groupers={groupers}
          id={(c) => c.id}
          empty={<Empty>{S.courses.length ? 'No courses match your search.' : 'No courses yet. Use Import curriculum or New course to add one.'}</Empty>}
          card={(c) => (
            <div className="vcard">
              <div className="vtop">
                <Link href={`/courses/${c.id}`} className="list-link">{c.name}</Link>
                {isAdmin && (
                  <input type="checkbox" className="row-check" aria-label={`Select ${c.name}`} checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                )}
              </div>
              <div><span className={`pill ${c.group === 'Common' ? 'active' : c.group === 'Role-based' ? 'wait' : 'progress'}`}>{c.group}</span></div>
              <dl className="vmeta">
                <div><dt>Duration</dt><dd>{c.duration}</dd></div>
                <div><dt>Topics</dt><dd>{c.topics.length}</dd></div>
                <div><dt>Primary trainer</dt><dd>{primaryOf(c)}</dd></div>
                <div><dt>Learners</dt><dd>{S.assignments.filter((a) => a.courseId === c.id).length}</dd></div>
              </dl>
            </div>
          )}
          list={
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
          }
        />
        {view.mode === 'list' && !list.length && <Empty>{S.courses.length ? 'No courses match your search.' : 'No courses yet. Use Import curriculum or New course to add one.'}</Empty>}
      </section>
    </Guard>
  );
}
