'use client';
import { useState } from 'react';
import { usePortal } from '@/lib/store';
import { primaryOf } from '@/lib/seed';
import { topicKey, trainerNames } from '@/lib/selectors';
import type { Course, Topic } from '@/lib/types';
import { fmtDate, today } from '@/lib/util';

/** One topic with its per-learner completion state; editable for trainers/admins. */
export function TopicRow({ traineeId, course, topic, editable }: { traineeId: string; course: Course; topic: Topic; editable: boolean }) {
  const { S, toggleTopic, patchCompletion } = usePortal();
  const rec = S.progress[topicKey(traineeId, course.id, topic.id)];
  const done = !!rec?.done;
  const [draftTrainer, setDraftTrainer] = useState(primaryOf(course));
  const [draftDate, setDraftDate] = useState(today());
  const trainer = rec?.trainer ?? draftTrainer;
  const date = rec?.date ?? draftDate;
  const uidBase = `${traineeId}-${course.id}-${topic.id}`;

  return (
    <div className="topic-row">
      <button
        className={`check ${done ? 'checked' : ''}`}
        role="checkbox"
        aria-checked={done}
        aria-label={`${topic.topic}: ${done ? 'completed' : 'not completed'}`}
        title={editable ? (done ? 'Mark incomplete' : 'Mark complete') : done ? 'Completed' : 'Not completed yet'}
        disabled={!editable}
        style={editable ? undefined : { cursor: 'default' }}
        onClick={() => toggleTopic(traineeId, course.id, topic.id, trainer, date)}
      >
        {done ? '✓' : ''}
      </button>
      <div>
        <div className="topic-title">{topic.topic}</div>
        <div className="topic-desc">{topic.activity || topic.cover}</div>
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
        </div>
      </div>
      <span className="topic-day">{topic.day}</span>
    </div>
  );
}
