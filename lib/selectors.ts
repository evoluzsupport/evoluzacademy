import type { Assignment, Course, Me, State, Topic, Trainee } from './types';
import { daySort, isOverdue } from './util';
import { primaryOf } from './seed';

/** True when a trainer field ("Jyoti Raj/ Shivangi Kumari") names the given person. */
export const nameMatches = (value: string | undefined, name: string | undefined) => {
  const n = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!n) return false;
  return String(value || '')
    .split(/\s*(?:\/|&|,|;|\band\b)\s*/i)
    .some((x) => x.toLowerCase().replace(/\s+/g, ' ').trim() === n);
};

export const topicKey = (tid: string, cid: string, topicId: string) => `${tid}|${cid}|${topicId}`;

export const courseById = (S: State, id: string) => S.courses.find((c) => c.id === id);
/**
 * Everyone who is taking a course: the trainees, plus any trainer or admin who has been assigned one.
 * The latter get a learner entry here (same id, so assignments and progress line up) without a second profile.
 */
export function learners(S: State): Trainee[] {
  const extra: Trainee[] = [];
  const seen = new Set(S.trainees.map((t) => t.id));
  const add = (p: { id: string; name: string; email: string; phone?: string; tone?: string }, jobRole: string) => {
    if (seen.has(p.id)) return;
    const mine = S.assignments.filter((a) => a.traineeId === p.id);
    if (!mine.length) return;
    seen.add(p.id);
    const first = mine.map((a) => a.assignedOn).filter(Boolean).sort()[0] ?? '';
    extra.push({ id: p.id, name: p.name, email: p.email, password: '', phone: p.phone, tone: p.tone ?? '', jobRole, joined: first, status: 'Active', trainer: '' });
  };
  S.trainers.forEach((t) => add(t, 'Trainer'));
  S.admins.forEach((a) => add(a, 'Admin'));
  return [...S.trainees, ...extra];
}

export const traineeById = (S: State, id: string) => learners(S).find((t) => t.id === id);

export const orderedTopics = (c: Course): Topic[] =>
  c.topics
    .map((topic, index) => ({ topic, index }))
    .sort((a, b) => daySort(a.topic.day, b.topic.day) || a.index - b.index)
    .map((x) => x.topic);

export const assignmentsOf = (S: State, traineeId: string) => S.assignments.filter((a) => a.traineeId === traineeId);

/**
 * The trainers named on the learner's own course assignments (My Course > Assigned trainer),
 * joined for display. The course's primary trainer is only a fallback when an assignment
 * has no trainer, and the learner's contact trainer only when nothing is assigned.
 */
export const assignedTrainersOf = (S: State, traineeId: string, contact = ''): string => {
  const real = (v?: string) => (v && v !== 'No Trainer Assigned' ? v : '');
  const out: string[] = [];
  for (const a of assignmentsOf(S, traineeId)) {
    const c = courseById(S, a.courseId);
    const v = real(a.trainer) || (c ? real(primaryOf(c)) : '');
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return out.length ? out.join(', ') : real(contact);
};

export const assignedCourses = (S: State, traineeId: string): Course[] =>
  assignmentsOf(S, traineeId)
    .map((a) => courseById(S, a.courseId))
    .filter((c): c is Course => !!c);

export const isAssigned = (S: State, traineeId: string, courseId: string) =>
  S.assignments.some((a) => a.traineeId === traineeId && a.courseId === courseId);

export interface CourseStat {
  done: number;
  total: number;
  pct: number;
}
export function statCourse(S: State, traineeId: string, c: Course): CourseStat {
  const done = c.topics.filter((t) => S.progress[topicKey(traineeId, c.id, t.id)]?.done).length;
  const total = c.topics.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function progressFor(S: State, t: Trainee): CourseStat {
  const cs = assignedCourses(S, t.id);
  const total = cs.reduce((n, c) => n + c.topics.length, 0);
  const done = cs.reduce((n, c) => n + statCourse(S, t.id, c).done, 0);
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Courses a signed-in person works with: admins see all; a trainer sees only those an admin assigned to them. */
export function visibleCourses(S: State, me: Me | null): Course[] {
  if (!me || me.kind !== 'trainer') return S.courses;
  const name = S.trainers.find((t) => t.id === me.id)?.name ?? me.name;
  return S.courses.filter(
    (c) => nameMatches(c.primaryTrainer, name) || S.assignments.some((a) => a.courseId === c.id && nameMatches(a.trainer, name))
  );
}

/** Trainees a signed-in person is allowed to see. */
export function scopeTrainees(S: State, me: Me | null): Trainee[] {
  if (!me) return [];
  const all = learners(S);
  if (me.kind === 'admin') return all;
  if (me.kind === 'trainee') return all.filter((t) => t.id === me.id);
  // a trainer sees the trainees on courses they lead or teach, or whose topics they delivered
  const name = S.trainers.find((t) => t.id === me.id)?.name ?? me.name;
  return all.filter((t) => {
    if (t.id === me.id) return false;
    if (nameMatches(t.trainer, name)) return true;
    if (S.assignments.some((a) => a.traineeId === t.id && nameMatches(a.trainer, name))) return true;
    const mine = S.assignments.filter((a) => a.traineeId === t.id).map((a) => courseById(S, a.courseId));
    if (mine.some((c) => c && (nameMatches(c.primaryTrainer, name) || c.topics.some((tp) => nameMatches(tp.trainer, name))))) return true;
    return Object.entries(S.progress).some(([k, r]) => k.startsWith(t.id + '|') && nameMatches(r.trainer, name));
  });
}

export function allStats(S: State, trainees: Trainee[]) {
  const ids = new Set(trainees.map((t) => t.id));
  const assigned = S.assignments
    .filter((a) => ids.has(a.traineeId))
    .map((a) => ({ a, t: traineeById(S, a.traineeId)!, c: courseById(S, a.courseId)! }))
    .filter((x) => x.c && x.t);
  const total = assigned.reduce((n, x) => n + x.c.topics.length, 0);
  const done = assigned.reduce((n, x) => n + statCourse(S, x.t.id, x.c).done, 0);
  return {
    assigned,
    total,
    done,
    pct: total ? Math.round((done / total) * 100) : 0,
    active: trainees.filter((t) => t.status === 'Active').length,
    complete: assigned.filter((x) => statCourse(S, x.t.id, x.c).pct === 100).length,
  };
}

export interface Activity {
  traineeName: string;
  topic: string;
  course: string;
  date: string;
}
export function recentActivity(S: State, trainees: Trainee[], limit = 4): Activity[] {
  const ids = new Set(trainees.map((t) => t.id));
  const out: Activity[] = [];
  for (const [key, rec] of Object.entries(S.progress)) {
    const [tid, cid, topicId] = key.split('|');
    if (!ids.has(tid)) continue;
    const t = traineeById(S, tid);
    const c = courseById(S, cid);
    const topic = c?.topics.find((x) => x.id === topicId);
    if (t && c && topic) out.push({ traineeName: t.name, topic: topic.topic, course: c.name, date: rec.date || 'Recently' });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export interface Attention {
  kind: 'overdue' | 'hold' | 'nocourse';
  text: string;
  sub: string;
  traineeId: string;
}
export function attentionItems(S: State, trainees: Trainee[]): Attention[] {
  const out: Attention[] = [];
  for (const t of trainees) {
    for (const a of assignmentsOf(S, t.id)) {
      const c = courseById(S, a.courseId);
      if (c && isOverdue(a.due, statCourse(S, t.id, c).pct)) {
        out.push({ kind: 'overdue', text: `${t.name} is overdue`, sub: `${c.name} · due ${a.due}`, traineeId: t.id });
      }
    }
    if (t.status === 'On hold') out.push({ kind: 'hold', text: `${t.name} is on hold`, sub: t.jobRole, traineeId: t.id });
    if (t.status === 'Active' && !assignmentsOf(S, t.id).length)
      out.push({ kind: 'nocourse', text: `${t.name} has no course`, sub: 'Assign a learning path', traineeId: t.id });
  }
  return out;
}

/** Everyone in the directory can lead or deliver, since roles change. Keeps the current value selectable. */
export const trainerNames = (S: State, selected?: string) => {
  const names = [...new Set([...S.admins, ...S.trainers, ...S.trainees].map((p) => p.name).filter(Boolean))].sort((x, y) => x.localeCompare(y));
  names.unshift('No Trainer Assigned');
  if (selected && !names.includes(selected)) names.unshift(selected);
  return names;
};

/** Map free-text topic trainer ("A/B") to a known trainer, else the course lead. */
export const topicTrainer = (S: State, v: string | undefined, c: Course) => {
  const name = String(v || '').split(/[/,]/)[0].trim();
  return S.trainers.some((r) => r.name === name) ? name : primaryOf(c);
};

export const plannedDays = (c: Course, selected?: string) => {
  const base = Array.from({ length: 90 }, (_, i) => 'Day ' + (i + 1));
  const special = c.topics.map((t) => String(t.day || '')).filter((x) => x && !/^day\s*\d+$/i.test(x));
  if (selected && !base.includes(selected) && !c.extraDays.includes(selected) && !special.includes(selected)) special.push(selected);
  return [...new Set([...base, ...c.extraDays, ...special])].sort(daySort);
};

export type { Assignment };

export interface TrainerItem {
  a: Assignment;
  c: Course;
  stat: CourseStat;
  delivered: number;
}
export interface TrainerLearner {
  t: Trainee;
  items: TrainerItem[];
}

/** Courses a named trainer leads or teaches: primary trainer, assignment trainer or a topic trainer. */
export function coursesOfTrainer(S: State, name: string): Course[] {
  return S.courses.filter(
    (c) =>
      nameMatches(c.primaryTrainer, name) ||
      c.topics.some((tp) => nameMatches(tp.trainer, name)) ||
      S.assignments.some((a) => a.courseId === c.id && nameMatches(a.trainer, name))
  );
}

/** The learners a named trainer teaches, with the courses they take from that trainer. */
export function learnersOfTrainer(S: State, name: string, pool: Trainee[]): TrainerLearner[] {
  const out: TrainerLearner[] = [];
  for (const t of pool) {
    const items: TrainerItem[] = [];
    for (const a of assignmentsOf(S, t.id)) {
      const c = courseById(S, a.courseId);
      if (!c) continue;
      const delivered = Object.entries(S.progress).filter(
        ([k, r]) => r.done && k.startsWith(`${t.id}|${c.id}|`) && nameMatches(r.trainer, name)
      ).length;
      const mine = nameMatches(a.trainer, name) || nameMatches(c.primaryTrainer, name) || c.topics.some((tp) => nameMatches(tp.trainer, name)) || delivered > 0;
      if (mine) items.push({ a, c, stat: statCourse(S, t.id, c), delivered });
    }
    if (items.length) out.push({ t, items });
  }
  return out;
}

export interface Notice {
  id: string;
  kind: 'assigned' | 'teach' | 'learn' | 'overdue' | 'hold' | 'nocourse';
  title: string;
  sub: string;
  href: string;
  /** yyyy-mm-dd the event happened, when known */
  date?: string;
}

const RECENT_DAYS = 30;
const daysAgo = (d?: string) => (d ? Math.floor((Date.now() - new Date(d + 'T00:00').getTime()) / 86400000) : 9999);

/** What to tell the signed-in person: new course assignments for their role, plus items needing attention. */
export function notificationsFor(S: State, me: Me | null): Notice[] {
  if (!me) return [];
  const out: Notice[] = [];
  const myName = S.trainers.find((t) => t.id === me.id)?.name ?? S.admins.find((a) => a.id === me.id)?.name ?? me.name;
  const startNote = (a: Assignment) => (a.startDate ? `Starts ${a.startDate}` : 'No start date yet');
  const everyone = learners(S);

  for (const a of S.assignments) {
    const c = courseById(S, a.courseId);
    if (!c || daysAgo(a.assignedOn) > RECENT_DAYS) continue;
    const learner = everyone.find((t) => t.id === a.traineeId);
    if (!learner) continue;
    const trainerName = a.trainer || primaryOf(c);
    if (a.traineeId === me.id) {
      out.push({
        id: 'as:' + a.id,
        kind: 'assigned',
        title: `New course assigned: ${c.name}`,
        sub: `Trainer ${trainerName || 'not set'} · ${startNote(a)}`,
        href: me.kind === 'trainee' ? `/tracker?course=${c.id}` : '/assigned-courses',
        date: a.assignedOn,
      });
    } else if (me.kind === 'trainer' && nameMatches(a.trainer, myName)) {
      out.push({
        id: 'tr:' + a.id,
        kind: 'teach',
        title: `You are the trainer for ${c.name}`,
        sub: `${learner.name} · ${startNote(a)}`,
        href: `/courses/${c.id}`,
        date: a.assignedOn,
      });
    } else if (me.kind === 'admin') {
      out.push({
        id: 'ad:' + a.id,
        kind: 'assigned',
        title: `${learner.name} was assigned ${c.name}`,
        sub: `Trainer ${trainerName || 'not set'} · ${startNote(a)}`,
        href: `/trainees/${learner.id}`,
        date: a.assignedOn,
      });
    }
  }

  for (const x of attentionItems(S, scopeTrainees(S, me))) {
    out.push({
      id: `at:${x.kind}:${x.traineeId}:${x.sub}`,
      kind: x.kind,
      title: x.text,
      sub: x.sub,
      href: me.kind === 'trainee' ? '/tracker' : `/trainees/${x.traineeId}`,
    });
  }

  return out.sort((x, y) => (y.date ?? '').localeCompare(x.date ?? ''));
}
