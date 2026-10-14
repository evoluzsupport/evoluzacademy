'use client';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { usePortal } from '@/lib/store';
import { primaryOf } from '@/lib/seed';
import { isAssigned, plannedDays, topicTrainer, trainerNames } from '@/lib/selectors';
import type { Course, State, Topic, Trainee, Trainer } from '@/lib/types';
import { dayNumber, daySort, today, uid } from '@/lib/util';
import { FormActions } from './ui';

const emailTaken = (S: State, email: string, id?: string) =>
  !!email &&
  [...S.admins, ...S.trainers, ...S.trainees].some((x) => x.email && x.email.toLowerCase() === email.toLowerCase() && x.id !== id);

const Field = ({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) => (
  <div className={`field ${full ? 'full' : ''}`}>
    <label>{label}</label>
    {children}
  </div>
);

export function TraineeForm({ id }: { id?: string }) {
  const { S, update, closeModal, toast } = usePortal();
  const ex = id ? S.trainees.find((t) => t.id === id) : undefined;
  const [f, setF] = useState<Omit<Trainee, 'id' | 'tone'>>(
    ex ?? { name: '', jobRole: '', email: '', trainer: '', joined: today(), status: 'Active', password: '' }
  );
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
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
      <p>{id ? 'Update profile details.' : 'Create a learner profile. You can assign learning paths from the trainee record.'}</p>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field label="Full name"><input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Asha Verma" required /></Field>
          <Field label="Role"><input value={f.jobRole} onChange={(e) => set('jobRole', e.target.value)} placeholder="e.g. CRM Consultant" /></Field>
          <Field label="Email (login)"><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required /></Field>
          <Field label="Joined date"><input type="date" value={f.joined} onChange={(e) => set('joined', e.target.value)} /></Field>
          <Field label="Status">
            <select value={f.status} onChange={(e) => set('status', e.target.value as Trainee['status'])}>
              <option>Active</option>
              <option>On hold</option>
            </select>
          </Field>
        </div>
        <FormActions onCancel={closeModal} />
      </form>
    </>
  );
}

export function TrainerForm({ id }: { id?: string }) {
  const { S, update, closeModal, toast } = usePortal();
  const ex = id ? S.trainers.find((t) => t.id === id) : undefined;
  const [f, setF] = useState<Omit<Trainer, 'id' | 'tone'>>(ex ?? { name: '', specialty: '', email: '', password: '' });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
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
          s.courses.forEach((c) => { if (c.primaryTrainer === old) c.primaryTrainer = name; });
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
      <p>Maintain the trainer directory and each trainer's role. A trainer needs an email to sign in.</p>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field label="Name"><input value={f.name} onChange={(e) => set('name', e.target.value)} required /></Field>
          <Field label="Role"><input value={f.specialty} onChange={(e) => set('specialty', e.target.value)} /></Field>
          <Field label="Email (login)"><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        </div>
        <FormActions onCancel={closeModal} />
      </form>
    </>
  );
}

export function CourseForm({ id }: { id?: string }) {
  const { S, update, closeModal, toast } = usePortal();
  const ex = id ? S.courses.find((c) => c.id === id) : undefined;
  const [name, setName] = useState(ex?.name ?? '');
  const [group, setGroup] = useState(ex?.group ?? 'Common');
  const [duration, setDuration] = useState(ex?.duration ?? '30 days');
  const [lead, setLead] = useState(ex ? primaryOf(ex) : 'No Trainer Assigned');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast('Please add a course name');
    const d = { name: name.trim(), group, duration: duration.trim() || 'Flexible', primaryTrainer: lead };
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
      <p>{id ? 'Update learning path details and primary trainer.' : 'Add a course and assign its primary trainer.'}</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Course name" full><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Zoho Analytics" required /></Field>
          <Field label="Category">
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {['Common', 'Zoho apps', 'Role-based'].map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Duration"><input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 15 days" /></Field>
          <Field label="Primary trainer" full>
            <select value={lead} onChange={(e) => setLead(e.target.value)}>
              {trainerNames(S, lead).map((n) => <option key={n}>{n}</option>)}
            </select>
            <small className="subtle">The person responsible for this course path. Session delivery can be credited to a substitute.</small>
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

export function AssignDialog({ traineeId, courseId }: { traineeId?: string; courseId?: string }) {
  const { S, assign, closeModal, toast, me } = usePortal();
  const [tid, setTid] = useState(traineeId ?? '');
  const [cid, setCid] = useState(courseId ?? '');
  const [start, setStart] = useState('');
  const [due, setDue] = useState('');
  const [trainer, setTrainer] = useState('');
  void me;

  // anyone can be a learner: trainees, and trainers or admins taking a course themselves
  const everyone = [
    ...S.trainees.map((t) => ({ id: t.id, name: t.name, label: t.jobRole || 'Trainee' })),
    ...S.trainers.map((t) => ({ id: t.id, name: t.name, label: 'Trainer' })),
    ...S.admins.map((t) => ({ id: t.id, name: t.name, label: 'Admin' })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const trainees = everyone.filter((t) => t.id === traineeId || (!traineeId && !(cid && isAssigned(S, t.id, cid))));
  const courses = S.courses.filter((c) => c.id === courseId || (!courseId && !(tid && isAssigned(S, tid, c.id))));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (start && due && due < start) return toast('Due date cannot be before the start date');
    if (!assign(tid, cid, due, trainer === 'No Trainer Assigned' ? '' : trainer, start)) return toast('This trainee already has that course');
    closeModal();
    toast('Course assigned');
  };
  return (
    <>
      <h2>Assign a course</h2>
      <p>Their topic progress starts separately for each learning path.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Learner" full>
            <select value={tid} onChange={(e) => setTid(e.target.value)} disabled={!!traineeId} required>
              <option value="">Select learner…</option>
              {trainees.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.label}</option>)}
            </select>
          </Field>
          <Field label="Course" full>
            <select value={cid} onChange={(e) => setCid(e.target.value)} disabled={!!courseId} required>
              <option value="">Select course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.topics.length} topics)</option>)}
            </select>
          </Field>
          <Field label="Trainer" full>
            <select value={trainer} onChange={(e) => setTrainer(e.target.value)} required>
              <option value="">Select trainer…</option>
              {trainerNames(S).map((n) => <option key={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Start date"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Due date"><input type="date" value={due} min={start || undefined} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        <FormActions onCancel={closeModal} save="Assign course" />
      </form>
    </>
  );
}
