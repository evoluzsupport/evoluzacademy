'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Kind, Me, State, Trainee, Trainer } from './types';
import { removedEmail } from './emails';
import { sendAccessRequestMail, sendAll } from './mailer';
import { emptyState, loadRemote, myProfile, pushDiff } from './sync';
import { applyImport } from './importers';
import { parseCSV, type ImportKind } from './csv';
import { uid, today, validPastOrToday } from './util';
import { canEditCompletion, isAssigned, nameMatches, topicKey } from './selectors';
import { renameTrainer } from './seed';
import { supabase } from './supabase';

interface ModalState {
  content: ReactNode;
  wide: boolean;
}

export interface SessionDraft {
  courseId: string;
  trainer: string;
  date: string;
  traineeIds: string[];
  topicIds: string[];
  updateExisting: boolean;
  /** who is saving it: other people's completed topics are never overwritten unless they are an admin */
  by?: { name: string; admin: boolean };
}

export interface UserDraft {
  name: string;
  email: string;
  phone: string;
}

export interface Ctx {
  ready: boolean;
  S: State;
  me: Me | null;
  /** one-time congratulations shown when a pending person is given access */
  congrats: string;
  clearCongrats: () => void;
  /** why the last sign-in was refused (e.g. not authorized); shown on the login screen */
  authError: string;
  clearAuthError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithZoho: () => Promise<string | null>;
  logout: () => void;
  update: (fn: (s: State) => void) => void;
  /** reload everything from the database (e.g. after a trainee submits an assessment) */
  refresh: () => Promise<void>;
  toast: (m: string) => void;
  toastMsg: string;
  modal: ModalState | null;
  openModal: (content: ReactNode, wide?: boolean) => void;
  closeModal: () => void;
  confirm: (msg: string, onYes: () => void, yes?: string) => void;
  // domain actions
  toggleTopic: (tid: string, cid: string, topicId: string, trainer: string, date: string) => void;
  patchCompletion: (tid: string, cid: string, topicId: string, patch: { date?: string; trainer?: string }) => void;
  assign: (traineeId: string, courseId: string, due?: string, trainer?: string, startDate?: string) => boolean;
  unassign: (assignmentId: string) => void;
  saveSession: (d: SessionDraft) => string | null;
  undoSession: (id: string) => void;
  removeTrainee: (id: string) => void;
  removeTrainees: (ids: string[]) => void;
  removeTrainers: (ids: string[]) => void;
  removeCourse: (id: string) => void;
  removeCourses: (ids: string[]) => void;
  removeTopic: (cid: string, topicId: string) => void;
  setRole: (id: string, role: Kind, title?: string) => boolean;
  saveUser: (id: string | null, u: UserDraft) => string | null;
  removeUser: (id: string) => void;
  addPeople: (people: { name: string; email: string }[]) => { added: number; skipped: string[] };
  importCSV: (kind: ImportKind, file: File, courseId?: string) => Promise<void>;
}

/** Removes the assessments of the given courses together with their assignments and results. */
function dropAssessments(s: State, courseIds: Set<string>) {
  const gone = new Set(s.assessments.filter((a) => courseIds.has(a.courseId)).map((a) => a.id));
  s.assessments = s.assessments.filter((a) => !gone.has(a.id));
  s.assessmentAssigns = s.assessmentAssigns.filter((a) => !gone.has(a.assessmentId));
}

const PortalCtx = createContext<Ctx | null>(null);

/** Marks the draft's topics for its attendees; returns the toast text, or null if nothing valid to save. */
function applySession(s: State, d: SessionDraft): string | null {
  const c = s.courses.find((x) => x.id === d.courseId);
  // anyone in the directory can attend; people not yet on the course are assigned to it
  const known = new Set([...s.admins, ...s.trainers, ...s.trainees].map((p) => p.id));
  const attendees = d.traineeIds.filter((tid) => known.has(tid));
  if (!c || !attendees.length || !d.topicIds.length) return null;
  for (const tid of attendees)
    if (!isAssigned(s, tid, c.id)) s.assignments.push({ id: uid('a'), traineeId: tid, courseId: c.id, assignedOn: today(), due: '' });
  const id = uid('s');
  let newMarks = 0;
  let kept = 0;
  for (const topicId of d.topicIds)
    for (const tid of attendees) {
      const key = topicKey(tid, c.id, topicId);
      const cur = s.progress[key];
      if (cur?.done && (!d.updateExisting || (d.by && !d.by.admin && !nameMatches(cur.trainer, d.by.name)))) {
        kept++;
        continue;
      }
      s.progress[key] = { done: true, date: d.date, trainer: d.trainer, sessionId: id };
      newMarks++;
    }
  s.sessions.push({
    id,
    courseId: c.id,
    courseName: c.name,
    date: d.date,
    trainer: d.trainer,
    traineeIds: attendees,
    topicIds: [...d.topicIds],
    newMarks,
    existingPreserved: kept,
  });
  return `Session saved · ${newMarks} topic marks${kept ? ` · ${kept} existing marks preserved` : ''}`;
}

function findMe(S: State, kind: Kind, id: string): Me | null {
  const pool = kind === 'admin' ? S.admins : kind === 'trainer' ? S.trainers : S.trainees;
  const x = pool.find((p) => p.id === id);
  return x ? { kind, id: x.id, name: x.name, email: x.email, phone: x.phone } : null;
}

/** Takes people off the trainee and trainer lists but keeps them in the user directory (name, email, phone). */
function keepAsUser(s: State, ids: string[]) {
  const gone = new Set(ids);
  for (const p of [...s.trainees, ...s.trainers].filter((x) => gone.has(x.id)))
    if (!s.users.some((u) => u.id === p.id)) s.users.push({ id: p.id, name: p.name, email: p.email, phone: p.phone, password: '' });
  s.trainees = s.trainees.filter((t) => !gone.has(t.id));
  s.trainers = s.trainers.filter((t) => !gone.has(t.id));
}

const NOT_AUTHORIZED = 'We could not set up your account. Please contact Evoluz Academy.';

export function PortalProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [S, setS] = useState<State>(() => emptyState());
  const [remoteMe, setRemoteMe] = useState<Me | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [authError, setAuthError] = useState('');
  const [congrats, setCongrats] = useState('');

  // Remember that this person was waiting for access; when an admin later gives them access, say congratulations once.
  const noteAccess = useCallback((id: string, pending: boolean) => {
    try {
      const k = `evoluzPending:${id}`;
      if (pending) {
        if (!localStorage.getItem(k)) {
          localStorage.setItem(k, '1');
          void sendAccessRequestMail();
        }
      }
      else if (localStorage.getItem(k)) {
        localStorage.removeItem(k);
        setCongrats('Congratulations! You now have access to Evoluz Academy. Welcome aboard.');
      }
    } catch {}
  }, []);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // latest state, updated synchronously so back-to-back updates compose
  const S0 = useRef(S);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const bootedFor = useRef<string | null>(null);
  const myId = useRef<string | null>(null);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2600);
  }, []);

  const adopt = useCallback((next: State) => {
    S0.current = next;
    setS(next);
  }, []);

  const reload = useCallback(async () => {
    try {
      // if this tab's session was ended elsewhere, say so instead of showing an empty app
      const { data: who, error: whoErr } = await supabase.auth.getUser();
      if (whoErr || !who.user) {
        if (bootedFor.current) {
          setToastMsg('Your session ended. Please sign in again.');
          await supabase.auth.signOut({ scope: 'local' });
        }
        return;
      }
      // an admin may have changed this person's access: pick up the new role
      const uid = bootedFor.current;
      const p = uid ? await myProfile(uid) : null;
      if (!p?.pending) adopt(await loadRemote());
      if (uid && !p) {
        bootedFor.current = null;
        setAuthError(NOT_AUTHORIZED);
        await supabase.auth.signOut({ scope: 'local' });
        return;
      }
      if (p) {
        noteAccess(p.id, p.pending);
        setRemoteMe((cur) =>
          cur && cur.kind === p.role && cur.name === p.name && !!cur.pending === p.pending
            ? cur
            : { kind: p.role as Kind, id: p.id, name: p.name, email: p.email ?? '', phone: p.phone ?? undefined, pending: p.pending }
        );
      }
    } catch {}
  }, [adopt]);

  // Supabase holds the session; the `profiles` row carries the role.
  useEffect(() => {
    const boot = async (userId: string) => {
      if (bootedFor.current === userId) return;
      bootedFor.current = userId;
      try {
        let p;
        try {
          p = await myProfile(userId);
        } catch (e) {
          bootedFor.current = null;
          toast(e instanceof Error ? e.message : 'Could not set up your account');
          await supabase.auth.signOut({ scope: 'local' });
          return;
        }
        if (!p) {
          bootedFor.current = null;
          setAuthError(NOT_AUTHORIZED);
          await supabase.auth.signOut({ scope: 'local' });
          return;
        }
        if (!p.pending) adopt(await loadRemote());
        noteAccess(p.id, p.pending);
        setRemoteMe({ kind: p.role as Kind, id: p.id, name: p.name, email: p.email ?? '', phone: p.phone ?? undefined, pending: p.pending });
      } catch (e) {
        bootedFor.current = null;
        toast(e instanceof Error ? e.message : 'Could not load data');
      } finally {
        setReady(true);
      }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // never await supabase calls inside this callback
      setTimeout(() => {
        if (session?.user) void boot(session.user.id);
        else {
          bootedFor.current = null;
          setRemoteMe(null);
          adopt(emptyState());
          setReady(true);
        }
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [adopt, toast]);

  // Pick up other people's changes when this tab regains focus.
  useEffect(() => {
    let last = 0;
    const onFocus = () => {
      if (!bootedFor.current || Date.now() - last < 10000) return;
      last = Date.now();
      queue.current = queue.current.then(reload);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [reload]);

  const me = useMemo(
    () => (remoteMe ? findMe(S, remoteMe.kind, remoteMe.id) ?? remoteMe : null),
    [S, remoteMe]
  );
  myId.current = remoteMe?.id ?? null;
  const meRef = useRef(me);
  meRef.current = me;

  const update = useCallback(
    (fn: (s: State) => void) => {
      const prev = S0.current;
      const next = structuredClone(prev);
      fn(next);
      adopt(next);
      queue.current = queue.current
        .then(() => pushDiff(prev, next))
        .catch(async (e) => {
          toast(`Could not save: ${e instanceof Error ? e.message : 'unknown error'}`);
          await reload();
        });
    },
    [adopt, toast, reload]
  );

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.user) return false;
    // hold the app in its loading state until the profile and data arrive, so it never bounces back
    if (bootedFor.current !== data.user.id) setReady(false);
    return true;
  }, []);

  const loginWithZoho = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'custom:evoluzacademy' as never,
      options: { redirectTo: `${window.location.origin}/login` },
    });
    return error ? error.message : null;
  }, []);

  const logout = useCallback(() => {
    void supabase.auth.signOut({ scope: 'local' });
    setModal(null);
  }, []);

  const closeModal = useCallback(() => setModal(null), []);
  const openModal = useCallback((content: ReactNode, wide = false) => setModal({ content, wide }), []);
  const confirm = useCallback(
    (msg: string, onYes: () => void, yes = 'Yes, continue') =>
      setModal({
        wide: false,
        content: (
          <>
            <h2>Please confirm</h2>
            <p>{msg}</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  setModal(null);
                  onYes();
                }}
              >
                {yes}
              </button>
            </div>
          </>
        ),
      }),
    []
  );

  const actions = useMemo(() => {
    const toggleTopic: Ctx['toggleTopic'] = (tid, cid, topicId, trainer, date) => {
      const key = topicKey(tid, cid, topicId);
      const rec0 = S0.current.progress[key];
      if (rec0?.done && !canEditCompletion(meRef.current, rec0)) {
        toast(`Only ${rec0.trainer} (or an admin) can change this topic`);
        return;
      }
      if (!rec0?.done && !validPastOrToday(date)) {
        toast('Choose today or an earlier date');
        return;
      }
      update((s) => {
        if (s.progress[key]?.done) delete s.progress[key];
        else s.progress[key] = { done: true, date, trainer };
      });
    };

    const patchCompletion: Ctx['patchCompletion'] = (tid, cid, topicId, patch) => {
      const rec0 = S0.current.progress[topicKey(tid, cid, topicId)];
      if (rec0?.done && !canEditCompletion(meRef.current, rec0)) {
        toast(`Only ${rec0.trainer} (or an admin) can change this topic`);
        return;
      }
      if (patch.date !== undefined && !validPastOrToday(patch.date)) {
        toast('Future dates are not allowed');
        return;
      }
      update((s) => {
        const r = s.progress[topicKey(tid, cid, topicId)];
        if (r?.done) Object.assign(r, patch);
      });
    };

    const assign: Ctx['assign'] = (traineeId, courseId, due = '', trainer = '', startDate = '') => {
      if (isAssigned(S0.current, traineeId, courseId)) return false;
      update((s) => {
        s.assignments.push({ id: uid('a'), traineeId, courseId, assignedOn: today(), startDate, due, trainer });
      });
      return true;
    };

    const unassign: Ctx['unassign'] = (assignmentId) =>
      update((s) => {
        s.assignments = s.assignments.filter((a) => a.id !== assignmentId);
      });

    const saveSession: Ctx['saveSession'] = (d) => {
      const probe = structuredClone(S0.current);
      const msg = applySession(probe, d);
      if (!msg) return null;
      update((s) => {
        applySession(s, d);
      });
      return msg;
    };

    const undoSession: Ctx['undoSession'] = (id) => {
      update((s) => {
        for (const [k, r] of Object.entries(s.progress)) if (r.sessionId === id) delete s.progress[k];
        s.sessions = s.sessions.filter((x) => x.id !== id);
      });
      toast('Session undone · its marks were removed');
    };

    // tell removed trainees and trainers by email (the admin's session sends it)
    const mailRemoved = (ids: string[]) => {
      const cur = S0.current;
      const mails = ids.flatMap((id) => {
        const t = cur.trainees.find((x) => x.id === id);
        const r = cur.trainers.find((x) => x.id === id);
        const who = t ?? r;
        return who && who.email ? [removedEmail({ origin: window.location.origin, name: who.name, email: who.email, role: t ? 'Trainee' : 'Trainer' })] : [];
      });
      if (mails.length) void sendAll(mails, toast, 'Removal notice');
    };

    const removeTrainee: Ctx['removeTrainee'] = (id) => {
      mailRemoved([id]);
      update((s) => {
        keepAsUser(s, [id]);
        s.assignments = s.assignments.filter((a) => a.traineeId !== id);
        for (const k of Object.keys(s.progress)) if (k.startsWith(id + '|')) delete s.progress[k];
      });
      toast('Trainee removed. They stay in the user list.');
    };

    const removeTrainees: Ctx['removeTrainees'] = (ids) => {
      mailRemoved(ids);
      const gone = new Set(ids);
      update((s) => {
        keepAsUser(s, ids);
        s.assignments = s.assignments.filter((a) => !gone.has(a.traineeId));
        for (const k of Object.keys(s.progress)) if (gone.has(k.split('|')[0])) delete s.progress[k];
      });
      toast(`${ids.length} ${ids.length === 1 ? 'trainee' : 'trainees'} removed`);
    };

    const removeTrainers: Ctx['removeTrainers'] = (ids) => {
      mailRemoved(ids);
      const gone = new Set(ids);
      update((s) => {
        keepAsUser(s, ids);
      });
      toast(`${ids.length} ${ids.length === 1 ? 'trainer' : 'trainers'} removed. They stay in the user list.`);
    };

    const removeCourse: Ctx['removeCourse'] = (id) => {
      update((s) => {
        s.courses = s.courses.filter((c) => c.id !== id);
        dropAssessments(s, new Set([id]));
        s.assignments = s.assignments.filter((a) => a.courseId !== id);
        for (const k of Object.keys(s.progress)) if (k.split('|')[1] === id) delete s.progress[k];
      });
      toast('Course removed');
    };

    const removeCourses: Ctx['removeCourses'] = (ids) => {
      const gone = new Set(ids);
      update((s) => {
        s.courses = s.courses.filter((c) => !gone.has(c.id));
        dropAssessments(s, gone);
        s.assignments = s.assignments.filter((a) => !gone.has(a.courseId));
        for (const k of Object.keys(s.progress)) if (gone.has(k.split('|')[1])) delete s.progress[k];
        s.sessions = s.sessions.filter((x) => !gone.has(x.courseId));
      });
      toast(`${ids.length} ${ids.length === 1 ? 'course' : 'courses'} removed`);
    };

    const removeTopic: Ctx['removeTopic'] = (cid, topicId) => {
      update((s) => {
        const c = s.courses.find((x) => x.id === cid);
        if (!c) return;
        c.topics = c.topics.filter((t) => t.id !== topicId);
        for (const k of Object.keys(s.progress)) if (k.endsWith('|' + cid + '|' + topicId)) delete s.progress[k];
      });
      toast('Topic removed');
    };

    const importCSV: Ctx['importCSV'] = async (kind, file, courseId = '') => {
      try {
        const rows = parseCSV(await file.text());
        let message = '';
        // dry-run on a copy so a bad file never half-applies
        const probe = structuredClone(S0.current);
        message = applyImport(probe, kind, rows, courseId);
        update((s) => {
          applyImport(s, kind, rows, courseId);
        });
        toast(message);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not import this CSV file');
      }
    };

    // Move a person between the directory, trainee and trainer lists (one record, never duplicated).
    const setRole: Ctx['setRole'] = (id, role, title = '') => {
      const cur = S0.current;
      const all = [...cur.admins, ...cur.trainers, ...cur.trainees, ...cur.users];
      const who = all.find((p) => p.id === id);
      if (!who) return false;
      const was: Kind | 'user' = cur.admins.some((a) => a.id === id)
        ? 'admin'
        : cur.trainers.some((t) => t.id === id)
          ? 'trainer'
          : cur.users.some((u) => u.id === id)
            ? 'user'
            : 'trainee';
      if (was === role) return true;
      if (id === myId.current) {
        toast('You cannot change your own access. Ask another admin.');
        return false;
      }
      if (was === 'admin' && cur.admins.length <= 1) {
        toast('There must be at least one admin');
        return false;
      }
      update((s) => {
        s.admins = s.admins.filter((p) => p.id !== id);
        s.trainers = s.trainers.filter((p) => p.id !== id);
        s.trainees = s.trainees.filter((p) => p.id !== id);
        s.users = s.users.filter((p) => p.id !== id);
        const base = { id, name: who.name, email: who.email, phone: who.phone, password: '' };
        const old = who as Partial<Trainer & Trainee>;
        if (role === 'admin') s.admins.push(base);
        else if (role === 'trainer') s.trainers.push({ ...base, specialty: title.trim() || old.specialty || '', tone: old.tone || 'lilac' });
        else
          s.trainees.push({
            ...base,
            jobRole: title.trim() || old.jobRole || 'Trainee',
            joined: old.joined || today(),
            status: old.status ?? 'Active',
            trainer: old.trainer ?? '',
            tone: old.tone || 'lilac',
          });
      });
      toast(`${who.name} is now ${role === 'admin' ? 'an admin' : 'a ' + role}`);
      return true;
    };

    // Create (id = null) or edit a directory entry: name, email and phone only. Access follows the
    // trainee and trainer lists, so nothing here decides a role.
    const saveUser: Ctx['saveUser'] = (id, u) => {
      const cur = S0.current;
      const name = u.name.trim();
      const email = u.email.trim().toLowerCase();
      if (!name) return 'Please add a name';
      if (!/^\S+@\S+\.\S+$/.test(email)) return 'Please add a valid email';
      const all = [...cur.admins, ...cur.trainers, ...cur.trainees, ...cur.users];
      if (all.some((p) => p.id !== id && p.email.toLowerCase() === email)) return 'That email is already in use';
      const prev = id ? all.find((p) => p.id === id) : undefined;
      const wasTrainer = !!id && cur.trainers.some((t) => t.id === id);
      update((s) => {
        if (!id) {
          s.users.push({ id: uid('u-'), name, email, phone: u.phone.trim() || undefined, password: '' });
          return;
        }
        for (const list of [s.admins, s.trainers, s.trainees, s.users] as { id: string; name: string; email: string; phone?: string }[][]) {
          const p = list.find((x) => x.id === id);
          if (p) Object.assign(p, { name, email, phone: u.phone.trim() || undefined });
        }
        // keep name references in step when a trainer is renamed
        if (prev && prev.name && prev.name !== name && wasTrainer) {
          s.courses.forEach((c) => { c.primaryTrainer = renameTrainer(c.primaryTrainer, prev.name, name); });
          s.trainees.forEach((t) => { if (t.trainer === prev.name) t.trainer = name; });
          Object.values(s.progress).forEach((r) => { if (r.trainer === prev.name) r.trainer = name; });
          s.sessions.forEach((x) => { if (x.trainer === prev.name) x.trainer = name; });
        }
      });
      toast(id ? 'User updated' : 'User added');
      return null;
    };

    const removeUser: Ctx['removeUser'] = (id) => {
      const cur = S0.current;
      if (cur.admins.some((a) => a.id === id) && cur.admins.length <= 1) return toast('There must be at least one admin');
      update((s) => {
        s.admins = s.admins.filter((p) => p.id !== id);
        s.trainers = s.trainers.filter((p) => p.id !== id);
        s.trainees = s.trainees.filter((p) => p.id !== id);
        s.users = s.users.filter((p) => p.id !== id);
        s.assignments = s.assignments.filter((a) => a.traineeId !== id);
        for (const k of Object.keys(s.progress)) if (k.startsWith(id + '|')) delete s.progress[k];
      });
      toast('User removed');
    };

    const addPeople: Ctx['addPeople'] = (people) => {
      const cur = S0.current;
      const taken = new Set([...cur.admins, ...cur.trainers, ...cur.trainees, ...cur.users].map((p) => p.email.toLowerCase()).filter(Boolean));
      const fresh: typeof people = [];
      const skipped: string[] = [];
      for (const p of people) {
        const email = p.email.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email) || taken.has(email)) {
          skipped.push(p.email || p.name);
          continue;
        }
        taken.add(email);
        fresh.push({ ...p, email, name: p.name.trim() || email.split('@')[0] });
      }
      if (fresh.length)
        update((s) => {
          for (const p of fresh) s.users.push({ id: uid('u-'), name: p.name, email: p.email, password: '' });
        });
      return { added: fresh.length, skipped };
    };

    return { toggleTopic, patchCompletion, assign, unassign, saveSession, undoSession, removeTrainee, removeTrainees, removeTrainers, removeCourse, removeCourses, removeTopic, importCSV, setRole, saveUser, removeUser, addPeople };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, toast]);

  const value: Ctx = {
    ready,
    S,
    me,
    login,
    loginWithZoho,
    authError,
    congrats,
    clearCongrats: () => setCongrats(''),
    clearAuthError: () => setAuthError(''),
    logout,
    update,
    refresh: () => {
      queue.current = queue.current.then(reload);
      return queue.current;
    },
    toast,
    toastMsg,
    modal,
    openModal,
    closeModal,
    confirm,
    ...actions,
  };
  return <PortalCtx.Provider value={value}>{children}</PortalCtx.Provider>;
}

export function usePortal(): Ctx {
  const c = useContext(PortalCtx);
  if (!c) throw new Error('usePortal outside provider');
  return c;
}

export const match = (q: string, ...f: (string | undefined)[]) =>
  !q || f.join(' ').toLowerCase().includes(q.toLowerCase());
