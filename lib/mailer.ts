import { supabase } from './supabase';
import type { Email } from './emails';

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

/** Asks the server to send the signed-in, not-yet-added person their "request received" thank-you email. */
export async function sendAccessRequestMail(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ kind: 'access-request' }),
    });
  } catch {}
}
