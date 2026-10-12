import { field, type ImportKind, type Row } from './csv';
import { primaryOf } from './seed';
import type { Course, State, Topic, Trainee } from './types';
import { dayNumber, daySort, lc, today, uid } from './util';

const normDay = (d: string) => (/^\d+$/.test(d) ? 'Day ' + Number(d) : d);

function ensureTrainer(S: State, name: string, specialty: string) {
  name = name.trim();
  if (!name || S.trainers.some((t) => lc(t.name) === lc(name))) return;
  S.trainers.push({ id: uid('r-import-'), name, specialty, email: '', password: 'demo123', tone: 'lilac' });
}

function upsertTopic(S: State, c: Course, row: Row, primary: string, trainerCols: string[]): boolean {
  const name = field(row, 'Topic', 'Topic name', 'Name');
  if (!name) return false;
  const day = normDay(field(row, 'Planned day', 'Day') || 'Day 1');
  const trainer = field(row, ...trainerCols) || primary;
  ensureTrainer(S, trainer, 'Imported topic trainer');
  const rec = {
    day,
    trainer,
    topic: name,
    cover: field(row, 'What we cover', 'Cover', 'Description') || '',
    activity: field(row, 'Activity / assessment', 'Activity', 'Assessment') || '',
  };
  const matches = c.topics.filter((t) => lc(t.topic) === lc(name));
  const found = matches.find((t) => lc(t.day) === lc(day)) || (matches.length === 1 ? matches[0] : undefined);
  if (found) Object.assign(found, rec);
  else c.topics.push({ id: uid('tp-'), ...rec } as Topic);
  if (dayNumber(day) > 90 && !c.extraDays.includes('Day ' + dayNumber(day))) {
    c.extraDays.push('Day ' + dayNumber(day));
    c.extraDays.sort(daySort);
  }
  return true;
}

/** Applies a parsed CSV to `S` (a mutable draft). Returns the message to show. */
export function applyImport(S: State, kind: ImportKind, rows: Row[], courseId = ''): string {
  if (!rows.length) throw new Error('The CSV is empty or has no data rows.');
  let count = 0;
  const unknownCourses = new Set<string>();
  let skipped = 0;
  let curriculumCourses = 0;
  let curriculumTopics = 0;
  const seen = new Set<string>();

  if (kind === 'trainers') {
    for (const row of rows) {
      const name = field(row, 'Name', 'Trainer');
      if (!name) continue;
      const specialty = field(row, 'Specialty');
      const email = field(row, 'Email');
      const existing = S.trainers.find((t) => lc(t.name) === lc(name));
      if (existing) {
        if (specialty !== undefined) existing.specialty = specialty;
        if (email !== undefined) existing.email = email;
      } else {
        S.trainers.push({ id: uid('r-import-'), name, specialty: specialty || 'Imported trainer', email: email || '', password: 'demo123', tone: 'lilac' });
      }
      count++;
    }
  } else if (kind === 'trainees') {
    for (const row of rows) {
      const name = field(row, 'Name', 'Trainee');
      if (!name) continue;
      const email = field(row, 'Email');
      const existing = S.trainees.find((t) => (email && t.email && lc(t.email) === lc(email)) || lc(t.name) === lc(name));
      const t: Trainee =
        existing ?? { id: uid('t-import-'), name, email: '', password: 'demo123', jobRole: 'Trainee', joined: today(), status: 'Active', trainer: '', tone: '' };
      const trainer = field(row, 'Trainer');
      const status = field(row, 'Status');
      Object.assign(t, {
        name,
        email: email === undefined ? t.email : email,
        jobRole: field(row, 'Role') || t.jobRole,
        joined: field(row, 'Joined') || t.joined,
        status: status === 'On hold' ? 'On hold' : status ? 'Active' : t.status,
        trainer: trainer === undefined ? t.trainer : trainer,
      });
      if (!existing) S.trainees.push(t);

      const cell = field(row, 'Courses', 'Assigned courses');
      if (cell !== undefined) {
        const wanted: string[] = [];
        for (const cn of cell.split(/[;|]/).map((x) => x.trim()).filter(Boolean)) {
          const c = S.courses.find((x) => lc(x.name) === lc(cn));
          if (c) wanted.push(c.id);
          else unknownCourses.add(cn);
        }
        S.assignments = S.assignments.filter((a) => a.traineeId !== t.id || wanted.includes(a.courseId));
        for (const cid of wanted) {
          if (!S.assignments.some((a) => a.traineeId === t.id && a.courseId === cid))
            S.assignments.push({ id: uid('a'), traineeId: t.id, courseId: cid, assignedOn: today(), due: '' });
        }
      }
      count++;
    }
  } else if (kind === 'curriculum') {
    for (const row of rows) {
      const name = field(row, 'Course', 'Course name');
      if (!name) continue;
      const key = lc(name);
      let c = S.courses.find((x) => lc(x.name) === key);
      const primary = field(row, 'Primary Trainer', 'Trainer') || (c ? primaryOf(c) : 'Project Manager');
      ensureTrainer(S, primary, 'Primary trainer');
      const category = field(row, 'Category', 'Group');
      const duration = field(row, 'Duration');
      if (c) {
        c.name = name;
        c.group = category || c.group || 'Zoho apps';
        c.duration = duration || c.duration || 'Flexible';
        c.primaryTrainer = primary;
      } else {
        c = { id: uid('c-import-'), name, group: category || 'Zoho apps', duration: duration || 'Flexible', primaryTrainer: primary, topics: [], extraDays: [] };
        S.courses.push(c);
      }
      if (!seen.has(key)) {
        seen.add(key);
        curriculumCourses++;
      }
      if (upsertTopic(S, c, row, primary, ['Topic Trainer', 'Trainer'])) curriculumTopics++;
      count++;
    }
  } else {
    const c = S.courses.find((x) => x.id === courseId);
    if (!c) throw new Error('Open a course before importing its topics.');
    for (const row of rows) {
      const rowCourse = field(row, 'Course');
      if (rowCourse && lc(rowCourse) !== lc(c.name)) {
        skipped++;
        continue;
      }
      if (upsertTopic(S, c, row, primaryOf(c), ['Trainer'])) count++;
    }
  }

  if (!count) throw new Error('No valid records were found. Check the CSV column names and required values.');
  let suffix = unknownCourses.size ? ' Unknown courses were ignored: ' + [...unknownCourses].join(', ') + '.' : '';
  if (skipped) suffix += ` ${skipped} rows for other courses were skipped.`;
  const head =
    kind === 'curriculum'
      ? `Imported or updated ${curriculumCourses} courses and ${curriculumTopics} topics.`
      : `${count} ${kind === 'topics' ? 'topic' : kind.slice(0, -1)} records imported or updated.`;
  return head + suffix;
}
