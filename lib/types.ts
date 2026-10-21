export type Kind = 'admin' | 'trainer' | 'trainee';
export type Group = 'Common' | 'Zoho apps' | 'Role-based';

export interface Topic {
  id: string;
  day: string;
  trainer: string;
  topic: string;
  /** optional grouping from the training manual, e.g. "Setup" */
  category?: string;
  cover: string;
  activity: string;
}
export interface Course {
  id: string;
  name: string;
  group: string;
  duration: string;
  primaryTrainer: string;
  topics: Topic[];
  /** planned days above 90 that stay selectable */
  extraDays: string[];
}
export interface Admin {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}
/** A person in the user directory who is not (yet) a trainee or trainer. Access comes from the trainee/trainer lists. */
export interface AppUser {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
}
export interface Trainer {
  id: string;
  name: string;
  specialty: string;
  email: string;
  password: string;
  phone?: string;
  tone: string;
}
export interface Trainee {
  id: string;
  name: string;
  email: string;
  password: string;
  jobRole: string;
  joined: string;
  status: 'Active' | 'On hold';
  /** training contact (trainer name) */
  trainer: string;
  tone: string;
  phone?: string;
}
export interface Assignment {
  id: string;
  traineeId: string;
  courseId: string;
  assignedOn: string;
  /** when the learner is due to start the course */
  startDate?: string;
  due: string;
  /** trainer responsible for this learner on this course */
  trainer?: string;
}
export interface ProgressRec {
  done: true;
  date: string;
  trainer: string;
  sessionId?: string;
}
export interface Session {
  id: string;
  courseId: string;
  courseName: string;
  date: string;
  trainer: string;
  traineeIds: string[];
  topicIds: string[];
  newMarks: number;
  existingPreserved: number;
}
export interface Question {
  id: string;
  text: string;
  options: string[];
  /** index of the correct option; -1 when the answer key is hidden (trainees never receive it) */
  answer: number;
  marks: number;
}
export interface Assessment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  /** 60 to 90 minutes */
  durationMin: number;
  createdBy: string;
  questions: Question[];
}
export interface AssessmentAssign {
  id: string;
  assessmentId: string;
  traineeId: string;
  assignedOn: string;
  due: string;
  status: 'assigned' | 'in-progress' | 'submitted';
  startedAt: string;
  submittedAt: string;
  score: number | null;
  total: number | null;
  /** question id to chosen option index */
  answers: Record<string, number>;
}
export interface State {
  admins: Admin[];
  trainers: Trainer[];
  trainees: Trainee[];
  /** directory entries not yet enrolled as trainee or trainer */
  users: AppUser[];
  courses: Course[];
  assignments: Assignment[];
  /** key: `${traineeId}|${courseId}|${topicId}` */
  progress: Record<string, ProgressRec>;
  sessions: Session[];
  assessments: Assessment[];
  assessmentAssigns: AssessmentAssign[];
}
export interface Me {
  kind: Kind;
  id: string;
  name: string;
  email: string;
  phone?: string;
  /** signed in but not yet made a trainee, trainer or admin: sees only the "request sent" screen */
  pending?: boolean;
}
