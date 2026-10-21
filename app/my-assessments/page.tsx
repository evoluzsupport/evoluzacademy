'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePortal } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { courseById } from '@/lib/selectors';
import { Empty, Guard, PageHead, Pill } from '@/components/ui';
import { durationLabel, maxMarks, percent } from '@/components/assessments';
import { fmtDate } from '@/lib/util';
import type { Assessment, AssessmentAssign } from '@/lib/types';

const draftKey = (id: string) => `evoluzAssessment:${id}`;
const clock = (sec: number) => {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** The trainee's own assessments: start one, answer it against the clock, and see the result. */
export default function MyAssessmentsPage() {
  const { S, me, toast, refresh } = usePortal();
  const [taking, setTaking] = useState('');
  const [busy, setBusy] = useState(false);

  const mine = S.assessmentAssigns
    .filter((r) => r.traineeId === me?.id)
    .map((r) => ({ r, a: S.assessments.find((x) => x.id === r.assessmentId) }))
    .filter((x): x is { r: AssessmentAssign; a: Assessment } => !!x.a);

  const start = async (r: AssessmentAssign) => {
    setBusy(true);
    const { error } = await supabase.rpc('start_assessment', { p_id: r.id });
    if (error) toast(error.message);
    else {
      await refresh();
      setTaking(r.id);
    }
    setBusy(false);
  };

  const live = mine.find((x) => x.r.id === taking);
  return (
    <Guard kinds={['trainee', 'trainer', 'admin']}>
      <PageHead title="My Assessments" desc="Quizzes for your courses. Each has a time limit that starts when you press Start." />
      {live && live.r.status !== 'submitted' ? (
        <Exam r={live.r} a={live.a} onDone={() => setTaking('')} />
      ) : !mine.length ? (
        <Empty>No assessments have been assigned to you yet.</Empty>
      ) : (
        <div className="grid" style={{ gap: 14 }}>
          {mine.map(({ r, a }) => (
            <section key={r.id} className="card section-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{a.title}</h3>
                  <small className="subtle">{courseById(S, a.courseId)?.name} · {a.questions.length} questions · {maxMarks(a)} marks · {durationLabel(a.durationMin)}{r.due ? ` · due ${fmtDate(r.due)}` : ''}</small>
                  {a.description && <p style={{ margin: '8px 0 0' }}>{a.description}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  {r.status === 'submitted' ? (
                    <>
                      <div style={{ fontSize: 24, fontWeight: 800 }}>{r.score}/{r.total}</div>
                      <span className={`pill ${percent(r) >= 50 ? 'active' : 'overdue'}`}>{percent(r)}%</span>
                      <div><small className="subtle">Submitted {fmtDate(r.submittedAt.slice(0, 10))}</small></div>
                    </>
                  ) : (
                    <>
                      <Pill kind={r.status === 'in-progress' ? 'progress' : 'neutral'}>{r.status === 'in-progress' ? 'In progress' : 'Not started'}</Pill>{' '}
                      <button className="btn primary" disabled={busy} onClick={() => (r.status === 'in-progress' ? setTaking(r.id) : void start(r))}>
                        {r.status === 'in-progress' ? 'Resume' : 'Start'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </Guard>
  );
}

function Exam({ r, a, onDone }: { r: AssessmentAssign; a: Assessment; onDone: () => void }) {
  const { toast, refresh, confirm } = usePortal();
  const end = new Date(r.startedAt).getTime() + a.durationMin * 60000;
  const [left, setLeft] = useState(() => Math.round((end - Date.now()) / 1000));
  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey(r.id)) || '{}');
    } catch {
      return {};
    }
  });
  const [sending, setSending] = useState(false);
  const sent = useRef(false);

  const pick = (q: string, i: number) =>
    setAnswers((p) => {
      const n = { ...p, [q]: i };
      try {
        localStorage.setItem(draftKey(r.id), JSON.stringify(n));
      } catch {}
      return n;
    });

  const submit = useCallback(async () => {
    if (sent.current) return;
    sent.current = true;
    setSending(true);
    const { error } = await supabase.rpc('submit_assessment', { p_id: r.id, p_answers: answers });
    if (error) {
      sent.current = false;
      setSending(false);
      return toast(error.message);
    }
    try {
      localStorage.removeItem(draftKey(r.id));
    } catch {}
    await refresh();
    toast('Assessment submitted');
    onDone();
  }, [answers, r.id, refresh, toast, onDone]);

  useEffect(() => {
    const t = setInterval(() => setLeft(Math.round((end - Date.now()) / 1000)), 1000);
    return () => clearInterval(t);
  }, [end]);
  useEffect(() => {
    if (left <= 0) void submit();
  }, [left, submit]);

  const answered = a.questions.filter((q) => answers[q.id] !== undefined).length;
  return (
    <>
      <div className="card section-card" style={{ position: 'sticky', top: 0, zIndex: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <b>{a.title}</b>
          <div><small className="subtle">{answered}/{a.questions.length} answered · {maxMarks(a)} marks</small></div>
        </div>
        <span className={`pill ${left < 300 ? 'overdue' : 'progress'}`} style={{ fontSize: 16, padding: '6px 14px' }} aria-live="off">⏱ {clock(left)}</span>
      </div>
      <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
        {a.questions.map((q, i) => (
          <section key={q.id} className="card section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <b>Q{i + 1}. {q.text}</b>
              <span className="pill neutral">{q.marks} {q.marks === 1 ? 'mark' : 'marks'}</span>
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
              {q.options.map((o, k) => (
                <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'center', textTransform: 'none', letterSpacing: 0, fontWeight: 500, fontSize: 13, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8, background: answers[q.id] === k ? '#eef3fe' : undefined }}>
                  <input type="radio" name={q.id} checked={answers[q.id] === k} onChange={() => pick(q.id, k)} /> {o}
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div style={{ margin: '16px 0' }}>
        <button
          className="btn primary"
          disabled={sending}
          onClick={() =>
            answered < a.questions.length
              ? confirm(`${a.questions.length - answered} question(s) are not answered. Submit anyway?`, () => void submit(), 'Submit')
              : void submit()
          }
        >
          {sending ? 'Submitting…' : 'Submit assessment'}
        </button>
      </div>
    </>
  );
}
