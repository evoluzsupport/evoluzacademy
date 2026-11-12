'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { usePortal } from '@/lib/store';
import { firstTrainer } from '@/lib/seed';
import { canEditCompletion, nameMatches, topicKey, trainerNames } from '@/lib/selectors';
import type { Course, Topic } from '@/lib/types';
import { fmtDate, today } from '@/lib/util';

/** Splits manual text into short points: new lines, semicolons and sentence ends, plus commas when `commas` is set (not inside numbers like 1,000). */
const bullets = (v?: string, commas = false) =>
  String(v || '')
    .split(commas ? /\n+|;\s*|(?<!\d),\s*|,(?!\d)\s*|(?<=[.!?])\s+(?=[A-Z0-9])/ : /\n+|;\s*|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((x) => x.trim().replace(/[.;,]+$/, ''))
    .filter(Boolean);

/** The "What we cover" points of a topic, in order. A point is identified by its index in this list. */
export const coverPoints = (cover?: string) => bullets(cover, true);

/** "What we cover" and "Activity" as two labelled bullet lists. */
export function TopicDetails({
  cover,
  activity,
  checked,
  onCheck,
  disabled,
  locked,
  extra,
  readOnly,
}: {
  cover?: string;
  activity?: string;
  /** When set, "What we cover" points render with checkboxes (indexes of ticked points). */
  checked?: Set<number>;
  onCheck?: (index: number, on: boolean) => void;
  disabled?: boolean;
  /** points that are already recorded: shown ticked and not changeable */
  locked?: Set<number>;
  /** something to show after a point, e.g. who delivered it */
  extra?: (index: number) => ReactNode;
  /** show the boxes but do not let them be changed (they do not force a tick like `disabled` does) */
  readOnly?: boolean;
}) {
  const c = coverPoints(cover);
  const a = bullets(activity);
  if (!c.length && !a.length) return null;
  return (
    <div className="tdet">
      {c.length > 0 && (
        <div className="tdet-block">
          <span className="tdet-h">What we cover</span>
          {checked && onCheck ? (
            <ul className="tdet-checks">
              {c.map((x, i) => (
                <li key={i}>
                  <label>
                    <input type="checkbox" checked={disabled || checked.has(i) || !!locked?.has(i)} disabled={disabled || readOnly || !!locked?.has(i)} onChange={(e) => onCheck(i, e.target.checked)} />
                    <span>{x}</span>
                  </label>
                  {extra?.(i)}
                </li>
              ))}
            </ul>
          ) : (
            <ul>{c.map((x, i) => <li key={i}>{x}</li>)}</ul>
          )}
        </div>
      )}
      {a.length > 0 && (
        <div className="tdet-block act">
          <span className="tdet-h act">Activity</span>
          <ul>{a.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

/**
 * Every session logged on a topic, newest first: date, trainer, duration, the subtopics delivered (and by whom) and the notes.
 * With a traineeId it shows only the sessions that learner attended. Earlier sessions are never changed by later ones.
 */
export function TopicSessionLog({ courseId, topicId, cover, traineeId }: { courseId: string; topicId: string; cover?: string; traineeId?: string }) {
  const { S } = usePortal();
  const list = S.sessions
    .filter((x) => x.courseId === courseId && x.topicIds.includes(topicId) && (!traineeId || x.traineeIds.includes(traineeId)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  if (!list.length) return null;
  const labels = coverPoints(cover);
  return (
    <details className="tsl" onClick={(e) => e.stopPropagation()}>
      <summary>Session log · {list.length} {list.length === 1 ? 'session' : 'sessions'}</summary>
      <ul>
        {list.map((x) => {
          // subtopics delivered in this session, one entry per subtopic and trainer
          const seen = new Set<string>();
          const delivered: { i: number; trainer: string }[] = [];
          for (const [k, r] of Object.entries(S.points)) {
            const [tid, cid, tp, idx] = k.split('|');
            if (r.sessionId !== x.id || cid !== courseId || tp !== topicId || (traineeId && tid !== traineeId)) continue;
            const id = `${idx}|${r.trainer}`;
            if (!seen.has(id)) {
              seen.add(id);
              delivered.push({ i: Number(idx), trainer: r.trainer });
            }
          }
          delivered.sort((a, b) => a.i - b.i);
          const completedHere = Object.entries(S.progress).some(([k, r]) => r.sessionId === x.id && k.split('|')[1] === courseId && k.split('|')[2] === topicId && (!traineeId || k.startsWith(`${traineeId}|`)));
          return (
            <li key={x.id}>
              <b>{fmtDate(x.date)}</b> · {x.trainer}
              {x.durationMin ? ` · ${x.durationMin} min` : ''}
              {completedHere && <span className="pill done" style={{ marginLeft: 6 }}>Topic covered</span>}
              {delivered.length > 0 && (
                <div className="tsl-pts">{delivered.map((d) => `${labels[d.i] ?? `Subtopic ${d.i + 1}`} (by ${d.trainer})`).join(' · ')}</div>
              )}
              {x.notes && <div className="tsl-notes">{x.notes}</div>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/**
 * One topic with its per-learner completion state; editable for trainers/admins, view only for trainees.
 * The "What we cover" boxes only show what was delivered (and by whom); sessions are logged on the Log a session page.
 */
export function TopicRow({ traineeId, course, topic, editable: allowed }: { traineeId: string; course: Course; topic: Topic; editable: boolean }) {
  const { S, me, toggleTopic, patchCompletion } = usePortal();
  const rec = S.progress[topicKey(traineeId, course.id, topic.id)];
  const done = !!rec?.done;
  // a completed topic can only be changed by the trainer who delivered it (or an admin)
  const editable = allowed && canEditCompletion(me, rec);
  const locked = allowed && done && !editable;
  // default "delivered by": the signed-in person when they are one of the course's trainers, else its first trainer
  const [draftTrainer, setDraftTrainer] = useState(me && nameMatches(course.primaryTrainer, me.name) ? me.name : firstTrainer(course));
  const [draftDate, setDraftDate] = useState(today());
  const trainer = rec?.trainer ?? draftTrainer;
  const date = rec?.date ?? draftDate;
  const uidBase = `${traineeId}-${course.id}-${topic.id}`;
  // subtopics already recorded for this learner (the whole topic counts as every subtopic), with who delivered each
  const pointTrainers = (i: number) => {
    const prefix = `${topicKey(traineeId, course.id, topic.id)}|${i}|`;
    const names = Object.entries(S.points).filter(([k]) => k.startsWith(prefix)).map(([, r]) => r.trainer);
    return [...new Set(names.length ? names : done && rec ? [rec.trainer] : [])];
  };
  const recorded = new Set(coverPoints(topic.cover).map((_, i) => i).filter((i) => pointTrainers(i).length > 0));
  const byWho = (i: number) => {
    const t = pointTrainers(i);
    return t.length ? <small className="covered-by" style={{ marginLeft: 24 }}>by {t.join(', ')}</small> : null;
  };

  return (
    <div className="topic-row">
      <button
        className={`check ${done ? 'checked' : ''}`}
        role="checkbox"
        aria-checked={done}
        aria-label={`${topic.topic}: ${done ? 'completed' : 'not completed'}`}
        title={editable ? (done ? 'Mark incomplete' : 'Mark complete') : locked ? `Delivered by ${rec?.trainer}. Only they or an admin can change it` : done ? 'Completed' : 'Not completed yet'}
        disabled={!editable}
        style={editable ? undefined : { cursor: 'default' }}
        onClick={() => toggleTopic(traineeId, course.id, topic.id, trainer, date)}
      >
        {done ? '✓' : ''}
      </button>
      <div>
        <div className="topic-title">{topic.topic}</div>
        <TopicDetails
          cover={topic.cover}
          activity={topic.activity}
          checked={new Set<number>()}
          onCheck={() => undefined}
          locked={recorded}
          readOnly
          extra={byWho}
        />
        <TopicSessionLog courseId={course.id} topicId={topic.id} cover={topic.cover} traineeId={traineeId} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          {editable ? (
            <>
              <label className="subtle" htmlFor={`tr-${uidBase}`}>
                Delivered by{' '}
                <select
                  id={`tr-${uidBase}`}
                  className="select"
                  style={{ padding: '5px 7px', fontSize: 10 }}
                  value={trainer}
                  onChange={(e) => (rec ? patchCompletion(traineeId, course.id, topic.id, { trainer: e.target.value }) : setDraftTrainer(e.target.value))}
                >
                  {trainerNames(S, trainer).map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="subtle" htmlFor={`dt-${uidBase}`}>
                Date{' '}
                <input
                  id={`dt-${uidBase}`}
                  className="input"
                  type="date"
                  max={today()}
                  style={{ padding: '5px 7px', fontSize: 10 }}
                  value={date}
                  onChange={(e) => (rec ? patchCompletion(traineeId, course.id, topic.id, { date: e.target.value }) : setDraftDate(e.target.value))}
                />
              </label>
            </>
          ) : (
            done && (
              <span className="subtle">
                Delivered by {rec.trainer} · {fmtDate(rec.date)}
              </span>
            )
          )}
          {done && <span className="pill done">Completed</span>}
          {locked && <span className="subtle">Locked · only {rec?.trainer} or an admin can change it</span>}
        </div>
      </div>
      <span className="topic-day">{topic.day}</span>
    </div>
  );
}
