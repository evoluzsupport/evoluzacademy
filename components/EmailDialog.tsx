'use client';
import { useState } from 'react';
import { usePortal } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { courseAssignedTrainee, courseAssignedTrainer } from '@/lib/emails';
import type { Email } from '@/lib/emails';
import { nameMatches } from '@/lib/selectors';
import { primaryOf } from '@/lib/seed';
import type { Assignment, State } from '@/lib/types';

/** The trainee's and the trainer's "course assigned" emails for one assignment. */
export function assignmentEmails(S: State, a: Assignment, assignedBy?: string): { label: string; email: Email }[] {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const course = S.courses.find((c) => c.id === a.courseId);
  const learner = [...S.trainees, ...S.trainers, ...S.admins].find((x) => x.id === a.traineeId);
  if (!course || !learner) return [];
  const trainerName = a.trainer || primaryOf(course);
  const named = trainerName && trainerName !== 'No Trainer Assigned' ? trainerName : '';
  const trainer = named ? [...S.trainers, ...S.admins].find((p) => nameMatches(named, p.name)) : undefined;
  const info = { origin, course: course.name, trainer: named, trainee: learner.name, topics: course.topics.length, start: a.startDate, due: a.due, assignedBy };
  const out = [{ label: `To trainee · ${learner.name}`, email: courseAssignedTrainee({ ...info, toName: learner.name, toEmail: learner.email }) }];
  if (trainer) out.push({ label: `To trainer · ${trainer.name}`, email: courseAssignedTrainer({ ...info, toName: trainer.name, toEmail: trainer.email }) });
  return out;
}

/** Sends one email from the academy sender through the server route. Returns an error message, or null when sent. */
export async function sendEmailNow(e: Email): Promise<string | null> {
  if (!e.to) return `${e.toName} has no email address on file`;
  try {
    const { data } = await supabase.auth.getSession();
    const r = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ to: e.to, subject: e.subject, html: e.html, text: e.text }),
    });
    if (r.ok) return null;
    if (r.status === 501) return 'Email sending is not set up on the server yet';
    const j = await r.json().catch(() => ({}));
    return j.error || 'Could not send the email';
  } catch {
    return 'Could not reach the mail server';
  }
}

/** Sends several emails and reports one toast: how many went out, or the first problem. */
export async function sendAll(emails: Email[], toast: (m: string) => void, what: string) {
  const results = await Promise.all(emails.map(sendEmailNow));
  const failed = results.find((x) => x);
  const ok = results.filter((x) => !x).length;
  toast(failed ? `${what}: ${ok} sent. ${failed}` : `${what}: ${ok} email${ok === 1 ? '' : 's'} sent`);
}

/** Preview one or more emails in the portal's design and send them. */
export function EmailDialog({ emails, title = 'Send email' }: { emails: { label: string; email: Email }[]; title?: string }) {
  const { closeModal, toast } = usePortal();
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const cur = emails[i];
  const e = cur.email;

  const send = async () => {
    if (!e.to) return toast('This person has no email address on file');
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ to: e.to, subject: e.subject, html: e.html, text: e.text }),
      });
      if (r.ok) {
        toast(`Email sent to ${e.toName}`);
        closeModal();
      } else if (r.status === 501) {
        toast('Email sending is not set up on the server yet');
      } else {
        const j = await r.json().catch(() => ({}));
        toast(j.error || 'Could not send the email');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>{title}</h2>
      <p>Preview of the email exactly as the recipient will see it.</p>
      {emails.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {emails.map((x, n) => (
            <button key={n} className={`btn ${n === i ? 'primary' : ''}`} onClick={() => setI(n)}>
              {x.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ fontSize: 12, color: '#68778d', marginBottom: 10, display: 'grid', gap: 3 }}>
        <span><b>To:</b> {e.toName} &lt;{e.to || 'no email on file'}&gt;</span>
        <span><b>Subject:</b> {e.subject}</span>
      </div>
      <iframe
        title="Email preview"
        srcDoc={e.html}
        sandbox=""
        style={{ width: '100%', height: 430, border: '1px solid #e9edf4', borderRadius: 10, background: '#f7f9fc' }}
      />
      <div className="modal-actions">
        <button className="btn" onClick={closeModal}>Close</button>
        <button className="btn primary" onClick={send} disabled={busy || !e.to}>{busy ? 'Sending…' : 'Send email'}</button>
      </div>
    </>
  );
}
