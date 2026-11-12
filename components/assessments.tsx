'use client';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { usePortal } from '@/lib/store';
import type { Assessment, AssessmentAssign, Question } from '@/lib/types';
import { downloadCSV, field, parseCSV, QUESTION_COLUMNS, QUESTION_SAMPLES, slug } from '@/lib/csv';
import { today, uid } from '@/lib/util';
import { isAssigned, learners, traineeById } from '@/lib/selectors';
import { FormActions } from './ui';

export const DURATIONS = [60, 65, 70, 75, 80, 85, 90];
export const durationLabel = (m: number) => `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}`;
export const maxMarks = (a: Assessment) => a.questions.reduce((n, q) => n + q.marks, 0);
export const percent = (r: AssessmentAssign) => (r.total ? Math.round(((r.score ?? 0) / r.total) * 100) : 0);

const blank = (): Question => ({ id: uid('q-'), text: '', options: ['', '', '', ''], answer: 0, marks: 1 });

/** Reads a chosen option from a cell: a letter (A-F), a 1-based number, or the option's own text. -1 when it cannot be read. */
const choiceIndex = (raw: string, options: string[]) => {
  const v = raw.trim();
  if (!v) return -1;
  const i = /^[a-f]$/i.test(v) ? v.toUpperCase().charCodeAt(0) - 65 : /^\d+$/.test(v) ? Number(v) - 1 : options.findIndex((o) => o.trim().toLowerCase() === v.toLowerCase());
  return i >= 0 && i < options.length ? i : -1;
};

/** Turns the rows of an uploaded template into questions; rows that cannot be read are counted, not added. */
function fromCSV(text: string): { questions: Question[]; skipped: number } {
  const rows = parseCSV(text);
  const questions: Question[] = [];
  let skipped = 0;
  for (const r of rows) {
    const q = (field(r, 'Question') ?? '').trim();
    const options = ['Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Option F'].map((k) => (field(r, k) ?? '').trim()).filter(Boolean);
    const raw = (field(r, 'Correct Answer', 'Answer') ?? '').trim();
    const answer = choiceIndex(raw, options);
    const marks = Number(field(r, 'Marks', 'Mark')) || 1;
    if (!q || options.length < 2 || answer < 0 || answer >= options.length || marks < 1) {
      skipped++;
      continue;
    }
    questions.push({ id: uid('q-'), text: q, options, answer, marks: Math.round(marks) });
  }
  return { questions, skipped };
}

export function AssessmentForm({ id }: { id?: string }) {
  const { S, update, closeModal, toast, me } = usePortal();
  const ex = id ? S.assessments.find((a) => a.id === id) : undefined;
  const [title, setTitle] = useState(ex?.title ?? '');
  const [courseId, setCourseId] = useState(ex?.courseId ?? '');
  const [duration, setDuration] = useState(ex?.durationMin ?? 60);
  const [description, setDescription] = useState(ex?.description ?? '');
  const [qs, setQs] = useState<Question[]>(ex?.questions.length ? ex.questions : [blank()]);
  const file = useRef<HTMLInputElement>(null);
  const keyFile = useRef<HTMLInputElement>(null);
  const total = qs.reduce((n, q) => n + (q.marks > 0 ? q.marks : 0), 0);

  const setQ = (i: number, patch: Partial<Question>) => setQs((p) => p.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setOpt = (i: number, k: number, v: string) => setQs((p) => p.map((q, j) => (j === i ? { ...q, options: q.options.map((o, m) => (m === k ? v : o)) } : q)));

  const importFile = async (f: File) => {
    const { questions, skipped } = fromCSV(await f.text());
    if (!questions.length) return toast('No valid questions found in that file');
    setQs((p) => [...p.filter((q) => q.text.trim()), ...questions]);
    toast(`${questions.length} ${questions.length === 1 ? 'question' : 'questions'} imported${skipped ? `, ${skipped} skipped` : ''}`);
  };

  /** Sets the correct answer of questions already in the form from a CSV (Question or Q No, plus Correct Answer). */
  const importKey = async (f: File) => {
    const rows = parseCSV(await f.text());
    const next = qs.map((q) => ({ ...q }));
    let updated = 0;
    let skipped = 0;
    rows.forEach((r, n) => {
      const text = (field(r, 'Question') ?? '').trim().toLowerCase();
      const no = Number((field(r, 'Q No', 'No', 'Question No', 'S No') ?? '').replace(/\D/g, ''));
      const q = (text && next.find((x) => x.text.trim().toLowerCase() === text)) || (no ? next[no - 1] : !text ? next[n] : undefined);
      const i = q ? choiceIndex(field(r, 'Correct Answer', 'Answer') ?? '', q.options) : -1;
      if (!q || i < 0 || !q.options[i]?.trim()) return void skipped++;
      q.answer = i;
      updated++;
    });
    if (!updated) return toast('No answers matched the questions in this assessment');
    setQs(next);
    toast(`${updated} ${updated === 1 ? 'answer' : 'answers'} updated${skipped ? `, ${skipped} skipped` : ''}`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = qs.filter((q) => q.text.trim());
    if (!clean.length) return toast('Add at least one question');
    for (const q of clean) {
      const opts = q.options.filter((o) => o.trim());
      if (opts.length < 2) return toast('Each question needs at least two options');
      if (!q.options[q.answer]?.trim()) return toast('Mark a filled-in option as the correct answer');
      if (!(q.marks > 0)) return toast('Marks must be at least 1');
    }
    // drop empty options but keep the correct answer pointing at the same text
    const questions = clean.map((q) => {
      const keep = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      return { ...q, text: q.text.trim(), options: keep.map((x) => x.o), answer: keep.findIndex((x) => x.i === q.answer), marks: Math.round(q.marks) };
    });
    update((s) => {
      const rec: Assessment = { id: ex?.id ?? uid('asm-'), courseId, title: title.trim(), description: description.trim(), durationMin: duration, createdBy: ex?.createdBy || me?.name || '', questions };
      if (ex) s.assessments = s.assessments.map((a) => (a.id === ex.id ? rec : a));
      else s.assessments.push(rec);
    });
    toast(ex ? 'Assessment updated' : 'Assessment created');
    closeModal();
  };

  return (
    <>
      <h2>{ex ? 'Edit assessment' : 'Create assessment'}</h2>
      <p>An objective quiz for a course. Every question has marks, and the total is the maximum score. The trainee gets between 1 hr and 1 hr 30 min.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field full"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Basic Zoho Quiz Exam" /></div>
          <div className="field">
            <label>Course</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
              <option value="">Select course…</option>
              {S.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Time allowed</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
            </select>
          </div>
          <div className="field full"><label>Instructions</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown to the trainee before they start" /></div>
        </div>

        <div className="section-title" style={{ marginTop: 16 }}>
          <div>
            <h3>Questions <span className="pill progress">{qs.filter((q) => q.text.trim()).length}</span> <span className="pill active">Max marks {total}</span></h3>
          </div>
          <div className="actions">
            <button type="button" className="btn soft" onClick={() => downloadCSV([QUESTION_COLUMNS, ...QUESTION_SAMPLES], 'evoluz-assessment-template.csv')}>⇩ Template</button>
            <button type="button" className="btn soft" onClick={() => file.current?.click()}>↑ Import questions</button>
            <button type="button" className="btn soft" title="Upload a CSV with Question (or Q No) and Correct Answer to set the answers of the questions below" onClick={() => keyFile.current?.click()}>↑ Import answers</button>
          </div>
        </div>
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }} />
        <input ref={keyFile} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importKey(f); }} />

        <div style={{ display: 'grid', gap: 12 }}>
          {qs.map((q, i) => (
            <div key={q.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <b style={{ fontSize: 12 }}>Q{i + 1}</b>
                <input style={{ flex: 1 }} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Question" />
                <input type="number" min={1} style={{ width: 70 }} value={q.marks} onChange={(e) => setQ(i, { marks: Number(e.target.value) })} aria-label="Marks" title="Marks" />
                <button type="button" className="btn" onClick={() => setQs((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : [blank()]))} aria-label="Remove question">✕</button>
              </div>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {q.options.map((o, k) => (
                  <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                    <input type="radio" name={`ans-${q.id}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })} title="Correct answer" />
                    <span style={{ width: 16, fontSize: 11 }}>{String.fromCharCode(65 + k)}</span>
                    <input style={{ flex: 1 }} value={o} onChange={(e) => setOpt(i, k, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + k)}`} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn soft" style={{ marginTop: 10 }} onClick={() => setQs((p) => [...p, blank()])}>＋ Add question</button>
        <small className="subtle" style={{ display: 'block', marginTop: 6 }}>Pick the round button beside the correct option. Marks are in the small box on each question.</small>
        <FormActions onCancel={closeModal} save={ex ? 'Save changes' : 'Create assessment'} />
      </form>
    </>
  );
}

/** The trainee's answers next to the correct ones. */
export function ResultReview({ assignId }: { assignId: string }) {
  const { S, closeModal } = usePortal();
  const r = S.assessmentAssigns.find((a) => a.id === assignId);
  const a = r && S.assessments.find((x) => x.id === r.assessmentId);
  if (!r || !a) return <p>Not found.</p>;
  const who = traineeById(S, r.traineeId)?.name ?? 'Trainee';
  return (
    <>
      <h2>{a.title}</h2>
      <p>{who} · scored <b>{r.score ?? 0}/{r.total ?? maxMarks(a)}</b> ({percent(r)}%)</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {a.questions.map((q, i) => {
          const pick = r.answers[q.id];
          const ok = pick === q.answer;
          return (
            <div key={q.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 12 }}>Q{i + 1}. {q.text}</b>
                <span className={`pill ${ok ? 'active' : 'overdue'}`}>{ok ? q.marks : 0}/{q.marks}</span>
              </div>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12 }}>
                {q.options.map((o, k) => (
                  <li key={k} style={{ color: k === q.answer ? '#2e7d32' : k === pick ? '#c62828' : undefined, fontWeight: k === q.answer || k === pick ? 700 : 400 }}>
                    {o}{k === q.answer ? ' ✓' : ''}{k === pick && k !== q.answer ? ' (chosen)' : ''}
                  </li>
                ))}
              </ul>
              {pick === undefined && <small className="subtle">Not answered</small>}
            </div>
          );
        })}
      </div>
      <div className="modal-actions"><button className="btn" onClick={closeModal}>Close</button></div>
    </>
  );
}

/** Upload what each trainee chose (one row per trainee); answers are scored against the answer key and saved as submitted results. */
export function ImportResultsForm({ id }: { id: string }) {
  const { S, update, closeModal, toast } = usePortal();
  const file = useRef<HTMLInputElement>(null);
  const a = S.assessments.find((x) => x.id === id);
  if (!a) return <p>Not found.</p>;

  const template = () =>
    downloadCSV(
      [['Email', 'Name', ...a.questions.map((_, i) => `Q${i + 1}`)], ['asha.verma@evoluz.tech', 'Asha Verma', ...a.questions.map((q, i) => String.fromCharCode(65 + (i % q.options.length)))]],
      `${slug(a.title) || 'assessment'}-answers-template.csv`
    );

  const run = async (f: File) => {
    const rows = parseCSV(await f.text());
    if (!rows.length) return toast('No rows found in that file');
    const people = learners(S);
    const results: { traineeId: string; answers: Record<string, number>; score: number }[] = [];
    const problems: string[] = [];
    const seen = new Set<string>();
    rows.forEach((r, n) => {
      const email = (field(r, 'Email') ?? '').trim().toLowerCase();
      const name = (field(r, 'Name', 'Trainee') ?? '').trim().toLowerCase();
      const t = people.find((p) => (email && p.email.toLowerCase() === email) || (!email && name && p.name.trim().toLowerCase() === name));
      const label = email || name || `row ${n + 2}`;
      if (!t) return void problems.push(`${label}: trainee not found`);
      if (!isAssigned(S, t.id, a.courseId)) return void problems.push(`${t.name}: not assigned to this course`);
      if (seen.has(t.id)) return void problems.push(`${t.name}: listed twice`);
      if (S.assessmentAssigns.some((x) => x.assessmentId === a.id && x.traineeId === t.id && x.status === 'submitted')) return void problems.push(`${t.name}: already submitted`);
      const answers: Record<string, number> = {};
      let score = 0;
      a.questions.forEach((q, i) => {
        const k = choiceIndex(field(r, `Q${i + 1}`) ?? '', q.options);
        if (k < 0) return;
        answers[q.id] = k;
        if (k === q.answer) score += q.marks;
      });
      if (!Object.keys(answers).length) return void problems.push(`${t.name}: no readable answers`);
      seen.add(t.id);
      results.push({ traineeId: t.id, answers, score });
    });
    if (!results.length) return toast(problems[0] ? `Nothing imported. ${problems[0]}` : 'Nothing imported');
    const at = new Date().toISOString();
    update((s) => {
      for (const x of results) {
        const rec = s.assessmentAssigns.find((r) => r.assessmentId === a.id && r.traineeId === x.traineeId);
        const done = { status: 'submitted' as const, startedAt: at, submittedAt: at, score: x.score, total: maxMarks(a), answers: x.answers };
        if (rec) Object.assign(rec, done);
        else s.assessmentAssigns.push({ id: uid('aa-'), assessmentId: a.id, traineeId: x.traineeId, assignedOn: today(), due: '', ...done });
      }
    });
    toast(`${results.length} ${results.length === 1 ? 'result' : 'results'} imported${problems.length ? `, ${problems.length} skipped (${problems.slice(0, 2).join('; ')}${problems.length > 2 ? '…' : ''})` : ''}`);
    closeModal();
  };

  return (
    <>
      <h2>Import answers</h2>
      <p>{a.title}. Upload a CSV with one row per trainee: their <b>Email</b> (or Name) and the option they chose for each question in columns <b>Q1</b> to <b>Q{a.questions.length}</b> (A, B, C… or the option text). Answers are scored with the answer key and added to the Assessment report as submitted. Trainees who already submitted are skipped.</p>
      <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void run(f); }} />
      <div className="modal-actions">
        <button type="button" className="btn" onClick={closeModal}>Cancel</button>
        <button type="button" className="btn soft" onClick={template}>⇩ Template</button>
        <button type="button" className="btn primary" onClick={() => file.current?.click()}>↑ Choose CSV</button>
      </div>
    </>
  );
}
