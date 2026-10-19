import raw from './curriculum.json';
import type { Assignment, Course, ProgressRec, State, Trainee, Trainer } from './types';
import { dayNumber, daySort } from './util';

type RawCourse = {
  id: string;
  name: string;
  group: string;
  duration: string;
  trainer: string;
  topics: { day: string; trainer: string; topic: string; cover: string; activity: string }[];
};

const firstName = (v: string) => String(v || 'Project Manager').split(/[/,]/)[0].trim() || 'Project Manager';

export const NO_TRAINER = 'No Trainer Assigned';

/** A course (or assignment) can have several trainers, stored as "A / B". */
export const splitTrainers = (v?: string): string[] =>
  String(v || '')
    .split(/\s*\/\s*/)
    .map((x) => x.trim())
    .filter((x) => x && x !== NO_TRAINER);
export const joinTrainers = (names: string[]) => names.join(' / ') || NO_TRAINER;
export const courseTrainers = (c?: Pick<Course, 'primaryTrainer'>) => splitTrainers(c?.primaryTrainer);
/** The first trainer, for places that need one name (e.g. a default "delivered by"). */
export const firstTrainer = (c?: Pick<Course, 'primaryTrainer'>) => courseTrainers(c)[0] || NO_TRAINER;
/** Replace one trainer's name inside a "A / B" list, keeping the others. */
export const renameTrainer = (list: string | undefined, from: string, to: string) =>
  joinTrainers(splitTrainers(list).map((n) => (n === from ? to : n)));

export const primaryOf = (c?: Pick<Course, 'primaryTrainer'>) => c?.primaryTrainer || 'No Trainer Assigned';

export function curriculum(): Course[] {
  return (raw as RawCourse[]).map((c) => {
    const topics = c.topics.map((t, i) => ({ ...t, id: `${c.id}-t${i + 1}` }));
    const extraDays = [...new Set(topics.map((t) => dayNumber(t.day)).filter((n) => n > 90).map((n) => 'Day ' + n))].sort(daySort);
    return { id: c.id, name: c.name, group: c.group, duration: c.duration, primaryTrainer: firstName(c.trainer), topics, extraDays };
  });
}

const trainer = (id: string, name: string, specialty: string, email: string, tone: string): Trainer => ({
  id,
  name,
  specialty,
  email,
  password: 'demo123',
  tone,
});

export function makeSeed(): State {
  const courses = curriculum();
  const trainers: Trainer[] = [
    trainer('r1', 'Shivangi', 'Zoho CRM', 'shivangi@evoluz.tech', ''),
    trainer('r2', 'Deepanshu', 'Zoho Creator', 'deepanshu@evoluz.tech', 'coral'),
    trainer('r3', 'Jyoti', 'Project coordination · CRM', 'jyoti@evoluz.tech', 'mint'),
    trainer('r4', 'Shivam', 'Zoho People', 'shivam@evoluz.tech', 'lilac'),
  ];
  (
    [
      ['Project Manager', 'Common onboarding'],
      ['Harsh', 'Zoho Creator'],
      ['Yogesh', 'Zoho Desk'],
      ['Nitin', 'Zoho Books'],
      ['Project Coordinator', 'Project coordination'],
      ['Senior Developer', 'Project coordination'],
      ['Senior Project Coordinator', 'Project coordination'],
    ] as const
  ).forEach(([name, specialty]) =>
    trainers.push(trainer('r-' + name.toLowerCase().replaceAll(' ', '-'), name, specialty, '', 'lilac'))
  );

  const mk = (id: string, name: string, jobRole: string, joined: string, status: Trainee['status'], tone: string, tr: string): Trainee => ({
    id,
    name,
    email: name.toLowerCase().replace(' ', '.') + '@evoluz.tech',
    password: 'demo123',
    jobRole,
    joined,
    status,
    trainer: tr,
    tone,
  });
  const trainees = [
    mk('t1', 'Mira Shah', 'CRM Consultant', '2026-09-22', 'Active', '', 'Shivangi'),
    mk('t2', 'Arjun Mehta', 'Creator Developer', '2026-09-29', 'Active', 'coral', 'Deepanshu'),
    mk('t3', 'Sana Iyer', 'Project Coordinator', '2026-10-01', 'Active', 'mint', 'Jyoti'),
    mk('t4', 'Kabir Patel', 'CRM Consultant', '2026-09-15', 'On hold', 'lilac', 'Shivangi'),
  ];

  const plan: [string, string, number][] = [
    ['t1', '03-basic-zoho', 11], ['t1', '05-zoho-crm', 7],
    ['t2', '03-basic-zoho', 17], ['t2', '06-zoho-creator', 8],
    ['t3', '03-basic-zoho', 8], ['t3', 'pc-training', 16],
    ['t4', '03-basic-zoho', 10], ['t4', '05-zoho-crm', 3],
  ];
  const assignments: Assignment[] = [];
  const progress: Record<string, ProgressRec> = {};
  plan.forEach(([tid, cid, count], n) => {
    const t = trainees.find((x) => x.id === tid)!;
    const c = courses.find((x) => x.id === cid)!;
    assignments.push({ id: 'a' + (n + 1), traineeId: tid, courseId: cid, assignedOn: t.joined, due: '' });
    const lead = tid === 't4' && cid === '05-zoho-crm' ? 'Jyoti' : firstTrainer(c);
    for (let i = 0; i < count; i++) {
      progress[`${tid}|${cid}|${c.topics[i].id}`] = {
        done: true,
        date: new Date(Date.now() - (count - i) * 86400000).toISOString().slice(0, 10),
        trainer: lead,
      };
    }
  });

  return {
    admins: [{ id: 'ad1', name: 'Admin · Evoluz', email: 'admin@evoluz.tech', password: 'demo@123' }],
    trainers,
    trainees,
    users: [],
    courses,
    assignments,
    progress,
    sessions: [],
  };
}
