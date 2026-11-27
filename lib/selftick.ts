import type { State } from './types';
import { nameMatches, topicKey } from './selectors';
import { uid } from './util';

/**
 * Ticks a trainer makes on their own My Course page. Subtopic records must belong to a session, so these are kept in
 * "self" sessions (one per course, date and trainer). The id prefix is what lets the person undo their own ticks
 * without ever touching anything logged by someone else.
 */
const SELF = 'self-';
export const isSelfSession = (id?: string) => !!id && id.startsWith(SELF);

export interface SelfTick {
  /** the signed-in person, ticking their own course */
  me: { id: string; name: string };
  courseId: string;
  topicId: string;
  /** how many "What we cover" points the topic has */
  pointCount: number;
  /** a subtopic index, or null for the whole topic */
  point: number | null;
  on: boolean;
  /** delivered by, and when: used for new ticks */
  trainer: string;
  date: string;
}

/** A completion the person may undo: one they ticked themselves, or one they delivered. */
export const canUntickOwn = (name: string, rec: { trainer: string; sessionId?: string }) =>
  isSelfSession(rec.sessionId) || nameMatches(rec.trainer, name);

/** Applies one tick or untick. Returns '' when done, else why it is not allowed (and leaves the state unchanged). */
export function applySelfTick(s: State, d: SelfTick): string {
  const c = s.courses.find((x) => x.id === d.courseId);
  if (!c) return 'This course no longer exists';
  const key = topicKey(d.me.id, d.courseId, d.topicId);
  const rec = s.progress[key];
  const entries = () => Object.entries(s.points).filter(([k]) => k.startsWith(key + '|'));
  const indexOf = (k: string) => Number(k.split('|')[3]);
  const has = (i: number) => entries().some(([k]) => indexOf(k) === i);
  const touched = new Set<string>();

  const sessionFor = (date: string, trainer: string) => {
    let x = s.sessions.find(
      (q) => isSelfSession(q.id) && q.courseId === c.id && q.date === date && q.trainer === trainer && q.traineeIds.length === 1 && q.traineeIds[0] === d.me.id
    );
    if (!x) {
      x = { id: uid(SELF), courseId: c.id, courseName: c.name, date, trainer, traineeIds: [d.me.id], topicIds: [], newMarks: 0, existingPreserved: 0 };
      s.sessions.push(x);
    }
    touched.add(x.id);
    return x.id;
  };
  const addPoint = (i: number, date: string, trainer: string) => {
    const id = sessionFor(date, trainer);
    s.points[`${key}|${i}|${id}`] = { date, trainer, sessionId: id };
  };
  const removePoint = (k: string) => {
    touched.add(s.points[k].sessionId);
    delete s.points[k];
  };
  const removeCompletion = () => {
    if (rec.sessionId) touched.add(rec.sessionId);
    delete s.progress[key];
  };
  const complete = () => {
    s.progress[key] = { done: true, date: d.date, trainer: d.trainer, sessionId: sessionFor(d.date, d.trainer) };
  };

  if (d.on) {
    if (rec?.done) return '';
    if (d.point === null) complete();
    else if (!has(d.point)) {
      addPoint(d.point, d.date, d.trainer);
      // ticking the last open subtopic completes the topic
      if (Array.from({ length: d.pointCount }, (_, i) => i).every(has)) complete();
    }
  } else {
    if (rec?.done && !canUntickOwn(d.me.name, rec)) return `Only ${rec.trainer} (or an admin) can change this topic`;
    if (d.point === null) {
      if (!rec?.done) return '';
      removeCompletion();
      for (const [k, r] of entries()) if (isSelfSession(r.sessionId)) removePoint(k);
    } else {
      const mine = entries().filter(([k]) => indexOf(k) === d.point);
      const other = mine.find(([, r]) => !isSelfSession(r.sessionId));
      if (other) return `${other[1].trainer} logged this subtopic in a session. Only an admin or that session's Undo can remove it`;
      for (const [k] of mine) removePoint(k);
      if (rec?.done) {
        removeCompletion();
        // the topic was complete, so every other subtopic stays ticked
        for (let i = 0; i < d.pointCount; i++) if (i !== d.point && !has(i)) addPoint(i, rec.date, rec.trainer);
      }
    }
  }

  // keep each affected self session in step with what it still records, and drop it when nothing is left
  for (const id of touched) {
    const x = s.sessions.find((q) => q.id === id);
    if (!x || !isSelfSession(id)) continue;
    const done = Object.entries(s.progress).filter(([, r]) => r.sessionId === id).map(([k]) => k.split('|')[2]);
    const pts = Object.entries(s.points).filter(([, r]) => r.sessionId === id).map(([k]) => k.split('|')[2]);
    x.topicIds = [...new Set([...done, ...pts])];
    x.newMarks = done.length;
    if (!x.topicIds.length) s.sessions = s.sessions.filter((q) => q.id !== id);
  }
  return '';
}
