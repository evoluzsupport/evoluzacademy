'use client';
import Link from 'next/link';
import { useState } from 'react';
import { match, usePortal } from '@/lib/store';
import { primaryOf } from '@/lib/seed';
import { downloadCSV } from '@/lib/csv';
import { COURSE_ICONS, COURSE_TONES, Guard, PageHead } from '@/components/ui';
import { CourseForm } from '@/components/forms';
import { ImportDialog } from '@/components/csvdialog';

export default function CoursesPage() {
  const { S, me, openModal } = usePortal();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const isAdmin = me?.kind === 'admin';
  const list = S.courses.filter((c) => match(q, c.name, c.group)).filter((c) => !group || c.group === group);

  const exportCurriculum = () => {
    const rows: string[][] = [['Course', 'Category', 'Duration', 'Primary Trainer', 'Planned day', 'Topic', 'What we cover', 'Activity / assessment', 'Topic Trainer']];
    S.courses.forEach((c) => {
      if (!c.topics.length) rows.push([c.name, c.group, c.duration, primaryOf(c), '', '', '', '', '']);
      else c.topics.forEach((t) => rows.push([c.name, c.group, c.duration, primaryOf(c), t.day, t.topic, t.cover, t.activity, t.trainer || primaryOf(c)]));
    });
    downloadCSV(rows, 'evoluz-curriculum.csv');
  };

  return (
    <Guard kinds={['admin', 'trainer']}>
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
      </div>
      <div className="grid module-grid">
        {list.map((c, i) => (
          <Link key={c.id} href={`/courses/${c.id}`} className="card course-card card-link">
            <div className="course-card-top">
              <div className={`course-icon ${COURSE_TONES[i % 3]}`}>{COURSE_ICONS[i % 3]}</div>
              <span className={`pill ${c.group === 'Common' ? 'active' : c.group === 'Role-based' ? 'wait' : 'progress'}`}>{c.group}</span>
            </div>
            <h3>{c.name}</h3>
            <p>{c.duration} learning path with guided sessions and hands-on checkpoints.</p>
            <div className="course-meta">
              <span>{c.topics.length} topics</span>
              <span>Lead: {primaryOf(c)}</span>
              <span>{S.assignments.filter((a) => a.courseId === c.id).length} learners →</span>
            </div>
          </Link>
        ))}
      </div>
    </Guard>
  );
}
