'use client';
import { useMemo, useState } from 'react';
import { usePortal } from '@/lib/store';
import { courseById, isAssigned, learners, traineeById } from '@/lib/selectors';
import { Avatar, Empty, Guard, PageHead, Pill, SectionTitle } from '@/components/ui';
import { AssessmentForm, ResultReview, durationLabel, maxMarks, percent } from '@/components/assessments';
import { fmtDate, today, uid } from '@/lib/util';

type Tab = 'list' | 'assign' | 'report';

const STATUS: Record<string, { label: string; kind: string }> = {
  assigned: { label: 'Not started', kind: 'neutral' },
  'in-progress': { label: 'In progress', kind: 'progress' },
  submitted: { label: 'Submitted', kind: 'active' },
};

/** Build assessments for a course, give them to trainees, and read the results. */
export default function AssessmentsPage() {
  const { S, openModal, update, toast, confirm } = usePortal();
  const [tab, setTab] = useState<Tab>('list');
  const [pick, setPick] = useState('');

  const sent = S.assessmentAssigns.filter((r) => traineeById(S, r.traineeId));

  return (
    <Guard kinds={['admin']}>
      <PageHead
        title="Assessments"
        desc="Create a quiz for a course, assign it to trainees, then read their results."
        actions={<button className="btn primary" onClick={() => openModal(<AssessmentForm />, true)}>＋ Create assessment</button>}
      />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'list'} className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>
          Assessments<span className="count">{S.assessments.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'assign'} className={tab === 'assign' ? 'on' : ''} onClick={() => setTab('assign')}>
          Assign assessment
        </button>
        <button role="tab" aria-selected={tab === 'report'} className={tab === 'report' ? 'on' : ''} onClick={() => setTab('report')}>
          Assessment report<span className="count">{sent.length}</span>
        </button>
      </div>

      {tab === 'list' && (
        <section className="card table-card">
          {!S.assessments.length ? (
            <Empty>No assessments yet. Use “Create assessment” to build a quiz for a course.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Assessment</th><th>Course</th><th>Questions</th><th>Max marks</th><th>Time</th><th>Assigned</th><th /></tr>
                </thead>
                <tbody>
                  {S.assessments.map((a) => (
                    <tr key={a.id}>
                      <td><b>{a.title}</b></td>
                      <td>{courseById(S, a.courseId)?.name ?? '—'}</td>
                      <td>{a.questions.length}</td>
                      <td><b>{maxMarks(a)}</b></td>
                      <td>{durationLabel(a.durationMin)}</td>
                      <td>{S.assessmentAssigns.filter((r) => r.assessmentId === a.id).length}</td>
                      <td>
                        <div className="actions" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn soft" onClick={() => { setTab('assign'); setPick(a.id); }}>Assign</button>
                          <button className="btn" onClick={() => openModal(<AssessmentForm id={a.id} />, true)}>Edit</button>
                          <button
                            className="btn"
                            onClick={() =>
                              confirm(`Delete “${a.title}”? Its assignments and results are deleted too.`, () => {
                                update((s) => {
                                  s.assessments = s.assessments.filter((x) => x.id !== a.id);
                                  s.assessmentAssigns = s.assessmentAssigns.filter((x) => x.assessmentId !== a.id);
                                });
                                toast('Assessment deleted');
                              }, 'Delete')
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'assign' && <AssignTab initial={pick} />}
      {tab === 'report' && <ReportTab />}
    </Guard>
  );
}

function AssignTab({ initial }: { initial: string }) {
  const { S, update, toast } = usePortal();
  const [aid, setAid] = useState(initial);
  const [chosen, setChosen] = useState<string[]>([]);
  const [due, setDue] = useState('');
  const a = S.assessments.find((x) => x.id === aid);

  // only trainees who have been given the assessment's course, and not this assessment already
  const eligible = useMemo(
    () =>
      a
        ? learners(S)
            .filter((t) => isAssigned(S, t.id, a.courseId) && !S.assessmentAssigns.some((r) => r.assessmentId === a.id && r.traineeId === t.id))
            .sort((x, y) => x.name.localeCompare(y.name))
        : [],
    [S, a]
  );
  const toggle = (id: string) => setChosen((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const go = () => {
    if (!a) return;
    if (!chosen.length) return toast('Pick at least one trainee');
    if (due && due < today()) return toast('Due date cannot be in the past');
    update((s) => {
      for (const t of chosen)
        s.assessmentAssigns.push({ id: uid('aa-'), assessmentId: a.id, traineeId: t, assignedOn: today(), due, status: 'assigned', startedAt: '', submittedAt: '', score: null, total: null, answers: {} });
    });
    toast(`Assessment assigned to ${chosen.length} ${chosen.length === 1 ? 'trainee' : 'trainees'}`);
    setChosen([]);
  };

  return (
    <section className="card section-card">
      <SectionTitle title="Assign assessment" sub="Trainees see it under My Assessments and take it in the time allowed" />
      <div className="form-grid" style={{ maxWidth: 640 }}>
        <div className="field full">
          <label>Assessment</label>
          <select value={aid} onChange={(e) => { setAid(e.target.value); setChosen([]); }}>
            <option value="">Select assessment…</option>
            {S.assessments.map((x) => <option key={x.id} value={x.id}>{x.title} — {courseById(S, x.courseId)?.name} ({maxMarks(x)} marks, {durationLabel(x.durationMin)})</option>)}
          </select>
        </div>
        {a && (
          <>
            <div className="field full">
              <label>Trainees on {courseById(S, a.courseId)?.name}</label>
              {eligible.length ? (
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, maxHeight: 260, overflow: 'auto', padding: 6 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 6, fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
                    <input type="checkbox" checked={chosen.length === eligible.length} onChange={(e) => setChosen(e.target.checked ? eligible.map((t) => t.id) : [])} /> Select all
                  </label>
                  {eligible.map((t) => (
                    <label key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 6, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                      <input type="checkbox" checked={chosen.includes(t.id)} onChange={() => toggle(t.id)} />
                      <Avatar name={t.name} tone={t.tone} /> {t.name}
                    </label>
                  ))}
                </div>
              ) : (
                <small className="subtle">Everyone assigned this course already has this assessment, or nobody has been given the course yet.</small>
              )}
            </div>
            <div className="field"><label>Due date</label><input type="date" min={today()} value={due} onChange={(e) => setDue(e.target.value)} /></div>
          </>
        )}
      </div>
      {a && (
        <div style={{ marginTop: 14 }}>
          <button className="btn primary" onClick={go} disabled={!chosen.length}>Assign to {chosen.length || ''} {chosen.length === 1 ? 'trainee' : 'trainees'}</button>
        </div>
      )}
    </section>
  );
}

function ReportTab() {
  const { S, openModal, update, confirm, toast } = usePortal();
  const [course, setCourse] = useState('');
  const [status, setStatus] = useState('');
  const rows = S.assessmentAssigns
    .map((r) => ({ r, a: S.assessments.find((x) => x.id === r.assessmentId), t: traineeById(S, r.traineeId) }))
    .filter((x) => x.a && x.t && (!course || x.a.courseId === course) && (!status || x.r.status === status))
    .sort((x, y) => (y.r.submittedAt || y.r.assignedOn).localeCompare(x.r.submittedAt || x.r.assignedOn));
  const done = rows.filter((x) => x.r.status === 'submitted');
  const avg = done.length ? Math.round(done.reduce((n, x) => n + percent(x.r), 0) / done.length) : 0;

  return (
    <section className="card table-card">
      <div className="toolbar" style={{ margin: '10px 0', flexWrap: 'wrap' }}>
        <select className="select" value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Course">
          <option value="">All courses</option>
          {S.courses.filter((c) => S.assessments.some((a) => a.courseId === c.id)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value="assigned">Not started</option>
          <option value="in-progress">In progress</option>
          <option value="submitted">Submitted</option>
        </select>
        <span className="pill neutral">{rows.length} assigned</span>
        <span className="pill active">{done.length} submitted</span>
        {!!done.length && <span className="pill progress">Average {avg}%</span>}
      </div>
      {!rows.length ? (
        <Empty>No assessments have been assigned yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Trainee</th><th>Course</th><th>Assessment</th><th>Status</th><th>Result</th><th>Submitted</th><th /></tr>
            </thead>
            <tbody>
              {rows.map(({ r, a, t }) => (
                <tr key={r.id}>
                  <td><div className="person"><Avatar name={t!.name} tone={t!.tone} /><div>{t!.name}</div></div></td>
                  <td>{courseById(S, a!.courseId)?.name}</td>
                  <td>{a!.title}<br /><small className="subtle">Due {fmtDate(r.due)}</small></td>
                  <td><Pill kind={STATUS[r.status].kind}>{STATUS[r.status].label}</Pill></td>
                  <td>{r.status === 'submitted' ? <><b>{r.score}/{r.total}</b> <span className={`pill ${percent(r) >= 50 ? 'active' : 'overdue'}`}>{percent(r)}%</span></> : <span className="subtle">Max {maxMarks(a!)}</span>}</td>
                  <td>{r.submittedAt ? fmtDate(r.submittedAt.slice(0, 10)) : '—'}</td>
                  <td>
                    <div className="actions" style={{ justifyContent: 'flex-end' }}>
                      {r.status === 'submitted' && <button className="btn soft" onClick={() => openModal(<ResultReview assignId={r.id} />, true)}>Review</button>}
                      <button
                        className="btn"
                        onClick={() =>
                          confirm(`Remove this assessment from ${t!.name}? Any result is deleted so it can be assigned again.`, () => {
                            update((s) => (s.assessmentAssigns = s.assessmentAssigns.filter((x) => x.id !== r.id)));
                            toast('Assignment removed');
                          }, 'Remove')
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
