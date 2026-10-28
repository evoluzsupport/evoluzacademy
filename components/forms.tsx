'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePortal } from '@/lib/store';
import { courseTrainers, joinTrainers, renameTrainer } from '@/lib/seed';
import { isAssigned, learners, nameMatches, plannedDays, topicTrainer, trainerNames } from '@/lib/selectors';
import type { Course, State, Topic, Trainee, Trainer } from '@/lib/types';
import { dayNumber, daySort, today, uid } from '@/lib/util';
import { FormActions } from './ui';
import { assignmentEmails } from './EmailDialog';
import { AvailabilityBox } from './AvailabilityBox';
import { sendAll } from '@/lib/mailer';
import { EMAIL_ENABLED, welcomeEmail } from '@/lib/emails';

const emailTaken = (S: State, email: string, id?: string) =>
  !!email &&
  [...S.admins, ...S.trainers, ...S.trainees, ...S.users].some((x) => x.email && x.email.toLowerCase() === email.toLowerCase() && x.id !== id);

const Field = ({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) => (
  <div className={`field ${full ? 'full' : ''}`}>
    <label>{label}</label>
    {children}
  </div>
);

export function TraineeForm({ id }: { id?: string }) {
  const { S, update, closeModal, openModal, setRole, toast } = usePortal();
  const ex = id ? S.trainees.find((t) => t.id === id) : undefined;
  const [f, setF] = useState<Omit<Trainee, 'id' | 'tone'>>(
    ex ?? { name: '', jobRole: '', email: '', trainer: '', joined: today(), status: 'Active', password: '' }
  );
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  // Adding: pick a person from the user directory. Email is filled in and read-only; access is Trainee.
  // Anyone already in the trainee list is left out, so no second entry is ever created. A directory
  // user becomes a trainee; a trainer or admin keeps their one record and becomes a learner when a
  // course is assigned to them.
  const [pick, setPick] = useState('');
  const inList = new Set(learners(S).map((p) => p.id));
  const people = [
    ...S.users.map((p) => ({ id: p.id, name: p.name, email: p.email, kind: 'user' as const })),
    ...S.trainers.map((p) => ({ id: p.id, name: p.name, email: p.email, kind: 'trainer' as const })),
    ...S.admins.map((p) => ({ id: p.id, name: p.name, email: p.email, kind: 'admin' as const })),
  ]
    .filter((p) => !inList.has(p.id))
    .sort((x, y) => x.name.localeCompare(y.name));
  const chosen = people.find((p) => p.id === pick);
  const choose = (pid: string) => {
    setPick(pid);
    const p = people.find((x) => x.id === pid);
    setF((prev) => ({ ...prev, name: p?.name ?? '', email: p?.email ?? '' }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!id) {
      if (!chosen) return toast('Pick a person from the list');
      if (chosen.kind === 'user') {
        // the directory entry becomes the trainee: same record, now enrolled
        if (setRole(chosen.id, 'trainee', f.jobRole)) {
          closeModal();
          if (EMAIL_ENABLED) void sendAll([welcomeEmail({ origin: window.location.origin, name: chosen.name, email: chosen.email, role: f.jobRole || 'Trainee' })], toast, 'Welcome');
        }
        return;
      }
      // a trainer or admin keeps their one record and joins the trainee list once a course is assigned
      openModal(<AssignDialog traineeId={chosen.id} />);
      return;
    }
    const name = f.name.trim();
    if (!name) return toast('Please add a trainee name');
    if (!f.email.trim()) return toast('Please add an email address');
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) return toast('Please enter a valid email address');
    if (emailTaken(S, f.email.trim(), id)) return toast('Email already in use');
    const data = { ...f, name, email: f.email.trim(), jobRole: f.jobRole.trim() || 'Trainee' };
    update((s) => {
      if (id) Object.assign(s.trainees.find((t) => t.id === id)!, data);
      else s.trainees.push({ id: uid('t'), tone: '', ...data });
    });
    closeModal();
    toast(id ? 'Trainee profile updated' : 'Trainee added');
  };
  return (
    <>
      <h2>{id ? 'Edit trainee' : 'Add trainee'}</h2>
      <p>{id ? 'Update profile details.' : 'Pick a person from the user list. Their email is filled in and they work as a trainee from now on. People already in the trainee list are not shown.'}</p>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          {id ? (
            <>
              <Field label="Full name"><input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Asha Verma" required /></Field>
              <Field label="Role"><input value={f.jobRole} onChange={(e) => set('jobRole', e.target.value)} placeholder="e.g. CRM Consultant" /></Field>
              <Field label="Email (login)"><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required /></Field>
            </>
          ) : (
            <>
              <Field label="Full name" full>
                <select value={pick} onChange={(e) => choose(e.target.value)} required>
                  <option value="">{people.length ? 'Select a person…' : 'Everyone is already in the trainee list'}</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.email || 'no email'}</option>
                  ))}
                </select>
              </Field>
              <Field label="Email (login)"><input type="email" value={f.email} readOnly placeholder="Filled in when you pick a name" /></Field>
              <Field label="Role"><input value={f.jobRole} onChange={(e) => set('jobRole', e.target.value)} placeholder="e.g. CRM Consultant" /></Field>
              <Field label="Access"><input value="Trainee" readOnly /></Field>
            </>
          )}
          {id && (
            <>
              <Field label="Joined date"><input type="date" value={f.joined} onChange={(e) => set('joined', e.target.value)} /></Field>
              <Field label="Status">
                <select value={f.status} onChange={(e) => set('status', e.target.value as Trainee['status'])}>
                  <option>Active</option>
                  <option>On hold</option>
                </select>
              </Field>
            </>
          )}
        </div>
        <FormActions onCancel={closeModal} save={id ? undefined : 'Next: assign course'} />
      </form>
    </>
  );
}

export function TrainerForm({ id }: { id?: string }) {
  const { S, update, closeModal, setRole, toast } = usePortal();
  const ex = id ? S.trainers.find((t) => t.id === id) : undefined;
  const [f, setF] = useState<Omit<Trainer, 'id' | 'tone'>>(ex ?? { name: '', specialty: '', email: '', password: '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  // Adding: pick a person from the user directory. Email is filled in and read-only; access is Trainer.
  // Anyone already a trainer is left out. A directory user becomes the trainer; a trainee or admin keeps
  // their one record and is named as the trainer of a course, so nobody is duplicated.
  const [pick, setPick] = useState('');
  const [lead, setLead] = useState('');
  const [role, setRoleText] = useState('');
  const isTrainerNow = (name: string) => S.trainers.some((t) => t.name === name) || S.courses.some((c) => nameMatches(c.primaryTrainer, name));
  const people = [
    ...S.users.map((p) => ({ id: p.id, name: p.name, email: p.email, kind: 'user' as const })),
    ...S.trainees.map((p) => ({ id: p.id, name: p.name, email: p.email, kind: 'trainee' as const })),
    ...S.admins.map((p) => ({ id: p.id, name: p.name, email: p.email, kind: 'admin' as const })),
  ]
    .filter((p) => !isTrainerNow(p.name))
    .sort((x, y) => x.name.localeCompare(y.name));
  const chosen = people.find((p) => p.id === pick);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!id) {
      if (!chosen) return toast('Pick a person from the list');
      if (chosen.kind !== 'user' && !lead) return toast('Choose the course they will lead');
      if (chosen.kind === 'user' && !setRole(chosen.id, 'trainer', role)) return;
      if (lead)
        update((s) => {
          const c = s.courses.find((x) => x.id === lead);
          if (!c) return;
          const cur = c.primaryTrainer && c.primaryTrainer !== 'No Trainer Assigned' ? c.primaryTrainer : '';
          if (!cur.split(/\s*\/\s*/).includes(chosen.name)) c.primaryTrainer = cur ? `${cur} / ${chosen.name}` : chosen.name;
        });
      closeModal();
      if (chosen.kind !== 'user') toast(`${chosen.name} is now a trainer`);
      if (EMAIL_ENABLED) void sendAll([welcomeEmail({ origin: window.location.origin, name: chosen.name, email: chosen.email, role: role || 'Trainer' })], toast, 'Welcome');
      return;
    }
    const name = f.name.trim();
    if (!name) return toast('Please add a trainer name');
    if (emailTaken(S, f.email.trim(), id)) return toast('Email already in use');
    const data = { ...f, name, email: f.email.trim(), specialty: f.specialty.trim() };
    update((s) => {
      if (id) {
        const t = s.trainers.find((x) => x.id === id)!;
        const old = t.name;
        Object.assign(t, data);
        if (old !== name) {
          s.courses.forEach((c) => { c.primaryTrainer = renameTrainer(c.primaryTrainer, old, name); });
          s.trainees.forEach((x) => { if (x.trainer === old) x.trainer = name; });
          Object.values(s.progress).forEach((r) => { if (r.trainer === old) r.trainer = name; });
          s.sessions.forEach((x) => { if (x.trainer === old) x.trainer = name; });
        }
      } else s.trainers.push({ id: uid('r'), tone: 'lilac', ...data });
    });
    closeModal();
    toast('Trainer saved');
  };
  return (
    <>
      <h2>{id ? 'Edit trainer' : 'Add trainer'}</h2>
      <p>{id ? "Maintain the trainer directory and each trainer's role. A trainer needs an email to sign in." : 'Pick a person from the user list. Their email is filled in and they work as a trainer from now on. People who are already trainers are not shown.'}</p>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          {id ? (
            <>
              <Field label="Name"><input value={f.name} onChange={(e) => set('name', e.target.value)} required /></Field>
              <Field label="Role"><input value={f.specialty} onChange={(e) => set('specialty', e.target.value)} /></Field>
              <Field label="Email (login)"><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
            </>
          ) : (
            <>
              <Field label="Full name" full>
                <select value={pick} onChange={(e) => setPick(e.target.value)} required>
                  <option value="">{people.length ? 'Select a person…' : 'Everyone is already a trainer'}</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.email || 'no email'}</option>)}
                </select>
              </Field>
              <Field label="Email (login)"><input type="email" value={chosen?.email ?? ''} readOnly placeholder="Filled in when you pick a name" /></Field>
              <Field label="Role"><input value={role} onChange={(e) => setRoleText(e.target.value)} placeholder="e.g. Zoho CRM" /></Field>
              <Field label="Access"><input value="Trainer" readOnly /></Field>
              {chosen && chosen.kind !== 'user' && (
                <Field label="Course they will lead" full>
                  <select value={lead} onChange={(e) => setLead(e.target.value)} required>
                    <option value="">Select course…</option>
                    {S.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
              )}
            </>
          )}
        </div>
        <FormActions onCancel={closeModal} />
      </form>
    </>
  );
}

/** Tick one or more trainers. The selection is kept in the order they are ticked. */
function TrainerPicker({ names, value, onChange }: { names: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const all = [...value.filter((v) => !names.includes(v)), ...names];
  const toggle = (n: string) => onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n]);
  return (
    <div className="trainer-picker" role="group" aria-label="Trainers" style={{ display: 'grid', gap: 6, maxHeight: 180, overflow: 'auto', padding: '8px 10px', border: '1px solid var(--line, #ddd)', borderRadius: 10 }}>
      {all.map((n) => (
        <label key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, cursor: 'pointer', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>
          <input type="checkbox" checked={value.includes(n)} onChange={() => toggle(n)} style={{ width: 16, height: 16, padding: 0, margin: 0, flex: 'none' }} />
          <span>{n}</span>
        </label>
      ))}
    </div>
  );
}

export function CourseForm({ id }: { id?: string }) {
  const { S, update, closeModal, toast } = usePortal();
  const ex = id ? S.courses.find((c) => c.id === id) : undefined;
  const [name, setName] = useState(ex?.name ?? '');
  const [group, setGroup] = useState(ex?.group ?? 'Common');
  const [duration, setDuration] = useState(ex?.duration ?? '30 days');
  const [trainers, setTrainers] = useState<string[]>(courseTrainers(ex));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast('Please add a course name');
    const d = { name: name.trim(), group, duration: duration.trim() || 'Flexible', primaryTrainer: joinTrainers(trainers) };
    update((s) => {
      if (id) Object.assign(s.courses.find((c) => c.id === id)!, d);
      else s.courses.push({ id: uid('c'), ...d, topics: [], extraDays: [] });
    });
    closeModal();
    toast('Course saved');
  };
  return (
    <>
      <h2>{id ? 'Edit course' : 'Create course'}</h2>
      <p>{id ? 'Update learning path details and its trainers.' : 'Add a course and assign one or more trainers.'}</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Course name" full><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Zoho Analytics" required /></Field>
          <Field label="Category">
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {['Common', 'Zoho apps', 'Role-based'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Duration"><input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 15 days" /></Field>
          <Field label="Trainers" full>
            <TrainerPicker names={trainerNames(S).filter((n) => n !== 'No Trainer Assigned')} value={trainers} onChange={setTrainers} />
            <small className="subtle">Tick every trainer for this course. Each of them sees its learners in their own panel and can mark topics. Session delivery can be credited to a substitute.</small>
          </Field>
        </div>
        <FormActions onCancel={closeModal} />
      </form>
    </>
  );
}

const NEW_DAY = '__new_day__';

export function TopicForm({ courseId, topicId }: { courseId: string; topicId?: string }) {
  const { S, update, closeModal, toast } = usePortal();
  const c = S.courses.find((x) => x.id === courseId) as Course | undefined;
  const ex = c?.topics.find((t) => t.id === topicId);
  const [day, setDay] = useState(ex?.day ?? 'Day ' + Math.min(90, (c?.topics.length ?? 0) + 1));
  const [customDay, setCustomDay] = useState(String(Math.max(91, dayNumber(ex?.day ?? 'Day 90') + 1)));
  const [trainer, setTrainer] = useState(c ? topicTrainer(S, ex?.trainer, c) : '');
  const [topic, setTopic] = useState(ex?.topic ?? '');
  const [cover, setCover] = useState(ex?.cover ?? '');
  const [activity, setActivity] = useState(ex?.activity ?? '');
  if (!c) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    let d = day;
    if (d === NEW_DAY) {
      const n = Number(customDay);
      if (!Number.isInteger(n) || n < 91) return toast('Enter a whole day number above 90');
      d = 'Day ' + n;
    }
    if (!topic.trim()) return toast('Please add a topic name');
    const rec = { day: d, trainer, topic: topic.trim(), cover: cover.trim(), activity: activity.trim() };
    update((s) => {
      const cc = s.courses.find((x) => x.id === courseId)!;
      if (dayNumber(d) > 90 && !cc.extraDays.includes(d)) cc.extraDays = [...cc.extraDays, d].sort(daySort);
      if (topicId) Object.assign(cc.topics.find((t) => t.id === topicId)!, rec);
      else cc.topics.push({ id: uid('tp-'), ...rec } as Topic);
    });
    closeModal();
    toast('Topic saved');
  };
  return (
    <>
      <h2>{ex ? 'Edit topic' : 'Add a topic'}</h2>
      <p>Add a planned topic to {c.name}. Completion is recorded separately for each learner.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Planned day">
            <select value={day} onChange={(e) => setDay(e.target.value)}>
              {plannedDays(c, ex?.day).map((x) => <option key={x}>{x}</option>)}
              <option value={NEW_DAY}>＋ Add a day above 90…</option>
            </select>
          </Field>
          <Field label="Trainer">
            <select value={trainer} onChange={(e) => setTrainer(e.target.value)}>
              {trainerNames(S, trainer).map((n) => <option key={n}>{n}</option>)}
            </select>
          </Field>
          {day === NEW_DAY && (
            <Field label="New day number" full>
              <input type="number" min={91} step={1} value={customDay} onChange={(e) => setCustomDay(e.target.value)} />
              <small className="subtle">Days above 90 are added in ascending order and stay available if topics are removed.</small>
            </Field>
          )}
          <Field label="Topic" full><input value={topic} onChange={(e) => setTopic(e.target.value)} required /></Field>
          <Field label="What we cover" full><textarea value={cover} onChange={(e) => setCover(e.target.value)} /></Field>
          <Field label="Activity / assessment" full><input value={activity} onChange={(e) => setActivity(e.target.value)} /></Field>
        </div>
        <FormActions onCancel={closeModal} />
      </form>
    </>
  );
}

/** A picklist with a search box inside it: type to narrow the list, click a person to pick them. */
function PersonSearch({ options, value, onChange, disabled }: { options: { id: string; text: string }[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const picked = options.find((o) => o.id === value);
  const needle = q.trim().toLowerCase();
  const list = options.filter((o) => !needle || o.text.toLowerCase().includes(needle));
  return (
    <div style={{ position: 'relative' }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <input
        value={open ? q : picked?.text ?? ''}
        placeholder="Search and select trainee…"
        aria-label="Trainee"
        aria-required="true"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onFocus={() => { setQ(''); setOpen(true); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        autoComplete="off"
      />
      {open && !disabled && (
        <div role="listbox" style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', marginTop: 4, maxHeight: 220, overflow: 'auto', background: 'var(--panel, #fff)', border: '1px solid var(--line, #ddd)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)' }}>
          {list.length ? list.map((o) => (
            <button type="button" role="option" aria-selected={o.id === value} key={o.id} onClick={() => { onChange(o.id); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 0, background: o.id === value ? 'rgba(0,0,0,.06)' : 'transparent', cursor: 'pointer', fontSize: 13 }}>
              {o.text}
            </button>
          )) : <div style={{ padding: '8px 12px', fontSize: 12, opacity: .7 }}>No match</div>}
        </div>
      )}
    </div>
  );
}

export function AssignDialog({ traineeId, courseId }: { traineeId?: string; courseId?: string }) {
  const { S, assign, closeModal, openModal, toast, me } = usePortal();
  const [tid, setTid] = useState(traineeId ?? '');
  const [cid, setCid] = useState(courseId ?? '');
  const [start, setStart] = useState('');
  const [due, setDue] = useState('');
  const [trainers, setTrainers] = useState<string[]>(() => courseTrainers(S.courses.find((c) => c.id === courseId)));
  const trainer = joinTrainers(trainers);

  const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  // Learner: the trainee list plus every trainer (trainers can learn courses too). An admin joins only when
  // they are being added as a trainee, which passes their id in.
  const traineePool = [
    ...learners(S).map((t) => ({ id: t.id, name: t.name, label: 'Trainee' })),
    ...S.trainers.filter((p) => !learners(S).some((t) => t.id === p.id)).map((p) => ({ id: p.id, name: p.name, label: 'Trainer' })),
    ...S.admins.filter((p) => !learners(S).some((t) => t.id === p.id)).map((p) => ({ id: p.id, name: p.name, label: 'Admin' })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  // Trainer: from the trainer data (the Trainers list), plus anyone named as a course lead.
  const trainerPool = [
    ...new Set([
      ...S.trainers.map((t) => t.name),
      ...[...S.trainees, ...S.admins].filter((p) => S.courses.some((c) => nameMatches(c.primaryTrainer, p.name))).map((p) => p.name),
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const pickedTrainee = traineePool.find((t) => t.id === tid);
  // one person cannot be both the trainee and the trainer on the same course
  const trainees = traineePool.filter(
    (t) => t.id === traineeId || (!traineeId && !(cid && isAssigned(S, t.id, cid)))
  );
  // Same name does not mean same person: two people can share a name with different emails. A trainer name is
  // the learner only when the learner is that trainer record itself.
  const isLearner = (n: string, learnerId: string, learnerName?: string) => {
    const recs = S.trainers.filter((t) => same(t.name, n));
    return recs.length ? recs.every((r) => r.id === learnerId) : same(n, learnerName);
  };
  const emailOf = (id: string) => [...S.trainees, ...S.trainers, ...S.admins].find((p) => p.id === id)?.email ?? '';
  const trainerOptions = trainerPool.filter((n) => !isLearner(n, tid, pickedTrainee?.name));
  const courses = S.courses.filter((c) => c.id === courseId || (!courseId && !(tid && isAssigned(S, tid, c.id))));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (start && due && due < start) return toast('Due date cannot be before the start date');
    if (!tid) return toast('Pick a trainee');
    if (!trainers.length) return toast('Pick at least one trainer');
    if (!assign(tid, cid, due, trainer, start)) return toast('This trainee already has that course');
    toast('Course assigned');
    closeModal();
    // send the "course assigned" emails to the trainee and the trainer automatically
    if (EMAIL_ENABLED) {
      const made = { id: 'new', traineeId: tid, courseId: cid, assignedOn: today(), startDate: start, due, trainer };
      const emails = assignmentEmails(S, made, me?.name).map((x) => x.email);
      if (emails.length) void sendAll(emails, toast, 'Course assigned');
    }
  };
  return (
    <div className="assign-split">
      <div>
      <h2>Assign a course</h2>
      <p>The learner can be a trainee or a trainer; the trainer comes from the trainer list. Progress starts separately for each learning path.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Trainee" full>
            <PersonSearch
              options={trainees.map((t) => ({ id: t.id, text: `${t.name} — ${t.label}${emailOf(t.id) ? ` (${emailOf(t.id)})` : ''}` }))}
              value={tid}
              disabled={!!traineeId}
              onChange={(id) => {
                const p = traineePool.find((x) => x.id === id);
                setTid(id);
                // one person cannot be both the learner and the trainer on the same course
                if (p) setTrainers((cur) => cur.filter((n) => !isLearner(n, p.id, p.name)));
              }}
            />
          </Field>
          <Field label="Course" full>
            <select value={cid} onChange={(e) => { setCid(e.target.value); setTrainers(courseTrainers(S.courses.find((c) => c.id === e.target.value))); }} disabled={!!courseId} required>
              <option value="">Select course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.topics.length} topics)</option>)}
            </select>
          </Field>
          <Field label="Trainers" full>
            <TrainerPicker names={trainerOptions} value={trainers} onChange={setTrainers} />
            <small className="subtle">Filled in from the course's trainers. Every ticked trainer sees this trainee and course in their panel.</small>
          </Field>
          <Field label="Start date"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Due date"><input type="date" value={due} min={start || undefined} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        <FormActions onCancel={closeModal} save="Assign course" />
      </form>
      </div>
      <AvailabilityBox />
    </div>
  );
}
