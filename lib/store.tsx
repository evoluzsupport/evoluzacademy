'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Kind, Me, State } from './types';
import { makeSeed } from './seed';
import { applyImport } from './importers';
import { parseCSV, type ImportKind } from './csv';
import { uid, today, validPastOrToday } from './util';
import { isAssigned, topicKey } from './selectors';

const KEY = 'evoluzTrainingState_v2';
const SKEY = 'evoluzSession_v2';

interface Session {
  kind: Kind;
  id: string;
}
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
}

export interface Ctx {
  ready: boolean;
  S: State;
  me: Me | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  update: (fn: (s: State) => void) => void;
  toast: (m: string) => void;
  toastMsg: string;
  modal: ModalState | null;
  openModal: (content: ReactNode, wide?: boolean) => void;
  closeModal: () => void;
  confirm: (msg: string, onYes: () => void, yes?: string) => void;
  // domain actions
  toggleTopic: (tid: string, cid: string, topicId: string, trainer: string, date: string) => void;
  patchCompletion: (tid: string, cid: string, topicId: string, patch: { date?: string; trainer?: string }) => void;
  assign: (traineeId: string, courseId: string, due?: string) => boolean;
  unassign: (assignmentId: string) => void;
  saveSession: (d: SessionDraft) => string | null;
  undoSession: (id: string) => void;
  removeTrainee: (id: string) => void;
  removeCourse: (id: string) => void;
  removeTopic: (cid: string, topicId: string) => void;
  importCSV: (kind: ImportKind, file: File, courseId?: string) => Promise<void>;
  resetDemo: () => void;
}

const PortalCtx = createContext<Ctx | null>(null);

/** Marks the draft's topics for its attendees; returns the toast text, or null if nothing valid to save. */
function applySession(s: State, d: SessionDraft): string | null {
  const c = s.courses.find((x) => x.id === d.courseId);
  const attendees = d.traineeIds.filter((tid) => isAssigned(s, tid, d.courseId));
  if (!c || !attendees.length || !d.topicIds.length) return null;
  const id = uid('s');
  let newMarks = 0;
  let kept = 0;
  for (const topicId of d.topicIds)
    for (const tid of attendees) {
      const key = topicKey(tid, c.id, topicId);
      if (s.progress[key]?.done && !d.updateExisting) {
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

function findMe(S: State, s: Session | null): Me | null {
  if (!s) return null;
  const pool = s.kind === 'admin' ? S.admins : s.kind === 'trainer' ? S.trainers : S.trainees;
  const x = pool.find((p) => p.id === s.id);
  return x ? { kind: s.kind, id: x.id, name: x.name, email: x.email, phone: x.phone } : null;
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [S, setS] = useState<State>(() => makeSeed());
  const [session, setSession] = useState<Session | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let state: State | null = null;
    try {
      state = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {}
    if (!state || !state.courses || !state.trainees) {
      state = makeSeed();
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {}
    }
    setS(state);
    try {
      const s: Session | null = JSON.parse(sessionStorage.getItem(SKEY) || 'null');
      if (s && findMe(state, s)) setSession(s);
    } catch {}
    setReady(true);
  }, []);

  // Keep every open tab in sync: a trainee's tick shows up in the trainer's tab at once.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        const next: State = JSON.parse(e.newValue);
        if (next.courses && next.trainees) setS(next);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const me = useMemo(() => findMe(S, session), [S, session]);

  const update = useCallback((fn: (s: State) => void) => {
    setS((prev) => {
      const next = structuredClone(prev);
      fn(next);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2600);
  }, []);

  const login = useCallback(
    (email: string, password: string) => {
      const em = email.trim().toLowerCase();
      if (!em) return false;
      const pools: [Kind, { id: string; email: string; password: string }[]][] = [
        ['admin', S.admins],
        ['trainer', S.trainers],
        ['trainee', S.trainees],
      ];
      for (const [kind, list] of pools) {
        const f = list.find((x) => x.email.toLowerCase() === em && x.password === password);
        if (f) {
          const s = { kind, id: f.id };
          try {
            sessionStorage.setItem(SKEY, JSON.stringify(s));
          } catch {}
          setSession(s);
          return true;
        }
      }
      return false;
    },
    [S]
  );

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(SKEY);
    } catch {}
    setSession(null);
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

  // latest state for checks that must not depend on lazy updaters
  const S0 = useRef(S);
  S0.current = S;

  const actions = useMemo(() => {
    const toggleTopic: Ctx['toggleTopic'] = (tid, cid, topicId, trainer, date) => {
      const key = topicKey(tid, cid, topicId);
      if (!S0.current.progress[key]?.done && !validPastOrToday(date)) {
        toast('Choose today or an earlier date');
        return;
      }
      update((s) => {
        if (s.progress[key]?.done) delete s.progress[key];
        else s.progress[key] = { done: true, date, trainer };
      });
    };

    const patchCompletion: Ctx['patchCompletion'] = (tid, cid, topicId, patch) => {
      if (patch.date !== undefined && !validPastOrToday(patch.date)) {
        toast('Future dates are not allowed');
        return;
      }
      update((s) => {
        const r = s.progress[topicKey(tid, cid, topicId)];
        if (r?.done) Object.assign(r, patch);
      });
    };

    const assign: Ctx['assign'] = (traineeId, courseId, due = '') => {
      if (isAssigned(S0.current, traineeId, courseId)) return false;
      update((s) => {
        s.assignments.push({ id: uid('a'), traineeId, courseId, assignedOn: today(), due });
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

    const removeTrainee: Ctx['removeTrainee'] = (id) => {
      update((s) => {
        s.trainees = s.trainees.filter((t) => t.id !== id);
        s.assignments = s.assignments.filter((a) => a.traineeId !== id);
        for (const k of Object.keys(s.progress)) if (k.startsWith(id + '|')) delete s.progress[k];
      });
      toast('Trainee removed');
    };

    const removeCourse: Ctx['removeCourse'] = (id) => {
      update((s) => {
        s.courses = s.courses.filter((c) => c.id !== id);
        s.assignments = s.assignments.filter((a) => a.courseId !== id);
        for (const k of Object.keys(s.progress)) if (k.split('|')[1] === id) delete s.progress[k];
      });
      toast('Course removed');
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

    const resetDemo = () => {
      const fresh = makeSeed();
      setS(fresh);
      try {
        localStorage.setItem(KEY, JSON.stringify(fresh));
      } catch {}
      toast('Demo data restored');
    };

    return { toggleTopic, patchCompletion, assign, unassign, saveSession, undoSession, removeTrainee, removeCourse, removeTopic, importCSV, resetDemo };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, toast]);

  const value: Ctx = {
    ready,
    S,
    me,
    login,
    logout,
    update,
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
