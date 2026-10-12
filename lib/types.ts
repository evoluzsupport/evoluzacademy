export type Kind = 'admin' | 'trainer' | 'trainee';
export type Group = 'Common' | 'Zoho apps' | 'Role-based';

export interface Topic {
  id: string;
  day: string;
  trainer: string;
  topic: string;
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
  due: string;
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
export interface State {
  admins: Admin[];
  trainers: Trainer[];
  trainees: Trainee[];
  courses: Course[];
  assignments: Assignment[];
  /** key: `${traineeId}|${courseId}|${topicId}` */
  progress: Record<string, ProgressRec>;
  sessions: Session[];
}
export interface Me {
  kind: Kind;
  id: string;
  name: string;
  email: string;
  phone?: string;
}
