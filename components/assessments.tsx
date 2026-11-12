'use client';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { usePortal } from '@/lib/store';
import type { Assessment, AssessmentAssign, Question, State } from '@/lib/types';
import { downloadCSV, field, parseCSV, QUESTION_COLUMNS, QUESTION_SAMPLES, slug } from '@/lib/csv';
import { uid } from '@/lib/util';
import { examTakerById } from '@/lib/selectors';
import { FormActions } from './ui';

export const DURATIONS = [60, 65, 70, 75, 80, 85, 90];
export const durationLabel = (m: number) => `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}`;
export const maxMarks = (a: Assessment) => a.questions.reduce((n, q) => n + q.marks, 0);
export const percent = (r: AssessmentAssign) => (r.total ? Math.round(((r.score ?? 0) / r.total) * 100) : 0);

const blank = (kind: 'mcq' | 'written' = 'mcq'): Question =>
  kind === 'written' ? { id: uid('q-'), text: '', options: [], answer: -1, marks: 5, kind } : { id: uid('q-'), text: '', options: ['', '', '', ''], answer: 0, marks: 1, kind };
export const isWritten = (q: Question) => q.kind === 'written';

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
    const type = (field(r, 'Type') ?? '').trim().toLowerCase();
    const marksCell = Number(field(r, 'Marks', 'Mark')) || 1;
    if (type.startsWith('w') || type === 'essay' || type === 'descriptive') {
      if (!q || marksCell < 1) skipped++;
      else questions.push({ id: uid('q-'), text: q, options: [], answer: -1, marks: Math.round(marksCell), kind: 'written' });
      continue;
    }
    const options = ['Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Option F'].map((k) => (field(r, k) ?? '').trim()).filter(Boolean);
    const raw = (field(r, 'Correct Answer', 'Answer') ?? '').trim();
    const answer = choiceIndex(raw, options);
    const marks = Number(field(r, 'Marks', 'Mark')) || 1;
    if (!q || options.length < 2 || answer < 0 || answer >= options.length || marks < 1) {
      skipped++;
      continue;
    }
    questions.push({ id: uid('q-'), text: q, options, answer, marks: Math.round(marks), kind: 'mcq' });
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
  const total = qs.reduce((n, q) => n + (q.marks > 0 ? q.marks : 0), 0);

  const setQ = (i: number, patch: Partial<Question>) => setQs((p) => p.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const setOpt = (i: number, k: number, v: string) => setQs((p) => p.map((q, j) => (j === i ? { ...q, options: q.options.map((o, m) => (m === k ? v : o)) } : q)));

  const importFile = async (f: File) => {
    const { questions, skipped } = fromCSV(await f.text());
    if (!questions.length) return toast('No valid questions found in that file');
    setQs((p) => [...p.filter((q) => q.text.trim()), ...questions]);
    toast(`${questions.length} ${questions.length === 1 ? 'question' : 'questions'} imported${skipped ? `, ${skipped} skipped` : ''}`);
  };

  /** Downloads the answer sheet of everyone who has sat this assessment: their answers, score and feedback, under an answer-key row. */
  const exportExam = () => {
    if (!ex) return;
    const done = S.assessmentAssigns.filter((r) => r.assessmentId === ex.id && r.status === 'submitted');
    if (!done.length) return toast('Nobody has submitted this exam yet');
    const letter = (i: number) => String.fromCharCode(65 + i);
    const cell = (q: Question, v: number | string | undefined) =>
      isWritten(q) ? (typeof v === 'string' ? v : '') : typeof v === 'number' && q.options[v] !== undefined ? `${letter(v)}. ${q.options[v]}` : '';
    const head = ['Name', 'Email', 'Role', 'Submitted', 'Score', 'Total', 'Percent', ...ex.questions.flatMap((q, i) => (isWritten(q) ? [`Q${i + 1}`, `Q${i + 1} Marks`] : [`Q${i + 1}`])), 'Feedback'];
    const key = ['ANSWER KEY', '', '', '', '', String(maxMarks(ex)), '', ...ex.questions.flatMap((q) => (isWritten(q) ? [q.text, String(q.marks)] : [cell(q, q.answer)])), ''];
    const rows = done.map((r) => {
      const p = examTakerById(S, r.traineeId);
      return [
        p?.name ?? 'Unknown', p?.email ?? '', p?.role ?? '', r.submittedAt ? r.submittedAt.slice(0, 10) : '', r.score ?? '', r.total ?? maxMarks(ex), `${percent(r)}%`,
        ...ex.questions.flatMap((q) => (isWritten(q) ? [cell(q, r.answers[q.id]), r.writtenMarks?.[q.id] ?? ''] : [cell(q, r.answers[q.id])])),
        r.feedback ?? '',
      ];
    });
    downloadCSV([head, key, ...rows], `${slug(ex.title) || 'exam'}-answer-sheet.csv`);
    toast(`Exported ${done.length} answer ${done.length === 1 ? 'sheet' : 'sheets'}`);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = qs.filter((q) => q.text.trim());
    if (!clean.length) return toast('Add at least one question');
    for (const q of clean) {
      if (!(q.marks > 0)) return toast('Marks must be at least 1');
      if (isWritten(q)) continue;
      const opts = q.options.filter((o) => o.trim());
      if (opts.length < 2) return toast('Each question needs at least two options');
      if (!q.options[q.answer]?.trim()) return toast('Mark a filled-in option as the correct answer');
      if (!(q.marks > 0)) return toast('Marks must be at least 1');
    }
    // drop empty options but keep the correct answer pointing at the same text
    const questions = clean.map((q) => {
      if (isWritten(q)) return { ...q, text: q.text.trim(), options: [], answer: -1, marks: Math.round(q.marks), kind: 'written' as const };
      const keep = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
      return { ...q, text: q.text.trim(), options: keep.map((x) => x.o), answer: keep.findIndex((x) => x.i === q.answer), marks: Math.round(q.marks), kind: 'mcq' as const };
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
            <button type="button" className="btn soft" disabled={!ex} title={ex ? 'Download the answer sheet of everyone who has submitted this exam' : 'Save the assessment first'} onClick={exportExam}>⇩ Export Exam</button>
          </div>
        </div>
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }} />

        <div style={{ display: 'grid', gap: 12 }}>
          {qs.map((q, i) => (
            <div key={q.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <b style={{ fontSize: 12 }}>Q{i + 1}</b>
                <span className={`pill ${isWritten(q) ? 'progress' : 'neutral'}`}>{isWritten(q) ? 'Written' : 'MCQ'}</span>
                <input style={{ flex: 1 }} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} placeholder="Question" />
                <input type="number" min={1} style={{ width: 70 }} value={q.marks} onChange={(e) => setQ(i, { marks: Number(e.target.value) })} aria-label="Marks" title="Marks" />
                <button type="button" className="btn" onClick={() => setQs((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : [blank()]))} aria-label="Remove question">✕</button>
              </div>
              {isWritten(q) ? (
                <small className="subtle" style={{ display: 'block', marginTop: 8 }}>Written answer: the trainee types a response and staff give marks (up to {q.marks}) in the result review.</small>
              ) : (
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {q.options.map((o, k) => (
                  <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                    <input type="radio" name={`ans-${q.id}`} checked={q.answer === k} onChange={() => setQ(i, { answer: k })} title="Correct answer" />
                    <span style={{ width: 16, fontSize: 11 }}>{String.fromCharCode(65 + k)}</span>
                    <input style={{ flex: 1 }} value={o} onChange={(e) => setOpt(i, k, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + k)}`} />
                  </label>
                ))}
              </div>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="btn soft" style={{ marginTop: 10 }} onClick={() => setQs((p) => [...p, blank()])}>＋ Add multiple-choice question</button>{' '}
        <button type="button" className="btn soft" style={{ marginTop: 10 }} onClick={() => setQs((p) => [...p, blank('written')])}>＋ Add written question</button>
        <small className="subtle" style={{ display: 'block', marginTop: 6 }}>Pick the round button beside the correct option. Marks are in the small box on each question.</small>
        <FormActions onCancel={closeModal} save={ex ? 'Save changes' : 'Create assessment'} />
      </form>
    </>
  );
}

/** Marks a result is worth. Marks staff gave a question (a checked answer sheet, or marking a written answer) win; otherwise multiple choice is scored from the key. */
export const resultScore = (a: Assessment, answers: Record<string, number | string>, awarded: Record<string, number> = {}) =>
  a.questions.reduce((n, q) => {
    const given = awarded[q.id];
    if (given !== undefined) return n + (Number(given) || 0);
    return n + (!isWritten(q) && answers[q.id] === q.answer ? q.marks : 0);
  }, 0);

/** The trainee's answers next to the correct ones; written answers are marked here. */
export function ResultReview({ assignId }: { assignId: string }) {
  const { S, closeModal, update, toast } = usePortal();
  const r = S.assessmentAssigns.find((a) => a.id === assignId);
  const a = r && S.assessments.find((x) => x.id === r.assessmentId);
  const [marks, setMarks] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(r?.writtenMarks ?? {}).map(([k, v]) => [k, String(v)])));
  if (!r || !a) return <p>Not found.</p>;
  const who = examTakerById(S, r.traineeId)?.name ?? 'Trainee';
  const hasWritten = a.questions.some(isWritten);

  const saveMarks = () => {
    const given: Record<string, number> = {};
    for (const q of a.questions.filter(isWritten)) {
      const raw = (marks[q.id] ?? '').trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > q.marks) return toast(`Marks for a written answer must be between 0 and ${q.marks}`);
      given[q.id] = n;
    }
    update((st) => {
      const rec = st.assessmentAssigns.find((x) => x.id === r.id);
      if (!rec) return;
      rec.writtenMarks = given;
      rec.score = resultScore(a, rec.answers, given);
      rec.total = maxMarks(a);
    });
    toast('Marks saved');
  };

  return (
    <>
      <h2>{a.title}</h2>
      <p>{who} · scored <b>{r.score ?? 0}/{r.total ?? maxMarks(a)}</b> ({percent(r)}%)</p>
      {r.feedback && (
        <div className="card" style={{ padding: 12, marginBottom: 10 }}>
          <b style={{ fontSize: 12 }}>Feedback</b>
          <p style={{ margin: '6px 0 0', fontSize: 12, whiteSpace: 'pre-wrap' }}>{r.feedback}</p>
        </div>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {a.questions.map((q, i) => {
          const pick = r.answers[q.id];
          if (isWritten(q)) {
            const given = r.writtenMarks?.[q.id];
            return (
              <div key={q.id} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <b style={{ fontSize: 12 }}>Q{i + 1}. {q.text} <span className="pill progress">Written</span></b>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                    <input type="number" min={0} max={q.marks} step={1} style={{ width: 64 }} value={marks[q.id] ?? ''} placeholder="–" aria-label={`Marks for Q${i + 1}`} onChange={(e) => setMarks((m) => ({ ...m, [q.id]: e.target.value }))} /> / {q.marks}
                  </span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 12, whiteSpace: 'pre-wrap' }}>{typeof pick === 'string' && pick.trim() ? pick : <span className="subtle">Not answered</span>}</p>
                {given === undefined && <small className="subtle">Not marked yet</small>}
              </div>
            );
          }
          const got = r.writtenMarks?.[q.id] ?? (pick === q.answer ? q.marks : 0);
          return (
            <div key={q.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 12 }}>Q{i + 1}. {q.text}</b>
                <span className={`pill ${got > 0 ? 'active' : 'overdue'}`}>{got}/{q.marks}</span>
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
      <div className="modal-actions">
        {hasWritten && <button className="btn primary" onClick={saveMarks}>Save marks</button>}
        <button className="btn" onClick={closeModal}>Close</button>
      </div>
    </>
  );
}

/** Score and feedback for one person's result, opened from a row of the Assessment report. */
export function FeedbackForm({ assignId }: { assignId: string }) {
  const { S, update, closeModal, toast } = usePortal();
  const r = S.assessmentAssigns.find((x) => x.id === assignId);
  const a = r && S.assessments.find((x) => x.id === r.assessmentId);
  const p = r && examTakerById(S, r.traineeId);
  const [score, setScore] = useState(r?.status === 'submitted' && r.score != null ? String(r.score) : '');
  const [text, setText] = useState(r?.feedback ?? '');
  if (!r || !a) return <p>Not found.</p>;
  const max = maxMarks(a);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(score);
    if (score.trim() === '' || !Number.isFinite(n) || n < 0 || n > max) return toast(`Score must be between 0 and ${max}`);
    update((s) => {
      const rec = s.assessmentAssigns.find((x) => x.id === r.id);
      if (!rec) return;
      rec.score = Math.round(n);
      rec.total = max;
      rec.feedback = text.trim();
      if (rec.status !== 'submitted') {
        const at = new Date().toISOString();
        rec.status = 'submitted';
        rec.startedAt = rec.startedAt || at;
        rec.submittedAt = at;
      }
    });
    toast('Score and feedback saved');
    closeModal();
  };

  return (
    <>
      <h2>Feedback</h2>
      <p>{a.title} · {p?.name ?? 'Exam user'} · out of {max} marks. The score shows in the Assessment report and the feedback is shown to the person who took the exam.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label>Score (out of {max})</label>
            <input type="number" min={0} max={max} step={1} value={score} onChange={(e) => setScore(e.target.value)} required placeholder={`0 – ${max}`} />
          </div>
          <div className="field full">
            <label>Feedback</label>
            <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write feedback for the person who took the exam" />
          </div>
        </div>
        <FormActions onCancel={closeModal} save="Save feedback" />
      </form>
    </>
  );
}

const SHEET_COLUMNS = ['Assignment ID', 'Trainee', 'Q No', 'Type', 'Question', 'Marks', 'Answer Given', 'Correct Answer', 'Marks Awarded', 'Feedback'];

/** Downloads one person's answer sheet: every question with the answer given, ready to be checked offline and imported back. */
export function exportAnswerSheet(S: State, r: AssessmentAssign) {
  const a = S.assessments.find((x) => x.id === r.assessmentId);
  if (!a) return;
  const who = examTakerById(S, r.traineeId)?.name ?? 'Trainee';
  const opt = (q: Question, i: number | undefined) => (typeof i === 'number' && q.options[i] !== undefined ? `${String.fromCharCode(65 + i)}. ${q.options[i]}` : '');
  const rows = a.questions.map((q, i) => {
    const v = r.answers[q.id];
    const written = isWritten(q);
    const awarded = r.writtenMarks?.[q.id] ?? (written ? '' : v === q.answer ? q.marks : 0);
    return [r.id, who, i + 1, written ? 'Written' : 'MCQ', q.text, q.marks, written ? (typeof v === 'string' ? v : '') : opt(q, typeof v === 'number' ? v : undefined), written ? '' : opt(q, q.answer), awarded, i === 0 ? r.feedback ?? '' : ''];
  });
  downloadCSV([SHEET_COLUMNS, ...rows], `${slug(a.title) || 'exam'}-${slug(who) || 'answer'}-answer-sheet.csv`);
}

/**
 * Reads a checked answer sheet. The sheet alone decides the result: each row is matched by its Q No only, and the marks come from
 * the Marks Awarded column (out of the row's Marks). The assessment's question types, answer key and marks are not used.
 */
export function readAnswerSheet(S: State, r: AssessmentAssign, text: string): { error: string } | { written: Record<string, number>; feedback: string | undefined; score: number; total: number } {
  const a = S.assessments.find((x) => x.id === r.assessmentId);
  if (!a) return { error: 'Assessment not found' };
  const rows = parseCSV(text);
  if (!rows.length) return { error: 'No rows found in that file' };
  const awarded: Record<string, number> = {};
  const remarks: { no: number; text: string }[] = [];
  let score = 0;
  let total = 0;
  let allOut = true;
  for (const row of rows) {
    const aid = (field(row, 'Assignment ID') ?? '').trim();
    if (aid && aid !== r.id) return { error: 'This sheet belongs to a different exam result' };
    const no = Number((field(row, 'Q No', 'No') ?? '').replace(/\D/g, ''));
    if (!no) continue;
    const q = a.questions[no - 1];
    if (!q) return { error: `Q${no} does not exist in this assessment` };
    const fb = (field(row, 'Feedback') ?? '').trim();
    if (fb) remarks.push({ no, text: fb });
    const raw = (field(row, 'Marks Awarded', 'Marks Given') ?? '').trim();
    const got = raw === '' ? 0 : Number(raw);
    const outOfRaw = (field(row, 'Marks') ?? '').trim();
    const outOf = outOfRaw === '' ? NaN : Number(outOfRaw);
    if (!Number.isFinite(got) || got < 0) return { error: `Q${no}: marks awarded must be a number, 0 or more` };
    if (Number.isFinite(outOf) && got > outOf) return { error: `Q${no}: marks awarded (${got}) is more than the marks for the question (${outOf})` };
    if (Number.isFinite(outOf)) total += outOf;
    else allOut = false;
    awarded[q.id] = got;
    score += got;
  }
  if (!Object.keys(awarded).length) return { error: 'No questions found. Use the sheet exported from this result' };
  // questions missing from the sheet count as 0, so the sheet is the whole result
  for (const q of a.questions) if (awarded[q.id] === undefined) awarded[q.id] = 0;
  // one remark is the overall feedback; remarks on several questions are kept as one line per question
  const feedback = !remarks.length ? undefined : remarks.length === 1 ? remarks[0].text : remarks.map((x) => `Q${x.no}: ${x.text}`).join('\n');
  return { written: awarded, feedback, score, total: allOut && total > 0 ? total : r.total ?? maxMarks(a) };
}
