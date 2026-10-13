import type { Assignment, Course, Me, State, Topic, Trainee } from './types';
import { daySort, isOverdue } from './util';
import { primaryOf } from './seed';

export const topicKey = (tid: string, cid: string, topicId: string) => `${tid}|${cid}|${topicId}`;

export const courseById = (S: State, id: string) => S.courses.find((c) => c.id === id);
export const traineeById = (S: State, id: string) => S.trainees.find((t) => t.id === id);

export const orderedTopics = (c: Course): Topic[] =>
  c.topics
    .map((topic, index) => ({ topic, index }))
    .sort((a, b) => daySort(a.topic.day, b.topic.day) || a.index - b.index)
    .map((x) => x.topic);

export const assignmentsOf = (S: State, traineeId: string) => S.assignments.filter((a) => a.traineeId === traineeId);

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

/** Trainees a signed-in person is allowed to see. */
export function scopeTrainees(S: State, me: Me | null): Trainee[] {
  if (!me) return [];
  if (me.kind === 'admin') return S.trainees;
  if (me.kind === 'trainee') return S.trainees.filter((t) => t.id === me.id);
  const name = S.trainers.find((t) => t.id === me.id)?.name;
  return S.trainees.filter(
    (t) =>
      t.trainer === name ||
      S.assignments.some((a) => a.traineeId === t.id && primaryOf(courseById(S, a.courseId)) === name) ||
      Object.entries(S.progress).some(([k, r]) => k.startsWith(t.id + '|') && r.trainer === name)
  );
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
