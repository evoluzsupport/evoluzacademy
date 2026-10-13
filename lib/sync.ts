import { supabase } from './supabase';
import type { Admin, Assignment, Course, ProgressRec, Session, State, Trainee, Trainer } from './types';

type Row = Record<string, unknown>;
type Role = 'admin' | 'trainer' | 'trainee';

const nul = (v: string | undefined | null) => (v ? v : null);
const str = (v: unknown) => (v == null ? '' : String(v));

export const emptyState = (): State => ({
  admins: [],
  trainers: [],
  trainees: [],
  courses: [],
  assignments: [],
  progress: {},
  sessions: [],
  study: {},
});

interface Table {
  name: string;
  pk: string[];
  order: string[];
  rows: (s: State) => Row[];
}

const person = (p: { id: string; name: string; email: string; phone?: string }, role: Role, extra: Row): Row => ({
  id: p.id,
  email: nul(p.email.trim().toLowerCase()),
  name: p.name,
  role,
  phone: nul(p.phone),
  tone: '',
  specialty: null,
  job_role: null,
  joined: null,
  status: 'Active',
  trainer_name: null,
  ...extra,
});

// Parents first: inserts run in this order, deletes in reverse.
const TABLES: Table[] = [
  {
    name: 'profiles',
    pk: ['id'],
    order: ['created_at', 'id'],
    rows: (s) => [
      ...s.admins.map((a) => person(a, 'admin', {})),
      ...s.trainers.map((t) => person(t, 'trainer', { tone: t.tone, specialty: nul(t.specialty) })),
      ...s.trainees.map((t) =>
        person(t, 'trainee', {
          tone: t.tone,
          job_role: nul(t.jobRole),
          joined: nul(t.joined),
          status: t.status,
          trainer_name: nul(t.trainer),
        })
      ),
    ],
  },
  {
    name: 'courses',
    pk: ['id'],
    order: ['id'],
    rows: (s) =>
      s.courses.map((c) => ({
        id: c.id,
        name: c.name,
        group: c.group,
        duration: c.duration,
        primary_trainer: c.primaryTrainer,
        extra_days: c.extraDays,
      })),
  },
  {
    name: 'topics',
    pk: ['id'],
    order: ['course_id', 'position'],
    rows: (s) =>
      s.courses.flatMap((c) =>
        c.topics.map((t, i) => ({
          id: t.id,
          course_id: c.id,
          day: t.day,
          trainer: t.trainer,
          topic: t.topic,
          category: t.category ?? '',
          cover: t.cover,
          activity: t.activity,
          position: i,
        }))
      ),
  },
  {
    name: 'assignments',
    pk: ['id'],
    order: ['id'],
    rows: (s) =>
      s.assignments.map((a) => ({
        id: a.id,
        trainee_id: a.traineeId,
        course_id: a.courseId,
        assigned_on: nul(a.assignedOn),
        due: nul(a.due),
        trainer: a.trainer ?? '',
      })),
  },
  {
    name: 'sessions',
    pk: ['id'],
    order: ['created_at', 'id'],
    rows: (s) =>
      s.sessions.map((x) => ({
        id: x.id,
        course_id: x.courseId,
        course_name: x.courseName,
        date: x.date,
        trainer: x.trainer,
        new_marks: x.newMarks,
        existing_preserved: x.existingPreserved,
      })),
  },
  {
    name: 'session_trainees',
    pk: ['session_id', 'trainee_id'],
    order: ['session_id', 'trainee_id'],
    rows: (s) => s.sessions.flatMap((x) => x.traineeIds.map((t) => ({ session_id: x.id, trainee_id: t }))),
  },
  {
    name: 'session_topics',
    pk: ['session_id', 'topic_id'],
    order: ['session_id', 'topic_id'],
    rows: (s) => s.sessions.flatMap((x) => x.topicIds.map((t) => ({ session_id: x.id, topic_id: t }))),
  },
  {
    name: 'progress',
    pk: ['trainee_id', 'course_id', 'topic_id'],
    order: ['trainee_id', 'course_id', 'topic_id'],
    rows: (s) =>
      Object.entries(s.progress).map(([k, r]) => {
        const [trainee_id, course_id, topic_id] = k.split('|');
        return { trainee_id, course_id, topic_id, done_on: r.date, trainer: r.trainer, session_id: r.sessionId ?? null };
      }),
  },
  {
    name: 'self_study',
    pk: ['user_id', 'course_id', 'topic_id'],
    order: ['user_id', 'course_id', 'topic_id'],
    rows: (s) =>
      Object.entries(s.study).map(([k, r]) => {
        const [user_id, course_id, topic_id] = k.split('|');
        return { user_id, course_id, topic_id, done_on: r.date };
      }),
  },
];

const keyOf = (t: Table, r: Row) => t.pk.map((c) => String(r[c])).join('|');
const pkOf = (t: Table, r: Row) => Object.fromEntries(t.pk.map((c) => [c, r[c]]));
const CHUNK = 400;

function fail(op: string, table: string, error: { message: string } | null) {
  if (error) throw new Error(`${op} ${table}: ${error.message}`);
}

/** Writes only what changed between two states. */
export async function pushDiff(prev: State, next: State): Promise<void> {
  const plan = TABLES.map((t) => {
    const before = new Map(t.rows(prev).map((r) => [keyOf(t, r), r]));
    const after = new Map(t.rows(next).map((r) => [keyOf(t, r), r]));
    const inserts: Row[] = [];
    const updates: Row[] = [];
    const deletes: Row[] = [];
    after.forEach((r, k) => {
      const old = before.get(k);
      if (!old) inserts.push(r);
      else if (JSON.stringify(old) !== JSON.stringify(r)) updates.push(r);
    });
    before.forEach((r, k) => !after.has(k) && deletes.push(r));
    return { t, inserts, updates, deletes };
  });

  for (const { t, inserts, updates } of plan) {
    if (t.name === 'profiles') {
      // keep directory order stable: created_at follows insertion order
      const base = Date.now();
      inserts.forEach((r, i) => (r.created_at = new Date(base + i).toISOString()));
    }
    for (let i = 0; i < inserts.length; i += CHUNK) {
      const { error } = await supabase.from(t.name).insert(inserts.slice(i, i + CHUNK));
      fail('insert', t.name, error);
    }
    for (const r of updates) {
      const { error } = await supabase.from(t.name).update(r).match(pkOf(t, r));
      fail('update', t.name, error);
    }
  }
  for (const { t, deletes } of [...plan].reverse()) {
    for (const r of deletes) {
      const { error } = await supabase.from(t.name).delete().match(pkOf(t, r));
      fail('delete', t.name, error);
    }
  }
}

/** First-run: copy a whole state into an empty database (idempotent upserts, admin only). */
export async function seedRemote(state: State): Promise<void> {
  for (const t of TABLES) {
    const rows = t.rows(state);
    if (t.name === 'profiles') {
      const base = Date.now();
      rows.forEach((r, i) => (r.created_at = new Date(base + i).toISOString()));
    }
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase.from(t.name).upsert(rows.slice(i, i + CHUNK), { onConflict: t.pk.join(',') });
      fail('seed', t.name, error);
    }
  }
}

async function fetchAll(t: Table): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(t.name).select('*');
    for (const o of t.order) q = q.order(o);
    const { data, error } = await q.range(from, from + 999);
    fail('load', t.name, error);
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function loadRemote(): Promise<State> {
  const [profiles, courses, topics, assignments, sessions, sTrainees, sTopics, progress, study] = await Promise.all(
    TABLES.map(fetchAll)
  );
  const s = emptyState();

  for (const p of profiles) {
    const base = { id: str(p.id), name: str(p.name), email: str(p.email), phone: p.phone ? str(p.phone) : undefined, password: '' };
    if (p.role === 'admin') s.admins.push(base as Admin);
    else if (p.role === 'trainer')
      s.trainers.push({ ...base, specialty: str(p.specialty), tone: str(p.tone) } as Trainer);
    else
      s.trainees.push({
        ...base,
        jobRole: str(p.job_role),
        joined: str(p.joined),
        status: p.status === 'On hold' ? 'On hold' : 'Active',
        trainer: str(p.trainer_name),
        tone: str(p.tone),
      } as Trainee);
  }

  const byCourse = new Map<string, Course['topics']>();
  for (const t of topics) {
    const list = byCourse.get(str(t.course_id)) ?? [];
    list.push({
      id: str(t.id),
      day: str(t.day),
      trainer: str(t.trainer),
      topic: str(t.topic),
      category: str(t.category),
      cover: str(t.cover),
      activity: str(t.activity),
    });
    byCourse.set(str(t.course_id), list);
  }
  s.courses = courses.map((c) => ({
    id: str(c.id),
    name: str(c.name),
    group: str(c.group),
    duration: str(c.duration),
    primaryTrainer: str(c.primary_trainer),
    topics: byCourse.get(str(c.id)) ?? [],
    extraDays: (c.extra_days as string[] | null) ?? [],
  }));

  s.assignments = assignments.map(
    (a): Assignment => ({
      id: str(a.id),
      traineeId: str(a.trainee_id),
      courseId: str(a.course_id),
      assignedOn: str(a.assigned_on),
      due: str(a.due),
      trainer: str(a.trainer),
    })
  );

  const trainees = new Map<string, string[]>();
  for (const r of sTrainees) trainees.set(str(r.session_id), [...(trainees.get(str(r.session_id)) ?? []), str(r.trainee_id)]);
  const tps = new Map<string, string[]>();
  for (const r of sTopics) tps.set(str(r.session_id), [...(tps.get(str(r.session_id)) ?? []), str(r.topic_id)]);
  s.sessions = sessions.map(
    (x): Session => ({
      id: str(x.id),
      courseId: str(x.course_id),
      courseName: str(x.course_name),
      date: str(x.date),
      trainer: str(x.trainer),
      traineeIds: trainees.get(str(x.id)) ?? [],
      topicIds: tps.get(str(x.id)) ?? [],
      newMarks: Number(x.new_marks) || 0,
      existingPreserved: Number(x.existing_preserved) || 0,
    })
  );

  for (const r of progress) {
    const rec: ProgressRec = { done: true, date: str(r.done_on), trainer: str(r.trainer) };
    if (r.session_id) rec.sessionId = str(r.session_id);
    s.progress[`${r.trainee_id}|${r.course_id}|${r.topic_id}`] = rec;
  }
  for (const r of study) s.study[`${r.user_id}|${r.course_id}|${r.topic_id}`] = { date: str(r.done_on) };
  return s;
}

/** The signed-in person's directory row, or null if their email was never added. */
export async function myProfile(authUserId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id,name,email,phone,role')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (data) return data;
  // not linked yet: link by email, or create a trainee for a new company email
  const made = await supabase.rpc('ensure_profile');
  if (made.error) throw new Error(made.error.message);
  const p = made.data as { id: string; name: string; email: string | null; phone: string | null; role: string };
  return p ? { id: p.id, name: p.name, email: p.email, phone: p.phone, role: p.role } : null;
}
