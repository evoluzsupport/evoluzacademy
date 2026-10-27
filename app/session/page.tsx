'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePortal } from '@/lib/store';
import { isAssigned, orderedTopics, scopeTrainees, statCourse, topicKey, visibleCourses } from '@/lib/selectors';
import { firstTrainer, primaryOf } from '@/lib/seed';
import { fmtDate, today, validPastOrToday } from '@/lib/util';
import { Avatar, Guard, PageHead, Pill, SectionTitle } from '@/components/ui';
import { TopicDetails } from '@/components/topic';

export default function SessionPage() {
  const { S, me, saveSession, toast } = usePortal();
  const router = useRouter();
  const [courseId, setCourseId] = useState('');
  const [trainer, setTrainer] = useState('');
  const [date, setDate] = useState(today());
  const [traineeIds, setTraineeIds] = useState<string[]>([]);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [attendeeQ, setAttendeeQ] = useState('');
  const [topicQ, setTopicQ] = useState('');
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
    setUpdateExisting(false);
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
  // topics every selected attendee has already done on this course (logged by any trainer or admin) show ticked and locked
  const doneBy = (tid: string, topicId: string) => S.progress[topicKey(tid, c.id, topicId)];
  const lockedTopic = (topicId: string) => !updateExisting && selected.size > 0 && [...selected].every((tid) => doneBy(tid, topicId)?.done);
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
    const toSave = topicIds.filter((id) => !lockedTopic(id));
    if (!attendees.length || !toSave.length) return toast('Choose a course, at least one attendee, and a topic');
    if (!validPastOrToday(date)) return toast('Choose today or an earlier session date');
    const msg = saveSession({ courseId: c.id, trainer: trainer || firstTrainer(c), date, traineeIds: attendees, topicIds: toSave, updateExisting, by: me ? { name: me.name, admin: me.kind === 'admin' } : undefined });
    if (msg) {
      toast(msg);
      router.push('/sessions');
    }
  };

  return (
    <Guard kinds={['admin', 'trainer']}>
      <PageHead
        title="Log a training session"
        desc="Choose the attendees, check the topics covered, then save once for the group."
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
            sub="Every checked topic will be marked for all selected trainees above."
            right={<button className="btn soft" onClick={() => setTopicIds(c.topics.map((t) => t.id))}>Select all topics</button>}
          />
          <input className="input" style={{ width: '100%', marginBottom: 10 }} type="search" placeholder="Search topics…" aria-label="Search topics" value={topicQ} onChange={(e) => setTopicQ(e.target.value)} />
          <div className="choice-list topic-choices">
            {!shownTopics.length && <div className="empty">No topics match “{topicQ}”.</div>}
            {shownTopics.map((x) => {
              const locked = lockedTopic(x.id);
              const doneN = [...selected].filter((tid) => doneBy(tid, x.id)?.done).length;
              const last = [...selected].map((tid) => doneBy(tid, x.id)).find((r) => r?.done);
              return (
              <label className="choice topic-choice" key={x.id}>
                <input type="checkbox" checked={locked || chosen.has(x.id)} disabled={locked} onChange={(e) => setTopicIds((l) => toggle(l, x.id, e.target.checked))} />
                <span>
                  <b>{x.topic}</b>
                  <small>{x.day}{x.category ? ` · ${x.category}` : ''}</small>
                  {doneN > 0 && (
                    <small style={{ color: 'var(--ok, #1a8f5a)' }}>
                      {locked ? 'Already covered' : `Covered for ${doneN} of ${selected.size} selected`}
                      {last?.trainer ? ` by ${last.trainer}` : ''}{last?.date ? ` on ${fmtDate(last.date)}` : ''}
                    </small>
                  )}
                  <TopicDetails cover={x.cover} activity={x.activity} />
                </span>
              </label>
              );
            })}
          </div>
          <label className="choice" style={{ marginTop: 13 }}>
            <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
            <span><span><b>Update already completed topics</b><small>Off by default. Topics another trainer completed are never changed unless you are an admin.</small></span></span>
          </label>
          <div className="session-summary">
            <div><b>{selected.size}</b><span>attendees</span></div>
            <div><b>{chosen.size}</b><span>topics</span></div>
            <div><b>{marks}</b><span>new marks</span></div>
            <div><b>{already}</b><span>already done</span></div>
          </div>
        </section>
      </div>
    </Guard>
  );
}
