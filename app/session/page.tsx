'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePortal } from '@/lib/store';
import { isAssigned, orderedTopics, scopeTrainees, statCourse, topicKey, visibleCourses } from '@/lib/selectors';
import { firstTrainer, primaryOf } from '@/lib/seed';
import { fmtDate, today, validPastOrToday } from '@/lib/util';
import { Avatar, Guard, PageHead, Pill, SectionTitle } from '@/components/ui';
import { TopicDetails, TopicSessionLog, coverPoints } from '@/components/topic';

export default function SessionPage() {
  const { S, me, saveSession, toast } = usePortal();
  const router = useRouter();
  const [courseId, setCourseId] = useState('');
  const [trainer, setTrainer] = useState('');
  const [date, setDate] = useState(today());
  const [traineeIds, setTraineeIds] = useState<string[]>([]);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [attendeeQ, setAttendeeQ] = useState('');
  const [topicQ, setTopicQ] = useState('');
  // subtopics ticked in this session, `${topicId}:${pointIndex}` -> trainer who delivered it ('' = the session trainer)
  const [points, setPoints] = useState<Record<string, string>>({});
  const picker = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (menuOpen && picker.current && !picker.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('click', click);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('click', click);
      document.removeEventListener('keydown', key);
    };
  }, [menuOpen]);

  // whoever is logging the session (trainer or admin) is the default deliverer; they can still pick someone else
  const myName = me && me.kind !== 'trainee' ? me.name : undefined;
  const myCourses = visibleCourses(S, me);
  const c = myCourses.find((x) => x.id === courseId);
  const scope = new Set(scopeTrainees(S, me).map((t) => t.id));
  // everyone in the directory: roles change, so anyone can deliver or attend
  const everyone = [
    ...S.admins.map((p) => ({ id: p.id, name: p.name, tone: '', label: 'Admin' })),
    ...S.trainers.map((p) => ({ id: p.id, name: p.name, tone: p.tone, label: p.specialty ? `Trainer · ${p.specialty}` : 'Trainer' })),
    ...S.trainees.map((p) => ({ id: p.id, name: p.name, tone: p.tone, label: p.jobRole ? `Trainee · ${p.jobRole}` : 'Trainee' })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const deliverers = [...new Set(everyone.map((p) => p.name))];

  const startCourse = (id: string) => {
    const cc = myCourses.find((x) => x.id === id);
    setCourseId(id);
    setTrainer(cc ? (myName ?? firstTrainer(cc)) : '');
    setDate(today());
    setMenuOpen(false);
    setAttendeeQ('');
    setTopicQ('');
    setTopicIds([]);
    setPoints({});
    setDuration('');
    setNotes('');
    setTraineeIds([]);
  };

  const head = (
    <PageHead
      title="Log a training session"
      desc={c ? 'Choose the attendees, check the topics covered, then save once for the group.' : 'Choose a course first. Its assigned trainees and topics will appear next.'}
    />
  );

  if (!c) {
    return (
      <Guard kinds={['admin', 'trainer']}>
        {head}
        <section className="card detail-panel" style={{ maxWidth: 760 }}>
          <div className="field">
            <label htmlFor="s-course">Course</label>
            <select id="s-course" className="select" style={{ width: '100%' }} value="" onChange={(e) => startCourse(e.target.value)}>
              <option value="">Choose a course…</option>
              {myCourses.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </div>
        </section>
      </Guard>
    );
  }

  const eligible = everyone;
  const selected = new Set(traineeIds);
  const chosen = new Set(topicIds);
  // a topic can be logged in any number of sessions: nothing is locked, earlier sessions stay as they are
  const doneBy = (tid: string, topicId: string) => S.progress[topicKey(tid, c.id, topicId)];
  const sessionTrainer = trainer || firstTrainer(c);
  /** trainers who have already delivered a subtopic to anyone on this course, from earlier sessions */
  const deliveredBefore = (topicId: string, i: number) => [...new Set(Object.entries(S.points).filter(([k]) => k.split('|')[1] === c.id && k.split('|')[2] === topicId && Number(k.split('|')[3]) === i).map(([, r]) => r.trainer))];
  /** every subtopic ticked in this session, each with the trainer who delivered it */
  const newPoints = () =>
    Object.entries(points).map(([k, tr]) => {
      const [topicId, idx] = k.split(':');
      return { topicId, index: Number(idx), trainer: tr || sessionTrainer };
    });
  const todayLog = (tid: string) => S.sessions.filter((x) => x.date === today() && x.courseId === c.id && x.traineeIds.includes(tid));
  const names = eligible.filter((t) => selected.has(t.id)).map((t) => t.name);
  const aq = attendeeQ.trim().toLowerCase();
  const shownPeople = aq ? eligible.filter((t) => `${t.name} ${t.label}`.toLowerCase().includes(aq)) : eligible;
  const tq = topicQ.trim().toLowerCase();
  const shownTopics = orderedTopics(c).filter((x) => !tq || `${x.topic} ${x.day} ${x.category ?? ''}`.toLowerCase().includes(tq));
  let marks = 0;
  let already = 0;
  chosen.forEach((topicId) =>
    selected.forEach((tid) => (S.progress[topicKey(tid, c.id, topicId)]?.done ? already++ : marks++))
  );

  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...new Set([...list, v])] : list.filter((x) => x !== v));

  const save = () => {
    const attendees = traineeIds;
    const pointList = newPoints();
    if (!attendees.length) return toast('Choose at least one attendee');
    if (!topicIds.length && !pointList.length) return toast('Tick at least one subtopic, or press “Mark Topic Covered” on a topic');
    const mins = duration.trim() === '' ? undefined : Number(duration);
    if (mins !== undefined && (!Number.isInteger(mins) || mins < 1 || mins > 1440)) return toast('Duration must be a whole number of minutes, between 1 and 1440');
    // a topic marked covered is credited to every trainer who delivered one of its ticked subtopics
    const topicTrainer: Record<string, string> = {};
    for (const id of topicIds) {
      const names = [...new Set(pointList.filter((p) => p.topicId === id).map((p) => p.trainer))];
      if (names.length) topicTrainer[id] = names.join(' / ');
    }
    if (!validPastOrToday(date)) return toast('Choose today or an earlier session date');
    const msg = saveSession({ courseId: c.id, trainer: sessionTrainer, date, traineeIds: attendees, topicIds, topicTrainer, points: pointList, durationMin: mins, notes, updateExisting: false, by: me ? { name: me.name, admin: me.kind === 'admin' } : undefined });
    if (msg) {
      toast(msg);
      router.push('/sessions');
    }
  };

  return (
    <Guard kinds={['admin', 'trainer']}>
      <PageHead
        title="Log a training session"
        desc="Choose the attendees, tick the subtopics covered (each can have its own trainer) or mark a whole topic covered, then save once for the group."
        actions={<button className="btn primary" onClick={save}>✓ Save session</button>}
      />
      <div className="grid" style={{ gap: 15 }}>
        <section className="card detail-panel">
          <SectionTitle title="1 · Session details" right={<Pill kind="progress">Trainer · {primaryOf(c)}</Pill>} />
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="s-c2">Course</label>
              <select id="s-c2" className="select" style={{ width: '100%' }} value={c.id} onChange={(e) => startCourse(e.target.value)}>
                {myCourses.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="s-tr">Trainer who delivered this session</label>
              <select id="s-tr" className="select" style={{ width: '100%' }} value={trainer || firstTrainer(c)} onChange={(e) => setTrainer(e.target.value)}>
                {(deliverers.includes(trainer || firstTrainer(c)) ? deliverers : [trainer || firstTrainer(c), ...deliverers]).map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="s-dt">Session date</label>
              <input id="s-dt" className="input" style={{ width: '100%' }} type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="s-du">Duration (minutes)</label>
              <input id="s-du" className="input" style={{ width: '100%' }} type="number" min={1} max={1440} step={1} placeholder="e.g. 30" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="field full">
              <label htmlFor="s-nt">Training notes</label>
              <textarea id="s-nt" style={{ width: '100%' }} rows={3} placeholder="What was taught in this session, what is left for the next one" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="card detail-panel">
          <SectionTitle title="2 · Who is attending?" sub="Tick everyone who attended. Anyone in the directory can be added. Anyone not yet on this course is assigned when you save." />
          <div className="attendee-picker" ref={picker}>
            <button type="button" className="attendee-trigger" aria-expanded={menuOpen} aria-controls="attendeeMenu" onClick={() => setMenuOpen((o) => !o)}>
              <span className="attendee-trigger-copy">
                <b>{selected.size} of {eligible.length} selected</b>
                <small>{names.join(', ') || (eligible.length ? 'Choose attendees' : 'No users yet')}</small>
              </span>
              <span className="attendee-chevron">⌄</span>
            </button>
            {menuOpen && (
              <div className="attendee-menu" id="attendeeMenu">
                <div className="attendee-menu-actions">
                  <b>{selected.size} of {eligible.length} selected</b>
                  <span>
                    <button type="button" className="btn soft" onClick={() => setTraineeIds(eligible.map((t) => t.id))}>Select all</button>
                    <button type="button" className="btn" onClick={() => setTraineeIds([])}>Clear</button>
                  </span>
                </div>
                <div style={{ padding: '8px 12px' }}>
                  <input className="input" style={{ width: '100%' }} type="search" placeholder="Search by name or role…" aria-label="Search attendees" value={attendeeQ} onChange={(e) => setAttendeeQ(e.target.value)} />
                </div>
                <div className="attendee-option-list">
                  {shownPeople.map((t) => (
                    <label className="attendee-option" key={t.id}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={(e) => setTraineeIds((l) => toggle(l, t.id, e.target.checked))} />
                      <span className="attendee-identity">
                        <Avatar name={t.name} tone={t.tone} />
                        <span><b>{t.name}</b><small>{t.label}</small></span>
                      </span>
                      <em>
                        {isAssigned(S, t.id, c.id) ? `${statCourse(S, t.id, c).done}/${c.topics.length} done` : 'Not assigned'}
                        {todayLog(t.id).length > 0 && ` · Logged today (${new Set(todayLog(t.id).flatMap((x) => x.topicIds)).size} topics)`}
                      </em>
                    </label>
                  ))}
                  {!eligible.length && <div className="empty">No users have been added yet.</div>}
                  {!!eligible.length && !shownPeople.length && <div className="empty">No one matches “{attendeeQ}”.</div>}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="card detail-panel">
          <SectionTitle
            title="3 · Topics covered"
            sub="Tick the subtopics covered in this session, each with its own trainer, or mark the whole topic covered. A topic can be logged again in later sessions."
            right={
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={() => { setTopicIds([]); setPoints({}); }}>Clear</button>
                <button className="btn soft" onClick={() => setTopicIds(c.topics.map((t) => t.id))}>Select all topics</button>
              </span>
            }
          />
          <input className="input" style={{ width: '100%', marginBottom: 10 }} type="search" placeholder="Search topics…" aria-label="Search topics" value={topicQ} onChange={(e) => setTopicQ(e.target.value)} />
          <div className="choice-list topic-choices">
            {!shownTopics.length && <div className="empty">No topics match “{topicQ}”.</div>}
            {shownTopics.map((x) => {
              const doneN = [...selected].filter((tid) => doneBy(tid, x.id)?.done).length;
              const doneAll = selected.size > 0 && doneN === selected.size;
              const last = [...selected].map((tid) => doneBy(tid, x.id)).find((r) => r?.done);
              const covered = chosen.has(x.id);
              const ticked = newPoints().filter((p) => p.topicId === x.id);
              const sessions = S.sessions.filter((q) => q.courseId === c.id && q.topicIds.includes(x.id)).length;
              return (
              <div className={`choice topic-choice${covered ? ' is-covered' : ''}`} key={x.id} aria-disabled={covered}>
                <span>
                  <b>{x.topic}</b>
                  <small>{x.day}{x.category ? ` · ${x.category}` : ''}</small>
                  {(doneN > 0 || sessions > 0) && (
                    <small style={{ color: 'var(--ok, #1a8f5a)' }}>
                      {doneN > 0 && `Completed for ${doneN} of ${selected.size} selected${last?.trainer ? ` by ${last.trainer}` : ''}${last?.date ? ` on ${fmtDate(last.date)}` : ''}`}
                      {doneN > 0 && sessions > 0 && ' · '}
                      {sessions > 0 && `${sessions} ${sessions === 1 ? 'session' : 'sessions'} logged`}
                    </small>
                  )}
                  <TopicDetails
                    cover={x.cover}
                    activity={x.activity}
                    disabled={covered}
                    checked={new Set(ticked.map((p) => p.index))}
                    onCheck={(i, on) => setPoints((p) => {
                      const n = { ...p };
                      if (on) n[`${x.id}:${i}`] = n[`${x.id}:${i}`] ?? '';
                      else delete n[`${x.id}:${i}`];
                      return n;
                    })}
                    extra={(i) => {
                      if (covered) return null;
                      const key = `${x.id}:${i}`;
                      if (points[key] === undefined) {
                        const before = deliveredBefore(x.id, i);
                        return before.length ? <small className="subtle" style={{ marginLeft: 24 }}>covered before by {before.join(', ')}</small> : null;
                      }
                      return (
                        <select
                          className="select"
                          style={{ padding: '3px 6px', fontSize: 10, marginLeft: 24, marginTop: 4, maxWidth: 220 }}
                          aria-label="Trainer who delivered this subtopic"
                          value={points[key] || sessionTrainer}
                          onChange={(e) => setPoints((p) => ({ ...p, [key]: e.target.value }))}
                        >
                          {(deliverers.includes(points[key] || sessionTrainer) ? deliverers : [points[key] || sessionTrainer, ...deliverers]).map((n) => <option key={n}>{n}</option>)}
                        </select>
                      );
                    }}
                  />
                  <TopicSessionLog courseId={c.id} topicId={x.id} cover={x.cover} />
                </span>
                <div className="covered-wrap">
                  <button type="button" className="btn soft covered-btn" disabled={covered} onClick={() => setTopicIds((l) => toggle(l, x.id, true))}>
                    {covered ? (doneAll ? '✓ Session Logged' : '✓ Topic Covered') : doneAll ? 'Log Another Session' : 'Mark Topic Covered'}
                  </button>
                  {covered && (
                    <span className="covered-by">by {[...new Set(ticked.map((p) => p.trainer))].join(' / ') || sessionTrainer}</span>
                  )}
                </div>
              </div>
              );
            })}
          </div>
          <div className="session-summary">
            <div><b>{selected.size}</b><span>attendees</span></div>
            <div><b>{chosen.size}</b><span>topics</span></div>
            <div><b>{newPoints().length}</b><span>subtopics</span></div>
            <div><b>{marks}</b><span>topics completed</span></div>
            <div><b>{already}</b><span>already completed</span></div>
          </div>
        </section>
      </div>
    </Guard>
  );
}
