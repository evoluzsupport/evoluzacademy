import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { requestReceivedEmail } from '@/lib/emails';

export const runtime = 'nodejs';

/**
 * Sends one email. Uses Zoho/any SMTP when SMTP_HOST, SMTP_USER, SMTP_PASS are set,
 * otherwise Resend (RESEND_API_KEY). EMAIL_FROM is the sender address.
 * Only signed-in admins and trainers may call it, so it can't be used as an open relay.
 */
export async function POST(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: u } = await sb.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const { data: prof } = await sb.from('profiles').select('role,name,email,joined,job_role').eq('auth_user_id', u.user.id).maybeSingle();
  const body = (await req.json()) as { kind?: string; to?: string; subject?: string; html?: string; text?: string };
  const staff = !!prof && (prof.role === 'admin' || prof.role === 'trainer');

  // A person who signed in without being added may send exactly one fixed email: the thank-you to themselves.
  const asking = body.kind === 'access-request' && !!prof && !staff && !prof.joined && !prof.job_role;
  if (!staff && !asking) return NextResponse.json({ error: 'Only admins and trainers can send email' }, { status: 403 });

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || smtpUser;
  const useSmtp = !!(smtpHost && smtpUser && smtpPass);
  if (!from || (!useSmtp && !key)) return NextResponse.json({ error: 'not-configured' }, { status: 501 });

  let to: string | undefined, subject: string | undefined, html: string | undefined, text: string | undefined;
  if (asking) {
    const mail = requestReceivedEmail({ origin: new URL(req.url).origin, name: prof!.name, email: u.user.email || prof!.email || '' });
    ({ to, subject, html, text } = mail);
  } else ({ to, subject, html, text } = body);
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) || !subject || !html)
    return NextResponse.json({ error: 'Missing recipient, subject or body' }, { status: 400 });

  if (useSmtp) {
    const port = Number(process.env.SMTP_PORT || 465);
    const mailer = nodemailer.createTransport({ host: smtpHost, port, secure: port === 465, auth: { user: smtpUser, pass: smtpPass } });
    try {
      await mailer.sendMail({ from, to, subject, html, text });
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ error: 'The mail server rejected the message. Check the SMTP settings.' }, { status: 502 });
    }
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!r.ok) return NextResponse.json({ error: 'The email service rejected the message' }, { status: 502 });
  return NextResponse.json({ ok: true });
}
