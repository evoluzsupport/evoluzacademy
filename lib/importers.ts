import { field, type ImportKind, type Row } from './csv';
import { primaryOf } from './seed';
import type { Course, Kind, State, Topic, Trainee, Trainer } from './types';
import { dayNumber, daySort, lc, today, uid } from './util';

const normDay = (d: string) => (/^\d+$/.test(d) ? 'Day ' + Number(d) : d);

function ensureTrainer(S: State, name: string, specialty: string) {
  name = name.trim();
  if (!name || S.trainers.some((t) => lc(t.name) === lc(name))) return;
  S.trainers.push({ id: uid('r-import-'), name, specialty, email: '', password: '', tone: 'lilac' });
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
      const specialty = field(row, 'Role', 'Specialty');
      const email = field(row, 'Email');
      const existing = S.trainers.find((t) => lc(t.name) === lc(name));
      if (existing) {
        if (specialty !== undefined) existing.specialty = specialty;
        if (email !== undefined) existing.email = email;
      } else {
        S.trainers.push({ id: uid('r-import-'), name, specialty: specialty || 'Imported trainer', email: email || '', password: '', tone: 'lilac' });
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
        existing ?? { id: uid('t-import-'), name, email: '', password: '', jobRole: 'Trainee', joined: today(), status: 'Active', trainer: '', tone: '' };
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
  } else if (kind === 'users') {
    let invalid = 0;
    let kept = 0;
    for (const row of rows) {
      const email = lc(field(row, 'Email'));
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        invalid++;
        continue;
      }
      const cell = lc(field(row, 'Access', 'Role type', 'User type'));
      const asked: Kind | undefined = cell === 'admin' || cell === 'trainer' || cell === 'trainee' ? cell : undefined;
      const all = [...S.admins, ...S.trainers, ...S.trainees];
      const old = all.find((p) => lc(p.email) === email) as (Partial<Trainer & Trainee> & { id: string; name: string }) | undefined;
      const was: Kind | undefined = !old ? undefined : S.admins.some((a) => a.id === old.id) ? 'admin' : S.trainers.some((t) => t.id === old.id) ? 'trainer' : 'trainee';
      let access: Kind = asked ?? was ?? 'trainee';
      if (was === 'admin' && access !== 'admin' && S.admins.length <= 1) {
        access = 'admin';
        kept++;
      }
      const name = field(row, 'Name') || old?.name || email.split('@')[0];
      const title = field(row, 'Role', 'Specialty', 'Job role') || '';
      const phone = field(row, 'Phone') || old?.phone;
      const id = old?.id ?? uid(access === 'admin' ? 'ad-' : access === 'trainer' ? 'r-' : 't-');
      S.admins = S.admins.filter((p) => p.id !== id);
      S.trainers = S.trainers.filter((p) => p.id !== id);
      S.trainees = S.trainees.filter((p) => p.id !== id);
      const base = { id, name, email, phone: phone || undefined, password: '' };
      if (access === 'admin') S.admins.push(base);
      else if (access === 'trainer') S.trainers.push({ ...base, specialty: title || old?.specialty || '', tone: old?.tone ?? 'lilac' });
      else
        S.trainees.push({
          ...base,
          jobRole: title || old?.jobRole || 'Trainee',
          joined: old?.joined ?? today(),
          status: old?.status ?? 'Active',
          trainer: old?.trainer ?? '',
          tone: old?.tone ?? 'lilac',
        });
      count++;
    }
    if (!count) throw new Error('No valid users found. Each row needs a valid Email column value.');
    return (
      `${count} user${count === 1 ? '' : 's'} imported or updated.` +
      (invalid ? ` ${invalid} rows skipped (missing or invalid email).` : '') +
      (kept ? ' The last admin was not demoted.' : '')
    );
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
