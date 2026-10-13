'use client';
import { useRef } from 'react';
import { usePortal } from '@/lib/store';
import { downloadCSV, slug, TEMPLATE_COLUMNS, TEMPLATE_SAMPLES, type ImportKind } from '@/lib/csv';

const LABELS: Record<ImportKind, string> = { trainees: 'Trainees', trainers: 'Trainers', curriculum: 'Curriculum', topics: 'Topics', users: 'Users' };
const DESCRIPTIONS: Record<ImportKind, string> = {
  trainees: 'Download the column template, fill in your trainee rows, then import the completed CSV.',
  trainers: 'Download the column template, fill in your trainer rows, then import the completed CSV.',
  curriculum: 'One row per topic, in the same layout as the training manual: Course, Planned Day, Trainer Name, Category, Training Topic, What We Cover and Practical Activity / Assessment. Repeat the course name on each row to import several courses at once. The sample file shows example rows.',
  topics: 'Download a template for this course, then import its topic rows.',
  users: 'One row per person with Name, Email, Access (Admin, Trainer or Trainee), Role and Phone. People already listed by email are updated.',
};

export function ImportDialog({ kind, courseId = '' }: { kind: ImportKind; courseId?: string }) {
  const { S, closeModal, importCSV, toast } = usePortal();
  const input = useRef<HTMLInputElement>(null);
  const courseName = kind === 'topics' ? S.courses.find((c) => c.id === courseId)?.name : '';

  const template = () => {
    const name = kind === 'topics' ? slug(courseName || 'topics') + '-topics' : kind;
    downloadCSV([TEMPLATE_COLUMNS[kind], ...TEMPLATE_SAMPLES[kind]], `evoluz-${name}-sample.csv`);
    toast('Sample file downloaded');
  };
  return (
    <>
      <div className="import-choice-head">
        <h2>
          Import {LABELS[kind]}
          {courseName ? ' · ' + courseName : ''}
        </h2>
        <button className="modal-close" aria-label="Close" onClick={closeModal}>×</button>
      </div>
      <p>{DESCRIPTIONS[kind]}</p>
      <div className="import-choice-actions">
        <button type="button" className="btn soft" onClick={template}>⇩ Download sample file</button>
        <button type="button" className="btn primary" onClick={() => input.current?.click()}>↑ Import file</button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          closeModal();
          if (f) void importCSV(kind, f, courseId);
        }}
      />
      <small className="subtle">CSV files only · Existing matching records will be updated.</small>
    </>
  );
}
